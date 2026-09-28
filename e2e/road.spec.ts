import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { driveProgress } from '../src/app/scene/escape';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/55-evidence';

interface SceneInfo {
  geometries: number;
  textures: number;
  settled: boolean;
  built: boolean;
  frame: { calls: number; triangles: number; points: number };
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) => page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

const spans = chapterSpans();
const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
/** Progress a share of the way through a chapter's span. */
const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

/** Every chapter's scene, and the war's shards, are built once; wait for them. */
const built = (page: Page) => expect.poll(async () => (await sceneInfo(page)).built, { timeout: 20_000 }).toBe(true);

/** Scrolls, snaps the eased camera there and lets it render, so every pass draws exactly the same frames. */
async function snapTo(page: Page, progress: number): Promise<void> {
  await scrollJourney(page, progress);
  await page.evaluate(async (p) => {
    (window as unknown as { __sceneJump: (p: number) => void }).__sceneJump(p);
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
  }, progress);
}

/**
 * Snaps to a progress, waits for the camera to be settled there and for a car swap (timed, car-rig.ts) to finish, and
 * shoots what the visitor sees.
 */
async function shoot(page: Page, progress: number, name: string): Promise<Buffer> {
  await snapTo(page, progress);
  await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(1_000);
  return page.screenshot({ path: `${EVIDENCE}/${name}.png` });
}

/** Lays the shots out four across, each at a quarter of its size, with its name, and returns the sheet as a PNG. */
async function contactSheet(page: Page, shots: [string, Buffer][]): Promise<Buffer> {
  const data = await page.evaluate(async (items) => {
    const images = await Promise.all(
      items.map(async ([name, src]) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        return { name, img };
      }),
    );
    const w = images[0].img.width / 4;
    const h = images[0].img.height / 4;
    const canvas = document.createElement('canvas');
    canvas.width = w * 4;
    canvas.height = h * Math.ceil(images.length / 4);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '14px sans-serif';
    images.forEach(({ name, img }, i) => {
      const x = (i % 4) * w;
      const y = Math.floor(i / 4) * h;
      ctx.drawImage(img, x, y, w, h);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x, y, ctx.measureText(name).width + 12, 22);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, x + 6, y + 16);
    });
    return canvas.toDataURL('image/png').split(',')[1];
  }, shots.map(([name, png]): [string, string] => [name, `data:image/png;base64,${png.toString('base64')}`]));
  return Buffer.from(data, 'base64');
}

/** The road under the person on the pavement, the cars in the lane, the war, the escape road and its join, and IATA. */
const SHOTS: [name: string, progress: number, expected: { rider?: string; car?: string }][] = [
  ['01-birth-crawl-on-pavement', at('birth', 0.5), { rider: 'crawl' }],
  ['02-school-walk-on-pavement', at('school', 0.5), { rider: 'walk' }],
  ['03-university-bike-on-pavement', at('university', 0.5), { rider: 'bike' }],
  ['04-first-websites-golf-handover', at('dreamweaver', 0.515), { car: 'golf2' }],
  ['05-kharkiv-career-car-on-road', at('kharkiv-career', 0.5), { car: 'f30' }],
  ['06-rally-road-gives-way-to-gravel', at('rally', 0.35), { car: 'forester' }],
  ['07-back-home', at('back-home', 0.5), { car: 'f30' }],
  ['08-war-grey', at('war', 0.6), { car: 'f30' }],
  ['09-escape-leaves-the-light', driveProgress(0.04), { car: 'f30' }],
  ['10-escape-mid-drive', driveProgress(0.5), { car: 'f30' }],
  ['11-escape-joins-road', driveProgress(0.93), { car: 'f30' }],
  ['12-ciklum-past-the-join', at('ciklum', 0.62), { car: 'f30' }],
  ['13-iata', at('iata', 0.5), { car: 'f30' }],
];

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('the road runs under him on the pavement, the cars in the lane, the escape road and on to IATA', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);

  const shots: [string, Buffer][] = [];
  for (const [name, progress, { rider, car }] of SHOTS) {
    shots.push([name, await shoot(page, progress, name)]);
    if (rider) await expect(page.locator(root)).toHaveAttribute('data-rider', rider);
    if (car) await expect(page.locator(root)).toHaveAttribute('data-car', car);
  }
  writeFileSync(`${EVIDENCE}/contact-sheet.png`, await contactSheet(page, shots));

  // Every chapter framed at its midpoint, with the road in: the frame's draw calls and triangles, for the budget.
  const budget: Record<string, SceneInfo['frame']> = {};
  const frames: [string, Buffer][] = [];
  for (const { chapter } of spans) {
    frames.push([chapter.id, await shoot(page, at(chapter.id, 0.5), `mid/${chapter.id}`)]);
    budget[chapter.id] = (await sceneInfo(page)).frame;
  }
  writeFileSync(`${EVIDENCE}/midpoints-sheet.png`, await contactSheet(page, frames));
  writeFileSync(`${EVIDENCE}/budget.json`, JSON.stringify(budget, null, 2));
  expect(errors).toEqual([]);
});

test('two passes over the whole journey allocate no new GPU geometry or textures', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);
  const sample = async () => {
    const { geometries, textures } = await sceneInfo(page);
    return { geometries, textures };
  };
  const stops = [...spans.map(({ chapter }) => at(chapter.id, 0.5)), ...[0.25, 0.5, 0.75, 1].map(driveProgress)].sort((a, b) => a - b);
  const pass = async () => {
    for (const p of [...stops, ...[...stops].reverse()]) await snapTo(page, p);
    return sample();
  };
  const first = await pass();
  const second = await pass();
  writeFileSync(`${EVIDENCE}/memory.json`, JSON.stringify({ first, second }, null, 2));
  expect(second).toEqual(first);
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('he walks the pavement on a portrait phone, without errors', async ({ page }) => {
    const errors = collectErrors(page);
    await visit(page, '/');
    await built(page);
    await shoot(page, at('school', 0.5), '14-school-walk-390');
    await expect(page.locator(root)).toHaveAttribute('data-rider', 'walk');
    expect(errors).toEqual([]);
  });
});

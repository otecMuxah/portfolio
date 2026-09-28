import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/46-evidence';

interface SceneInfo {
  geometries: number;
  textures: number;
  settled: boolean;
  built: boolean;
  frame: { calls: number; triangles: number; points: number };
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) => page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

const span = (id: string) => chapterSpans().find((s) => s.chapter.id === id)!;
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

/** Snaps to a progress, waits for the camera to be settled there, and shoots the canvas. */
async function shoot(page: Page, progress: number, name: string): Promise<Buffer> {
  await snapTo(page, progress);
  await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 20_000 }).toBe(true);
  return page.locator('canvas.scene').screenshot({ path: `${EVIDENCE}/${name}.png` });
}

/** Share of pixels that differ visibly between two same-sized PNGs, compared in the page's 2D canvas. */
async function pixelDiff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([srcA, srcB]) => {
      const load = async (src: string) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height).data;
      };
      const [pa, pb] = [await load(srcA), await load(srcB)];
      let differ = 0;
      for (let i = 0; i < pa.length; i += 4) {
        if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > 30) differ++;
      }
      return differ / (pa.length / 4);
    },
    [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`],
  );
}

/** Scroll between two progress points in small steps and return each distinct rider readout, in order. */
async function ridersWhileScrolling(page: Page, from: number, to: number): Promise<string[]> {
  return page.evaluate(
    async ([a, b]) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const rootEl = document.querySelector('app-root')!;
      const seen: string[] = [];
      for (let i = 0; i <= 150; i++) {
        window.scrollTo(0, max * (a + ((b - a) * i) / 150));
        await new Promise(requestAnimationFrame);
        const rider = rootEl.getAttribute('data-rider')!;
        if (seen.at(-1) !== rider) seen.push(rider);
      }
      return seen;
    },
    [from, to],
  );
}

/** Each stage framed where the camera frames its chapter, and the blends and the handover between them. */
const SHOTS: [name: string, progress: number, rider: string][] = [
  ['01-crawl-birth', at('birth', 0.5), 'crawl'],
  ['02-crawl-to-walk-1987', at('birth', 0.97), 'crawl'],
  ['03-walk-school', at('school', 0.5), 'walk'],
  ['04-run-lyceum', at('lyceum', 0.5), 'run'],
  ['05-run-to-bike-1998', at('university', 0.03), 'bike'],
  ['06-bike-university', at('university', 0.5), 'bike'],
  ['07-bike-first-websites', at('dreamweaver', 0.2), 'bike'],
  ['08-handover-off-the-bike', at('dreamweaver', 0.43), 'bike'],
  ['09-handover-at-the-door', at('dreamweaver', 0.495), 'bike'],
  ['10-handover-golf2-pulls-up', at('dreamweaver', 0.515), 'none'],
  ['11-handover-golf2-landed', at('dreamweaver', 0.535), 'none'],
  ['12-handover-getting-in', at('dreamweaver', 0.543), 'none'],
  ['13-golf2-carries-him', at('dreamweaver', 0.6), 'none'],
];

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('he crawls, walks, runs and cycles through the early chapters until the Golf 2 takes over, and back', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await expect(page.locator(root)).toHaveAttribute('data-rider', 'crawl');

  const end = at('family', 0.5);
  expect(await ridersWhileScrolling(page, 0, end)).toEqual(['crawl', 'walk', 'run', 'bike', 'none']);
  expect(await ridersWhileScrolling(page, end, 0)).toEqual(['none', 'bike', 'run', 'walk', 'crawl']);

  // He is gone exactly when the first car arrives, and back when scrolling returns before it.
  await scrollJourney(page, at('dreamweaver', 0.47));
  await expect(page.locator(root)).toHaveAttribute('data-rider', 'bike');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'none');
  await scrollJourney(page, at('dreamweaver', 0.53));
  await expect(page.locator(root)).toHaveAttribute('data-rider', 'none');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'golf2');
  await scrollJourney(page, at('ciklum', 0.5));
  await expect(page.locator(root)).toHaveAttribute('data-rider', 'none');
  expect(errors).toEqual([]);
});

test('each stage, the blends between them and the handover to the Golf 2, on camera', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);
  const budget: Record<string, SceneInfo['frame']> = {};
  const shots: Buffer[] = [];
  for (const [name, progress, rider] of SHOTS) {
    shots.push(await shoot(page, progress, name));
    await expect(page.locator(root)).toHaveAttribute('data-rider', rider);
    budget[name] = (await sceneInfo(page)).frame;
  }
  // Every stage looks different where it is framed.
  for (const [a, b] of [[0, 2], [2, 3], [3, 5]]) expect(await pixelDiff(page, shots[a], shots[b])).toBeGreaterThan(0.002);

  // The Golf pulls up beside him by scroll, then he gets in: each step of the handover is its own frame.
  for (const [a, b] of [[7, 8], [8, 9], [9, 10], [10, 11], [11, 12]]) expect(await pixelDiff(page, shots[a], shots[b])).toBeGreaterThan(0.001);
  await expect(page.locator(root)).toHaveAttribute('data-car', 'golf2');
  writeFileSync(`${EVIDENCE}/budget.json`, JSON.stringify(budget, null, 2));
  expect(errors).toEqual([]);
});

test('scrolling back past the Golf returns him exactly as he was', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);
  const walking = at('school', 0.5);
  const forward = await shoot(page, walking, '14-walk-forward');
  for (const p of [at('lyceum', 0.5), at('university', 0.5), at('dreamweaver', 0.6), at('family', 0.5)]) await snapTo(page, p);
  for (const p of [at('dreamweaver', 0.6), at('university', 0.5), at('lyceum', 0.5)]) await snapTo(page, p);
  const back = await shoot(page, walking, '15-walk-after-reverse');
  await expect(page.locator(root)).toHaveAttribute('data-rider', 'walk');
  expect(await pixelDiff(page, forward, back)).toBeLessThan(0.02);
  expect(errors).toEqual([]);
});

test('two passes through his stages allocate no new GPU geometry or textures', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);
  const sample = async () => {
    const { geometries, textures } = await sceneInfo(page);
    return { geometries, textures };
  };
  const stops = Array.from({ length: 25 }, (_, i) => (i / 24) * at('dreamweaver', 0.7));
  const pass = async () => {
    for (const p of stops) await snapTo(page, p);
    for (const p of [...stops].reverse()) await snapTo(page, p);
    return sample();
  };
  const start = await sample();
  const first = await pass();
  const second = await pass();
  writeFileSync(`${EVIDENCE}/memory.json`, JSON.stringify({ start, first, second }, null, 2));
  expect(second).toEqual(first);
  expect(errors).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  // Like the car, he rides right of the portrait frame (CAR_OFFSET); the shot records that the stage runs clean.
  test('the stages run without errors on a portrait phone', async ({ page }) => {
    const errors = collectErrors(page);
    await visit(page, '/');
    await built(page);
    await shoot(page, at('university', 0.5), '16-bike-390');
    await expect(page.locator(root)).toHaveAttribute('data-rider', 'bike');
    expect(errors).toEqual([]);
  });
});

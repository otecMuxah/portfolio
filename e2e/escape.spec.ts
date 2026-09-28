import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { driveProgress } from '../src/app/scene/escape';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/44-evidence/e2e';

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

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('the F30 drives out of the war on its road, a new frame at every stretch, and the car is the F30 throughout', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);

  const alone = await shoot(page, driveProgress(0) - 0.002, '00-light-alone');
  const stops = [0.1, 0.3, 0.5, 0.7, 0.9];
  const budget: Record<string, SceneInfo['frame']> = {};
  const shots: Buffer[] = [];
  for (const [i, u] of stops.entries()) {
    shots.push(await shoot(page, driveProgress(u), `0${i + 1}-drive-${Math.round(u * 100)}`));
    await expect(page.locator(root)).toHaveAttribute('data-car', 'f30');
    const { frame } = await sceneInfo(page);
    budget[`drive ${u}`] = frame;
    // The road, its signs and the car's lamps are drawn: the headlights and reflectors are points.
    expect(frame.points, `points at drive ${u}`).toBeGreaterThan(0);
  }
  // The car has left the light (a small change in a night frame), and the road goes on changing: a drive, not a still.
  expect(await pixelDiff(page, alone, shots[0])).toBeGreaterThan(0.005);
  for (let i = 1; i < shots.length; i++) expect(await pixelDiff(page, shots[i - 1], shots[i])).toBeGreaterThan(0.02);

  writeFileSync(`${EVIDENCE}/budget.json`, JSON.stringify(budget, null, 2));
  expect(errors).toEqual([]);
});

test('scrolling back through the drive puts the car and the camera where they were going forward', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);

  for (const u of [0, 0.25]) await snapTo(page, driveProgress(u));
  const forward = await shoot(page, driveProgress(0.5), '10-mid-drive-forward');
  for (const p of [driveProgress(0.75), driveProgress(1), at('iata', 0.5), driveProgress(0.75)]) await snapTo(page, p);
  const back = await shoot(page, driveProgress(0.5), '11-mid-drive-reversed');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'f30');
  expect(await pixelDiff(page, forward, back)).toBeLessThan(0.02);
  expect(errors).toEqual([]);
});

test('two scroll passes over the drive allocate no new GPU geometry or textures', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);

  const sample = async () => {
    const { geometries, textures } = await sceneInfo(page);
    return { geometries, textures };
  };
  const stops = [at('war', 0.75), ...Array.from({ length: 11 }, (_, i) => driveProgress(i / 10)), at('iata', 0.5)];
  const pass = async () => {
    for (const p of [...stops, ...[...stops].reverse()]) await snapTo(page, p);
    return sample();
  };

  const first = await pass();
  const second = await pass();
  writeFileSync(`${EVIDENCE}/memory.json`, JSON.stringify({ first, second }, null, 2));

  expect(second.geometries).toBe(first.geometries);
  expect(second.textures).toBe(first.textures);
  expect(errors).toEqual([]);
});

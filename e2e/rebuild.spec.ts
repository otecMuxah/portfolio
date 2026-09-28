import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/10-evidence';

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

/** Scroll from one progress to another in small steps, returning the chapter, phase and car seen at each. */
async function scan(page: Page, from: number, to: number): Promise<[string, string, string][]> {
  return page.evaluate(
    async ([a, b]) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const rootEl = document.querySelector('app-root')!;
      const seen: [string, string, string][] = [];
      for (let i = 0; i <= 100; i++) {
        window.scrollTo(0, max * (a + ((b - a) * i) / 100));
        await new Promise(requestAnimationFrame);
        seen.push(['chapter', 'phase', 'car'].map((k) => rootEl.getAttribute(`data-${k}`)!) as [string, string, string]);
      }
      return seen;
    },
    [from, to],
  );
}

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('data-phase is rebuild and the car is the F30 through Ciklum and IATA, forward and back', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await visit(page, '/');

  const forward = await scan(page, at('war', 0.5), 1);
  const back = await scan(page, 1, at('war', 0.5));
  for (const [name, seen] of [['forward', forward], ['back', back]] as const) {
    for (const id of ['ciklum', 'iata']) expect(seen.some(([chapter]) => chapter === id), `${name} scan reaches ${id}`).toBe(true);
    for (const [chapter, phase, car] of seen) {
      if (chapter !== 'ciklum' && chapter !== 'iata') continue;
      expect(phase, `${chapter} phase (${name})`).toBe('rebuild');
      expect(car, `${chapter} car (${name})`).toBe('f30');
    }
    expect(seen.some(([chapter, phase]) => chapter === 'war' && phase === 'shatter'), `${name} scan meets the war`).toBe(true);
  }
  await scrollJourney(page, at('back-home', 0.5));
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'build');
  expect(errors).toEqual([]);
});

test('the rebuild goes up by scroll and scrolling back returns the war exactly as it was left', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);

  const warEnd = await shoot(page, at('war', 0.999), '01-war-end');
  const budget: Record<string, SceneInfo['frame']> = {};
  const stops: [string, number][] = [
    ['ciklum', 0.1],
    ['ciklum', 0.3],
    ['ciklum', 0.5],
    ['ciklum', 0.6],
    ['ciklum', 0.75],
    ['ciklum', 0.9],
    ['iata', 0.2],
    ['iata', 0.5],
    ['iata', 0.9],
  ];
  const shots: Buffer[] = [];
  for (const [i, [id, local]] of stops.entries()) {
    shots.push(await shoot(page, at(id, local), `${String(i + 2).padStart(2, '0')}-${id}-${Math.round(local * 100)}`));
    await expect(page.locator(root)).toHaveAttribute('data-chapter', id);
    budget[`${id} ${local}`] = (await sceneInfo(page)).frame;
  }
  // Something new stands where the war left only a light, and IATA is a different place again.
  const shot = (id: string, local: number) => shots[stops.findIndex(([i, l]) => i === id && l === local)];
  expect(await pixelDiff(page, warEnd, shot('ciklum', 0.5))).toBeGreaterThan(0.05);
  expect(await pixelDiff(page, shot('ciklum', 0.5), shot('iata', 0.5))).toBeGreaterThan(0.05);

  // Back down through the rebuild, a step at a time, to the war's end.
  for (const [id, local] of [...stops].reverse()) await snapTo(page, at(id, local));
  const reversed = await shoot(page, at('war', 0.999), `${stops.length + 2}-war-end-reversed`);
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'shatter');
  expect(await pixelDiff(page, warEnd, reversed)).toBeLessThan(0.02);

  writeFileSync(`${EVIDENCE}/budget.json`, JSON.stringify(budget, null, 2));
  expect(errors).toEqual([]);
});

test('two scroll passes through the rebuild allocate no new GPU geometry or textures', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await built(page);

  const sample = async () => {
    const { geometries, textures } = await sceneInfo(page);
    const heap = await page.evaluate(
      () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
    );
    return { geometries, textures, heapMB: heap === null ? null : Math.round((heap / 1048576) * 10) / 10 };
  };
  // From the war's end through both rebuild chapters in steps, to the end of the scroll and back.
  const stops = [
    at('war', 0.9),
    ...['ciklum', 'iata'].flatMap((id) => [0, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9].map((l) => at(id, l))),
    1,
  ];
  const pass = async () => {
    for (const p of [...stops, ...[...stops].reverse()]) await snapTo(page, p);
    return sample();
  };

  const start = await sample();
  const first = await pass();
  const second = await pass();
  writeFileSync(`${EVIDENCE}/memory.json`, JSON.stringify({ start, first, second }, null, 2));

  expect(second.geometries).toBe(first.geometries);
  expect(second.textures).toBe(first.textures);
  expect(errors).toEqual([]);
});

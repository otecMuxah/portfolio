import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/9-evidence';

interface SceneInfo {
  geometries: number;
  textures: number;
  settled: boolean;
  shatter?: { triangles: number; shards: number; particles: number; drawCalls: number };
  frame: { calls: number; triangles: number; points: number };
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) => page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

const span = (id: string) => chapterSpans().find((s) => s.chapter.id === id)!;
/** Progress a share of the way through a chapter's span. */
const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

/** Waits for the eased camera to reach the scroll position, then shoots the canvas. */
async function shoot(page: Page, name: string): Promise<Buffer> {
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

/** Scroll through the whole journey in small steps one way, returning every chapter and phase seen. */
async function phasesWhileScrolling(page: Page, direction: 'forward' | 'back'): Promise<[string, string][]> {
  return page.evaluate(async (dir) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const rootEl = document.querySelector('app-root')!;
    const seen: [string, string][] = [];
    for (let i = 0; i <= 200; i++) {
      window.scrollTo(0, (max * (dir === 'forward' ? i : 200 - i)) / 200);
      await new Promise(requestAnimationFrame);
      seen.push([rootEl.getAttribute('data-chapter')!, rootEl.getAttribute('data-phase')!]);
    }
    return seen;
  }, direction);
}

/** The shards are built once every chapter has; wait for them. */
const shardsReady = (page: Page) =>
  expect.poll(async () => (await sceneInfo(page)).shatter?.triangles ?? 0, { timeout: 20_000 }).toBeGreaterThan(0);

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('data-phase is shatter only within the war chapter, and scrolling back returns it to build', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = collectErrors(page);
  await visit(page, '/');

  for (const direction of ['forward', 'back'] as const) {
    const seen = await phasesWhileScrolling(page, direction);
    expect(seen.some(([chapter]) => chapter === 'war'), `${direction} scan reaches the war`).toBe(true);
    for (const [chapter, phase] of seen) expect(phase === 'shatter', `${chapter} ${phase} (${direction})`).toBe(chapter === 'war');
  }

  await scrollJourney(page, at('war', 0.5));
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'shatter');
  await scrollJourney(page, at('back-home', 0.5));
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'back-home');
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'build');
  expect(errors).toEqual([]);
});

test('the war is the longest chapter to scroll through', () => {
  const lengths = chapterSpans().map((s) => ({ id: s.chapter.id, length: s.end - s.start }));
  const war = lengths.find((l) => l.id === 'war')!;
  for (const other of lengths.filter((l) => l.id !== 'war')) expect(war.length).toBeGreaterThan(other.length);
});

test('the world breaks through the war and is whole again when scrolled back', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await shardsReady(page);

  await scrollJourney(page, at('back-home', 0.5));
  const before = await shoot(page, '00-back-home');

  const shots: Buffer[] = [];
  const budget: Record<string, SceneInfo['frame']> = {};
  for (const [i, local] of [0.001, 0.25, 0.5, 0.75, 0.999].entries()) {
    await scrollJourney(page, at('war', local));
    await expect(page.locator(root)).toHaveAttribute('data-phase', 'shatter');
    shots.push(await shoot(page, `0${i + 1}-war-${Math.round(local * 100)}`));
    budget[`war ${local}`] = (await sceneInfo(page)).frame;
  }
  // The world at the war's start is the world as built; by its middle it has broken; the last stretch is still.
  expect(await pixelDiff(page, before, shots[2])).toBeGreaterThan(0.05);
  expect(await pixelDiff(page, shots[3], shots[4])).toBeLessThan(0.02);

  await scrollJourney(page, at('back-home', 0.5));
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'build');
  const after = await shoot(page, '06-back-home-reversed');
  // Only the idle embers move between the two.
  expect(await pixelDiff(page, before, after)).toBeLessThan(0.02);

  writeFileSync(`${EVIDENCE}/budget.json`, JSON.stringify({ shatter: (await sceneInfo(page)).shatter, frames: budget }, null, 2));
  expect(errors).toEqual([]);
});

test('two full scroll passes through the war allocate no new GPU geometry or textures', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await shardsReady(page);

  const sample = async () => {
    const { geometries, textures } = await sceneInfo(page);
    const heap = await page.evaluate(
      () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
    );
    return { geometries, textures, heapMB: heap === null ? null : Math.round((heap / 1048576) * 10) / 10 };
  };
  const stops = [0, at('back-home', 0.5), ...[0, 0.2, 0.4, 0.6, 0.8, 1].map((l) => at('war', l)), at('ciklum', 0.5), 1];
  const pass = async () => {
    for (const p of [...stops, ...[...stops].reverse()]) {
      await scrollJourney(page, p);
      await page.waitForTimeout(150);
      // The garage's cars only appear once the eased camera gets there: let it arrive before turning back.
      if (p === 1) await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 20_000 }).toBe(true);
    }
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

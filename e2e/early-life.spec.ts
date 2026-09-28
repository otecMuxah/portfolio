import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { collectErrors, root, scrollJourney, scrollToChapter, visit } from './support';

const EVIDENCE = 'docs/analysis/5-evidence';
const CHAPTERS = ['birth', 'school', 'lyceum', 'university', 'dreamweaver', 'family'];

interface SceneInfo {
  geometries: number;
  textures: number;
  settled: boolean;
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) => page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

/** Waits for the eased camera to reach the scroll position (slow on the test browser's software GPU), then shoots the canvas. */
async function shoot(page: Page, name: string): Promise<Buffer> {
  await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 15_000 }).toBe(true);
  return page.locator('canvas').screenshot({ path: `${EVIDENCE}/${name}.png` });
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

/** Where a chapter's framing is exact: the middle of its scroll span. */
const midpoint = (id: string) => {
  const span = chapterSpans().find((s) => s.chapter.id === id)!;
  return (span.start + span.end) / 2;
};

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

for (const [i, id] of CHAPTERS.entries()) {
  test(`the ${id} chapter shows its scene without errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await visit(page, '/');
    await scrollToChapter(page, id);
    await scrollJourney(page, midpoint(id));
    await shoot(page, `0${i + 1}-${id}`);
    expect(errors).toEqual([]);
  });
}

test('late in the family chapter a third light joins the two', async ({ page }) => {
  const errors = collectErrors(page);
  await visit(page, '/');
  await scrollToChapter(page, 'family');
  await scrollJourney(page, midpoint('family'));
  const met = await shoot(page, '06-family');
  const family = chapterSpans().find((s) => s.chapter.id === 'family')!;
  await scrollJourney(page, family.start + 0.75 * (family.end - family.start));
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'family');
  const joined = await shoot(page, '07-family-2010');
  expect(await pixelDiff(page, met, joined)).toBeGreaterThan(0.01);
  expect(errors).toEqual([]);
});

test('scrolling back from family rebuilds birth exactly as it was', async ({ page }) => {
  const errors = collectErrors(page);
  // The exact same scroll position both times, so any difference is the scene's, not the camera's.
  const birthMid = midpoint('birth');
  await visit(page, '/');
  await scrollToChapter(page, 'birth');
  await scrollJourney(page, birthMid);
  const first = await shoot(page, '01-birth');
  await scrollToChapter(page, 'family');
  await shoot(page, '08-family-before-reverse');
  await scrollToChapter(page, 'birth');
  await scrollJourney(page, birthMid);
  const back = await shoot(page, '09-birth-after-reverse');
  expect(await pixelDiff(page, first, back)).toBeLessThan(0.01);
  expect(errors).toEqual([]);
});

test('two full scroll passes allocate no new GPU geometry or textures', async ({ page }) => {
  const errors = collectErrors(page);
  await visit(page, '/');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  const sample = async () => {
    const { geometries, textures } = await sceneInfo(page);
    const heap = await page.evaluate(
      () => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
    );
    return { geometries, textures, heapMB: heap === null ? null : Math.round((heap / 1048576) * 10) / 10 };
  };
  // Down and back up through every chapter, pausing on each so the camera renders it.
  const pass = async () => {
    for (let i = 0; i <= 28; i++) {
      await scrollJourney(page, i / 28);
      await page.waitForTimeout(80);
    }
    for (let i = 28; i >= 0; i--) {
      await scrollJourney(page, i / 28);
      await page.waitForTimeout(80);
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

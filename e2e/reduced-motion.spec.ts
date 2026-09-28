import { mkdirSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/16-evidence';

interface SceneInfo {
  settled: boolean;
  built: boolean;
  /** Camera position then quaternion. */
  camera: number[];
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) => page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

const spans = chapterSpans();
const at = (i: number, local: number) => spans[i].start + (spans[i].end - spans[i].start) * local;

/** Scrolls there and returns the camera once the still scene has dipped back in, rounded to a millimetre. */
async function cameraAt(page: Page, progress: number): Promise<number[]> {
  await scrollJourney(page, progress);
  await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 20_000 }).toBe(true);
  return (await sceneInfo(page)).camera.map((x) => Math.round(x * 1000));
}

test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('under reduced motion every chapter is reachable over a still scene: no fly-through, no shake', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await expect.poll(async () => (await sceneInfo(page)).built, { timeout: 20_000 }).toBe(true);

  const cameras: number[][] = [];
  for (const { chapter, index } of spans) {
    // The war shakes between 0.04 and 0.62 of its span (shatter.ts), so it is sampled there too.
    const locals = chapter.phase === 'shatter' ? [0.02, 0.2, 0.4, 0.6, 0.98] : [0.02, 0.5, 0.98];
    const seen = [];
    for (const local of locals) seen.push(await cameraAt(page, at(index, local)));
    await expect(page.locator(root)).toHaveAttribute('data-chapter', chapter.id);
    for (const camera of seen) expect(camera, `${chapter.id}: the camera holds still across the chapter`).toEqual(seen[0]);
    cameras.push(seen[0]);
    await expect(page.locator('.card__title')).toBeVisible();
    await page.screenshot({ path: `${EVIDENCE}/${String(index + 1).padStart(2, '0')}-reduced-${chapter.id}.png` });
  }
  // Each chapter still has its own view.
  expect(new Set(cameras.map(String)).size).toBe(spans.length);
  expect(errors).toEqual([]);
});

test('under reduced motion the card cross-fades to the next chapter, and back', async ({ page }) => {
  const errors = collectErrors(page);
  await visit(page, '/');
  await scrollJourney(page, at(0, 0.5));
  await expect(page.locator(root)).toHaveAttribute('data-chapter', spans[0].chapter.id);

  for (const [index, title] of [
    [1, spans[0].chapter.id],
    [0, spans[1].chapter.id],
  ] as const) {
    // While both show, the one leaving is a copy of the card as it read, fading out over the new one.
    const both = await page.evaluate(async (p) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo(0, max * p);
      for (let i = 0; i < 60; i++) {
        await new Promise(requestAnimationFrame);
        const cards = document.querySelectorAll('article.card');
        if (cards.length === 2) {
          const [card, leaving] = [...cards] as HTMLElement[];
          return { leavingInert: leaving.inert, fading: [card, leaving].map((c) => c.getAnimations().length) };
        }
      }
      return null;
    }, at(index, 0.5));
    expect(both, `a cross-fade leaving ${title}`).toEqual({ leavingInert: true, fading: [1, 1] });
    await expect(page.locator('article.card')).toHaveCount(1);
    await expect(page.locator(root)).toHaveAttribute('data-chapter', spans[index].chapter.id);
  }
  expect(errors).toEqual([]);
});

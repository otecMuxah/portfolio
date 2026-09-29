import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/16-evidence';

interface SceneInfo {
  settled: boolean;
  built: boolean;
  shatter?: { triangles: number; shards: number; particles: number; drawCalls: number };
  frame: { calls: number; triangles: number; points: number };
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) => page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

const spans = chapterSpans();
const mid = (i: number) => (spans[i].start + spans[i].end) / 2;

/** Every chapter mid-span, and the war as it breaks: where the frame budget is read and the screenshots taken. */
const stops = spans.flatMap(({ chapter, index }) =>
  chapter.phase === 'shatter'
    ? [0.25, 0.5].map((local) => ({ id: `${chapter.id}-${local * 100}`, progress: spans[index].start + (spans[index].end - spans[index].start) * local }))
    : [{ id: chapter.id, progress: mid(index) }],
);

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test.describe('on a phone', () => {
  // A 3x phone screen: the renderer's pixel ratio stops at 2.
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test('every chapter plays on a phone, at pixel ratio 2, with the lighter scene', async ({ page }) => {
    test.setTimeout(180_000);
    const errors = collectErrors(page);
    await visit(page, '/');
    await expect.poll(async () => (await sceneInfo(page)).built, { timeout: 30_000 }).toBe(true);

    const ratio = await page.locator('canvas.scene').evaluate((c: HTMLCanvasElement) => c.width / c.clientWidth);
    expect(ratio).toBe(2);
    expect(await page.locator('canvas.scene').evaluate((c) => getComputedStyle(c).getPropertyValue('--phone').trim())).toBe('1');

    const frames: Record<string, SceneInfo['frame']> = {};
    for (const [n, { id, progress }] of stops.entries()) {
      await scrollJourney(page, progress);
      await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 20_000 }).toBe(true);
      await expect(page.locator(root)).toHaveAttribute('data-chapter', id.replace(/-\d+$/, ''));
      frames[id] = (await sceneInfo(page)).frame;
      await page.screenshot({ path: `${EVIDENCE}/${String(20 + n)}-phone-${id}.png` });
    }

    const { shatter } = await sceneInfo(page);
    writeFileSync(`${EVIDENCE}/phone-budget.json`, JSON.stringify({ ratio, shatter, frames }, null, 2));
    // The coarser shatter (shatter.ts): about 18.7k triangles against 45.2k on a desktop.
    expect(shatter!.triangles).toBeLessThanOrEqual(20_000);
    // The birth cloud and the rally dust, drawn from every chapter, at half: 600 of 1200 each.
    expect(frames['birth'].points).toBeLessThanOrEqual(1_200);
    expect(errors).toEqual([]);
  });
});

import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { driveProgress } from '../src/app/scene/escape';
import { collectErrors, scrollJourney, visit } from './support';

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface SceneInfo {
  settled: boolean;
  built: boolean;
  hero: Rect | null;
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) => page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

const spans = chapterSpans();
const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
/** Progress a share of the way through a chapter's span. */
const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

/** Every chapter's midpoint but the war's, where the hero exists only as shards; the handover; and the escape drive. */
const STOPS: [name: string, progress: number][] = [
  ...spans.filter((s) => s.chapter.phase !== 'shatter').map((s): [string, number] => [s.chapter.id, (s.start + s.end) / 2]),
  ...[0.43, 0.495, 0.515, 0.535].map((k): [string, number] => [`handover ${k}`, at('dreamweaver', k)]),
  ...[0.1, 0.2, 0.3, 0.5, 0.7, 0.85, 0.95].map((u): [string, number] => [`escape drive ${u}`, driveProgress(u)]),
];

test.use({ viewport: { width: 390, height: 844 } });

test('on a portrait phone the rider and the car stay in frame, above the folded card', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await visit(page, '/');
  await expect.poll(async () => (await sceneInfo(page)).built, { timeout: 20_000 }).toBe(true);

  for (const [name, progress] of STOPS) {
    await scrollJourney(page, progress);
    await page.evaluate(async (p) => {
      (window as unknown as { __sceneJump: (p: number) => void }).__sceneJump(p);
      for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
    }, progress);
    await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 20_000 }).toBe(true);
    const hero = (await sceneInfo(page)).hero;
    const card = (await page.locator('.card').boundingBox())!;
    expect(hero, `${name}: hero on screen`).not.toBeNull();
    expect(hero!.left, `${name}: left`).toBeGreaterThanOrEqual(0);
    expect(hero!.right, `${name}: right`).toBeLessThanOrEqual(390);
    expect(hero!.top, `${name}: top`).toBeGreaterThanOrEqual(0);
    expect(hero!.bottom, `${name}: above the card`).toBeLessThanOrEqual(card.y);
  }
  expect(errors).toEqual([]);
});

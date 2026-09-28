import { Page, expect } from '@playwright/test';

export const root = 'app-root';

/**
 * Wait until the app has hydrated and the first chapter's scene is up. The prerendered HTML
 * already carries the state readout, so without this a test can act before scroll and key
 * handlers exist.
 */
export async function ready(page: Page): Promise<void> {
  await expect(page.locator(root)).toHaveAttribute('data-scene', 'ready');
}

/** Open a page and wait until the journey responds to input. */
export async function visit(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await ready(page);
}

/** Scroll the journey to a progress between 0 and 1. */
export async function scrollJourney(page: Page, progress: number): Promise<void> {
  await ready(page);
  await page.evaluate((p) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, max * p);
  }, progress);
}

/** Scroll to the middle of a chapter's span, found by scanning the state readout. */
export async function scrollToChapter(page: Page, chapterId: string): Promise<void> {
  await ready(page);
  const range = await page.evaluate(async (id) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const rootEl = document.querySelector('app-root')!;
    const hits: number[] = [];
    // 1% steps resolve every chapter span; stop once the scan has passed the chapter.
    for (let i = 0; i <= 100; i++) {
      window.scrollTo(0, (max * i) / 100);
      await new Promise(requestAnimationFrame);
      if (rootEl.getAttribute('data-chapter') === id) hits.push(i / 100);
      else if (hits.length) break;
    }
    return hits.length ? [hits[0], hits[hits.length - 1]] : null;
  }, chapterId);
  expect(range, `chapter ${chapterId} reachable by scroll`).not.toBeNull();
  await scrollJourney(page, (range![0] + range![1]) / 2);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', chapterId);
}

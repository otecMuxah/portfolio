import { Page, expect, test } from '@playwright/test';
import { CHAPTERS, Chapter } from '../src/app/content/life';
import { chapterSpans } from '../src/app/journey/journey';

const root = 'app-root';

/** Scroll to the middle of a chapter's span and wait for the readout to land on it. */
async function scrollToChapter(page: Page, chapter: Chapter) {
  const span = chapterSpans(CHAPTERS).find((s) => s.chapter === chapter)!;
  await page.evaluate((p) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, max * p);
  }, (span.start + span.end) / 2);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', chapter.id);
}

test('the car carrying the camera follows the years', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');

  const before2003 = CHAPTERS.filter((c) => c.year !== undefined && c.year < 2003);
  expect(before2003.length).toBeGreaterThan(0);
  for (const chapter of before2003) {
    await scrollToChapter(page, chapter);
    await expect(page.locator(root)).toHaveAttribute('data-car', 'none');
  }

  for (const [year, car] of [
    [2006, 'mazda3'],
    [2010, 'forester'],
    [2024, 'f30'],
  ] as const) {
    const chapter = CHAPTERS.find((c) => c.year === year);
    expect(chapter, `a chapter starts in ${year}`).toBeDefined();
    await scrollToChapter(page, chapter!);
    await expect(page.locator(root)).toHaveAttribute('data-car', car);
  }

  expect(errors).toEqual([]);
});

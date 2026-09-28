import { expect, test } from '@playwright/test';
import { collectErrors, root, scrollToChapter, visit } from './support';

test('the rally chapter shows the Forester on a gravel stage, captioned without embellishment', async ({ page }) => {
  const errors = collectErrors(page);
  await visit(page, '/');

  // Every step inside the rally span, reached by scrolling, carries the Forester.
  const cars = await page.evaluate(async () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const rootEl = document.querySelector('app-root')!;
    const seen = new Set<string>();
    for (let i = 0; i <= 400; i++) {
      window.scrollTo(0, (max * i) / 400);
      await new Promise(requestAnimationFrame);
      if (rootEl.getAttribute('data-chapter') === 'rally') seen.add(rootEl.getAttribute('data-car')!);
      else if (seen.size) break;
    }
    return [...seen];
  });
  expect(cars).toEqual(['forester']);

  await scrollToChapter(page, 'rally');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'forester');
  await expect(page.locator('.card__meta')).toHaveText('2008 – 2013');
  await expect(page.locator('.card__body')).toHaveText('Amateur rally: occasional non-pro events, 2008–2013');

  // Let the camera settle on the stage before the screenshot.
  await page.waitForTimeout(2000);
  await test.info().attach('rally', { body: await page.screenshot(), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

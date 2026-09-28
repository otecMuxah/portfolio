import { Page, expect, test } from '@playwright/test';
import { root, scrollJourney, scrollToChapter } from './support';

/** Scroll through the whole journey in small steps and return each distinct car shown, in order. */
async function carsWhileScrolling(page: Page, direction: 'forward' | 'back'): Promise<string[]> {
  return page.evaluate(async (dir) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const rootEl = document.querySelector('app-root')!;
    const seen: string[] = [];
    for (let i = 0; i <= 250; i++) {
      window.scrollTo(0, (max * (dir === 'forward' ? i : 250 - i)) / 250);
      await new Promise(requestAnimationFrame);
      const car = rootEl.getAttribute('data-car')!;
      if (seen.at(-1) !== car) seen.push(car);
    }
    return seen;
  }, direction);
}

test('the car he owned carries the camera, swapping as the scrolled year passes each purchase', async ({ page }) => {
  test.setTimeout(90_000); // two full scroll sweeps plus the chapter scan, one frame per step
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');

  const owned = ['none', 'golf2', 'mazda323f', 'mazda3', 'forester', 'f30'];
  // The garage finale shows all five side by side, so nothing carries the camera there.
  expect(await carsWhileScrolling(page, 'forward')).toEqual([...owned, 'none']);
  expect(await carsWhileScrolling(page, 'back')).toEqual([...owned, 'none'].reverse());

  // Mid-family is 2009: the Forester (2008) has already replaced the Mazda 3 the chapter opened with.
  await scrollToChapter(page, 'family');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'forester');
  await scrollJourney(page, 0);
  await expect(page.locator(root)).toHaveAttribute('data-car', 'none');

  expect(errors).toEqual([]);
});

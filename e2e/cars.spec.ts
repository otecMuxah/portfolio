import { Page, expect, test } from '@playwright/test';
import { collectErrors, root, scrollJourney, scrollToChapter, visit } from './support';

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
  const errors = collectErrors(page);
  await visit(page, '/');

  const owned = ['none', 'golf2', 'mazda323f', 'mazda3', 'forester', 'f30'];
  expect(await carsWhileScrolling(page, 'forward')).toEqual(owned);
  expect(await carsWhileScrolling(page, 'back')).toEqual([...owned].reverse());

  // Mid-family is 2007: still the Mazda 3; the Forester (2008) arrives with the rally chapter.
  await scrollToChapter(page, 'family');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'mazda3');
  await scrollJourney(page, 0);
  await expect(page.locator(root)).toHaveAttribute('data-car', 'none');

  expect(errors).toEqual([]);
});

import { Page, expect, test } from '@playwright/test';
import { CARS, CHAPTERS } from '../src/app/content/life';
import { collectErrors, root, scrollToChapter, visit } from './support';

const spinner = (page: Page, name: string) =>
  page.getByRole('slider', { name: `Spin the ${name}`, exact: true });

test('the journey ends in the garage, the last phase, reached by scrolling', async ({ page }) => {
  const errors = collectErrors(page);
  expect(CHAPTERS.at(-1)!.phase).toBe('garage');
  await visit(page, '/');
  await scrollToChapter(page, 'garage');
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'garage');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'none');

  // Every car is labelled with its model, colour and the year he owned it from.
  for (const car of CARS) {
    const label = page.locator(`#garage-${car.id}`);
    await expect(label).toBeVisible();
    await expect(label).toContainText(car.name);
    await expect(label).toContainText(
      new RegExp(`${car.colour} · owned from ${car.fromYear}`, 'i'),
    );
    await expect(spinner(page, car.name)).toBeVisible();
  }
  await page.screenshot({ path: test.info().outputPath('garage.png') });

  // Sideways swipes spin a car; vertical ones and the mouse wheel over a car still scroll the page.
  await expect(spinner(page, 'Mazda 3')).toHaveCSS('touch-action', 'pan-y');
  await spinner(page, 'Mazda 3').hover();
  await page.mouse.wheel(0, -2500);
  await expect(page.locator(root)).not.toHaveAttribute('data-phase', 'garage');
  // Out of the garage, its controls go.
  await expect(page.getByRole('slider')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the timeline flies to the garage', async ({ page }) => {
  const errors = collectErrors(page);
  await visit(page, '/');
  await page
    .getByRole('navigation', { name: 'Timeline' })
    .getByRole('link', { name: /Garage/ })
    .click();
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'garage');
  await expect(page).toHaveURL(/#garage$/);
  // The last car drops in once the eased camera arrives, which under load takes a while after the scroll does.
  await expect(spinner(page, 'BMW 320d F30')).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

test('a car spins by drag and by keyboard, without errors or leaving the garage', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await visit(page, '/#garage');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'garage');

  const f30 = spinner(page, 'BMW 320d F30');
  // hover() waits for the control to stop moving, i.e. for the camera to settle on the garage.
  await f30.hover();
  const box = (await f30.boundingBox())!;
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(f30).not.toHaveAttribute('aria-valuenow', '0');

  const golf = spinner(page, 'VW Golf 2');
  await golf.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(golf).toHaveAttribute('aria-valuenow', '45');
  await page.keyboard.press('ArrowLeft');
  await expect(golf).toHaveAttribute('aria-valuetext', '30 degrees');
  await page.keyboard.press('Home');
  await expect(golf).toHaveAttribute('aria-valuenow', '0');
  // The arrow keys turned the car; they did not fly the journey back a chapter.
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'garage');
  await page.screenshot({ path: test.info().outputPath('garage-spun.png') });
  expect(errors).toEqual([]);
});

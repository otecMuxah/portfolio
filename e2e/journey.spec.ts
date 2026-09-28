import { Page, expect, test } from '@playwright/test';
import { root, scrollJourney, scrollToChapter } from './support';

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('scrolling walks the visitor through each chapter in order', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto('/');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');
  await expect(page.getByRole('heading', { name: 'Born in Kharkiv' })).toBeVisible();
  await expect(page.locator(root)).toHaveAttribute('data-car', 'none');

  await scrollToChapter(page, 'first-code');
  await expect(page.getByRole('heading', { name: 'Self-taught, first job' })).toBeVisible();
  // Mid first-code the scrolled year is past 2013, so the F30 has arrived.
  await expect(page.locator(root)).toHaveAttribute('data-car', 'f30');

  await scrollToChapter(page, 'iata');
  await expect(page.getByRole('heading', { name: 'IATA' })).toBeVisible();
  await expect(page.locator('.card__meta')).toHaveText('2024 – now · Frankfurt');
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'rebuild');

  await scrollJourney(page, 1);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'garage');
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'garage');

  await scrollJourney(page, 0);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  expect(errors).toEqual([]);
});

test('the war chapter tells the night of 24 February 2022, with no placeholder flag', async ({ page }) => {
  await page.goto('/#war');
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'shatter');
  await expect(page.getByRole('heading', { name: '24.02.2022' })).toBeVisible();
  await expect(page.locator('.card')).toContainText('4 a.m. Explosions.');
  await expect(page.locator('.card')).not.toContainText('Placeholder');
});

test('the timeline highlights the current chapter and clicking an item flies there', async ({ page }) => {
  const errors = collectErrors(page);
  const timeline = page.getByRole('navigation', { name: 'Timeline' });

  await page.goto('/');
  await expect(timeline).toBeVisible();
  await expect(timeline.getByRole('link', { name: /Birth/ })).toHaveAttribute('aria-current', 'step');

  await timeline.getByRole('link', { name: /Kraków/ }).click();
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'krakow');
  await expect(timeline.getByRole('link', { name: /Kraków/ })).toHaveAttribute('aria-current', 'step');
  await expect(timeline.getByRole('link', { name: /Birth/ })).not.toHaveAttribute('aria-current');
  await expect(page).toHaveURL(/#krakow$/);
  await expect(timeline).toBeInViewport();

  await timeline.getByRole('link', { name: /School/ }).click();
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'school');

  expect(errors).toEqual([]);
});

test('a chapter deep link lands on that chapter', async ({ page }) => {
  const errors = collectErrors(page);

  await page.goto('/#ciklum');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'ciklum');
  await expect(page.locator(root)).toHaveAttribute('data-car', 'f30');
  await expect(page.getByRole('heading', { name: 'Ciklum: starting from scratch' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('arrow and page keys move between chapters; Tab reaches timeline items', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  await page.keyboard.press('ArrowDown');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'school');
  await page.keyboard.press('PageDown');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'lyceum');
  await page.keyboard.press('PageUp');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'school');
  await page.keyboard.press('ArrowUp');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Skip to CV' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('navigation', { name: 'Timeline' }).getByRole('link').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'school');
});

test('arrow and page keys stay with text fields and scroll the open CV dialog', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  await page.evaluate(() => {
    const input = document.body.appendChild(document.createElement('input'));
    input.id = 'field';
    input.value = 'abc';
    input.style.cssText = 'position: fixed; top: 0; left: 0';
  });
  const field = page.locator('#field');
  await field.focus();
  await field.evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 3));
  await field.press('ArrowLeft');
  expect(await field.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(2);
  await page.waitForTimeout(500);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  await page.getByRole('button', { name: 'Skip to CV' }).click();
  const cv = page.getByRole('dialog', { name: 'CV' });
  await expect(cv).toBeVisible();
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(500);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');
  await expect.poll(() => cv.evaluate((d) => d.scrollTop)).toBeGreaterThan(0);
});

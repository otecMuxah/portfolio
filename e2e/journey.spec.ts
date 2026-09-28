import { Page, expect, test } from '@playwright/test';

const root = 'app-root';

/** Scroll the journey to a progress between 0 and 1. */
async function scrollJourney(page: Page, progress: number) {
  await page.evaluate((p) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, max * p);
  }, progress);
}

test('scrolling walks the visitor through each chapter in order', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');
  await expect(page.getByRole('heading', { name: 'Born in Kharkiv' })).toBeVisible();
  await expect(page.locator(root)).toHaveAttribute('data-car', 'none');

  await scrollJourney(page, 0.5);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'first-code');
  await expect(page.getByRole('heading', { name: 'Self-taught, first job' })).toBeVisible();
  await expect(page.locator(root)).toHaveAttribute('data-car', 'forester');

  await scrollJourney(page, 1);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'iata');
  await expect(page.getByRole('heading', { name: 'IATA' })).toBeVisible();
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'rebuild');

  await scrollJourney(page, 0);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  expect(errors).toEqual([]);
});

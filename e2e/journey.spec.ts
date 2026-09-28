import { expect, test } from '@playwright/test';
import { root, scrollJourney, scrollToChapter } from './support';

test('scrolling walks the visitor through each chapter in order', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');
  await expect(page.getByRole('heading', { name: 'Born in Kharkiv' })).toBeVisible();
  await expect(page.locator(root)).toHaveAttribute('data-car', 'none');

  await scrollToChapter(page, 'first-code');
  await expect(page.getByRole('heading', { name: 'Self-taught, first job' })).toBeVisible();
  await expect(page.locator(root)).toHaveAttribute('data-car', 'forester');

  await scrollJourney(page, 1);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'iata');
  await expect(page.getByRole('heading', { name: 'IATA' })).toBeVisible();
  await expect(page.locator('.card__meta')).toHaveText('2024 – now · Frankfurt');
  await expect(page.locator(root)).toHaveAttribute('data-phase', 'rebuild');

  await scrollJourney(page, 0);
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

  expect(errors).toEqual([]);
});

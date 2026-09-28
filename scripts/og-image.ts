import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });

test('capture the hero scene as the Open Graph image', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('app-root')).toHaveAttribute('data-scene', 'ready');
  // Keep the scene, name and title; drop the controls, the chapter card and the age, which would go stale.
  await page.addStyleTag({
    content: '.skip-cv, .timeline, .card, .hero__tagline, .hero__contacts { visibility: hidden; }',
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'public/og-image.png' });
});

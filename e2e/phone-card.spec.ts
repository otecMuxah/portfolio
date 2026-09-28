import { expect, test } from '@playwright/test';
import { collectErrors, root, scrollToChapter, visit } from './support';

for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test.describe(`on a ${viewport.width}x${viewport.height} phone`, () => {
    test.use({ viewport });

    test('the card starts folded to its title and opens and closes by tap and keyboard', async ({ page }) => {
      const errors = collectErrors(page);
      await visit(page, '/');
      const toggle = page.getByRole('button', { name: 'Chapter details' });
      const body = page.locator('.card__body');

      await expect(page.locator('.card__title')).toBeVisible();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toHaveAttribute('aria-controls', 'card-details');
      await expect(body).toBeHidden();

      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(body).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(body).toBeHidden();

      // The whole head is the tap target.
      const title = (await page.locator('.card__title').boundingBox())!;
      await page.mouse.click(title.x + 10, title.y + title.height / 2);
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.mouse.click(title.x + 10, title.y + title.height / 2);
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');

      // Enter and Space work the button and leave the journey where it is.
      await toggle.focus();
      await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(body).toBeVisible();
      await page.keyboard.press('Space');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(body).toBeHidden();
      await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');

      expect(errors).toEqual([]);
    });

    test('an opened card stays open across chapters, and a reload folds it again', async ({ page }) => {
      const errors = collectErrors(page);
      await visit(page, '/');
      const toggle = page.getByRole('button', { name: 'Chapter details' });
      await toggle.click();

      await scrollToChapter(page, 'kharkiv-career');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('.card__highlights li').first()).toBeVisible();
      await expect(page.locator('.card__skills').first()).toBeVisible();
      // Folded, the card hides the chapter's roles with the rest of its details.
      await toggle.click();
      await expect(page.locator('.card__role').first()).toBeHidden();
      await toggle.click();

      await page.reload();
      await expect(page.locator(root)).toHaveAttribute('data-scene', 'ready');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator('.card__body')).toBeHidden();
      // The screen-reader story keeps every chapter's full text.
      await expect(page.locator('.story__item')).toHaveCount(await page.locator('.story__title').count());
      await expect(page.locator('.story__body').first()).toHaveText('26 May 1981.');

      expect(errors).toEqual([]);
    });

    test('the card opens without animating under reduced motion', async ({ page }) => {
      const duration = () => page.locator('.card__details').evaluate((el) => getComputedStyle(el).transitionDuration);
      await visit(page, '/');
      expect(await duration()).not.toMatch(/^0s(, 0s)*$/);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(await duration()).toMatch(/^0s(, 0s)*$/);
    });
  });
}

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('the card shows in full with no toggle', async ({ page }) => {
    const errors = collectErrors(page);
    await visit(page, '/#kharkiv-career');
    await expect(page.locator(root)).toHaveAttribute('data-chapter', 'kharkiv-career');
    await expect(page.getByRole('button', { name: 'Chapter details' })).toBeHidden();
    await expect(page.locator('.card__body')).toBeVisible();
    await expect(page.locator('.card__highlights li').first()).toBeVisible();
    await expect(page.locator('.card__skills').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

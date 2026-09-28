import { expect, test } from '@playwright/test';
import { collectErrors, root, scrollToChapter } from './support';

const EVIDENCE = 'docs/analysis/6-evidence';

const CAREER = [
  {
    id: 'first-code',
    shot: '01-first-code',
    title: 'Self-taught, first job',
    company: 'Webholder',
  },
  {
    id: 'kharkiv-career',
    shot: '02-kharkiv-career',
    title: 'The Kharkiv career years',
    company: 'TEAM International',
  },
  {
    id: 'krakow',
    shot: '03-krakow',
    title: 'Kraków: leading the front end',
    company: 'Corporate Finance Institute',
  },
  { id: 'back-home', shot: '04-back-home', title: 'Back to Kharkiv', company: null },
];

test('each career chapter shows its card and scene with no console errors', async ({ page }) => {
  // Four chapters, each waiting for the camera to settle before its screenshot.
  test.setTimeout(90_000);
  const errors = collectErrors(page);

  await page.goto('/');
  for (const { id, shot, title, company } of CAREER) {
    await scrollToChapter(page, id);
    const card = page.locator('.card');
    await expect(card.locator('.card__title')).toHaveText(title);
    if (company) {
      await expect(card.locator('.card__company').filter({ hasText: company })).toBeVisible();
      await expect(card.locator('.card__highlights li').first()).toBeVisible();
    }
    // The camera eases toward the scroll target; let it settle before the shot.
    await page.waitForTimeout(3000);
    await page.locator('canvas.scene').screenshot({ path: `${EVIDENCE}/${shot}.png` });
  }
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'back-home');

  expect(errors).toEqual([]);
});

test('the Kharkiv career card lists the skills that orbit the skyline', async ({ page }) => {
  await page.goto('/#kharkiv-career');
  const onCard = page.locator('.card__skills');
  await expect(onCard).toBeVisible();
  for (const skill of ['Angular', 'TypeScript', 'RxJS']) await expect(onCard).toContainText(skill);
  // The screen-reader story carries the same list.
  await expect(page.getByRole('list', { name: 'Skills' })).toContainText('RxJS');
});

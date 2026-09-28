import { expect, test } from '@playwright/test';
import { root, scrollToChapter } from './support';

const EVIDENCE = 'docs/analysis/6-evidence';

const CAREER = [
  {
    id: 'first-code',
    shot: '01-first-code',
    heading: 'Self-taught, first job',
    company: 'Webholder',
  },
  {
    id: 'kharkiv-career',
    shot: '02-kharkiv-career',
    heading: 'The Kharkiv career years',
    company: 'TEAM International',
  },
  {
    id: 'krakow',
    shot: '03-krakow',
    heading: 'Kraków: leading the front end',
    company: 'Corporate Finance Institute',
  },
  {
    id: 'back-home',
    shot: '04-back-home',
    heading: 'Back to Kharkiv',
    company: 'Corporate Finance Institute',
  },
];

test('each career chapter shows its card and scene with no console errors', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  for (const { id, shot, heading, company } of CAREER) {
    await scrollToChapter(page, id);
    const card = page.locator('.card');
    await expect(card.getByRole('heading', { name: heading })).toBeVisible();
    await expect(card.getByRole('heading', { name: company }).first()).toBeVisible();
    await expect(card.locator('.card__highlights li').first()).toBeVisible();
    // The camera eases toward the scroll target; let it settle before the shot.
    await page.waitForTimeout(6000);
    await page.locator('canvas.scene').screenshot({ path: `${EVIDENCE}/${shot}.png` });
  }
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'back-home');

  expect(errors).toEqual([]);
});

test('the Kharkiv career card lists the skills that orbit the skyline', async ({ page }) => {
  await page.goto('/#kharkiv-career');
  const skills = page.getByRole('list', { name: 'Skills' });
  await expect(skills).toContainText('Angular');
  await expect(skills).toContainText('TypeScript');
  await expect(skills).toContainText('RxJS');
});

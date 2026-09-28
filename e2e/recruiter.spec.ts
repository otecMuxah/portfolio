import { readFile } from 'node:fs/promises';
import { Page, expect, test } from '@playwright/test';
import { CV_PDF_PUBLISHED } from '../src/app/content/cv';
import { scrollToChapter } from './support';

const skipToCv = (page: Page) => page.getByRole('button', { name: 'Skip to CV' });
const downloadCv = (page: Page) =>
  page.getByRole('dialog', { name: 'CV' }).getByRole('link', { name: 'Download CV (PDF)' });

async function expectCvShown(page: Page) {
  const cv = page.getByRole('dialog', { name: 'CV' });
  await expect(cv).toBeVisible();
  await expect(
    cv.getByRole('heading', { name: /International Air Transport Association/ }),
  ).toBeVisible();
  await expect(cv.getByText('2024 - Present')).toBeVisible();
  await expect(cv.getByText(/delivered 138 Jira stories/i)).toBeVisible();
  await expect(cv.getByRole('heading', { name: /Webholder/ })).toBeAttached();
  await expect(cv.getByText(/Java 25, Spring Boot 4/)).toBeAttached();
  await expect(cv.getByRole('link', { name: 'otecmuxah@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:otecmuxah@gmail.com',
  );
}

test('the hero names Mykhailo, his title and his age as of today', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-25T12:00:00'));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('44 years, one journey.');
  const hero = page.locator('app-hero');
  await expect(hero.getByText('Mykhailo Maliavin', { exact: true })).toBeVisible();
  await expect(hero.getByText('Lead Full-Stack Engineer', { exact: true })).toBeVisible();

  await page.clock.setFixedTime(new Date('2026-05-26T12:00:00'));
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('45 years, one journey.');
});

test('Skip to CV opens the CV view from the hero', async ({ page }) => {
  await page.goto('/');
  await expect(skipToCv(page)).toBeInViewport();
  await skipToCv(page).click();
  await expectCvShown(page);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'CV' })).toBeHidden();
});

test('Skip to CV opens the CV view from mid-journey', async ({ page }) => {
  await page.goto('/');
  await scrollToChapter(page, 'first-code');
  await expect(skipToCv(page)).toBeInViewport();
  await skipToCv(page).click();
  await expectCvShown(page);
});

test('contact links are email, LinkedIn and GitHub, and no phone number is rendered', async ({
  page,
}) => {
  await page.goto('/');
  const contacts = page.getByRole('list', { name: 'Contact' }).first();
  await expect(contacts.getByRole('link', { name: 'Email' })).toHaveAttribute(
    'href',
    'mailto:otecmuxah@gmail.com',
  );
  await expect(contacts.getByRole('link', { name: 'Email' })).not.toHaveAttribute('target');
  await expect(contacts.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
    'href',
    'https://www.linkedin.com/in/mykhailo-maliavin',
  );
  await expect(contacts.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/otecMuxah',
  );

  await skipToCv(page).click();
  await expectCvShown(page);
  const html = await page.content();
  expect(html).not.toMatch(/tel:/i);
  expect(html).not.toMatch(/\+\d[\d\s().-]{7,}\d/);
  expect(html).not.toMatch(/\d{3}[\s.-]\d{4}[\s.-]\d{4}/);
});

test('the download link returns a PDF', async ({ page }) => {
  test.skip(!CV_PDF_PUBLISHED, 'CV_PDF_PUBLISHED is off until Mykhailo approves the PDF (#13)');
  await page.goto('/');
  await skipToCv(page).click();
  const [download] = await Promise.all([page.waitForEvent('download'), downloadCv(page).click()]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  const response = await page.request.get((await downloadCv(page).getAttribute('href'))!);
  expect(response.headers()['content-type']).toContain('application/pdf');
});

test('no CV download link is shown before the PDF is approved', async ({ page }) => {
  test.skip(CV_PDF_PUBLISHED, 'the PDF is published');
  await page.goto('/');
  await skipToCv(page).click();
  await expectCvShown(page);
  await expect(downloadCv(page)).toHaveCount(0);
});

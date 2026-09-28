import { Page, expect, test } from '@playwright/test';
import { collectErrors } from './support';

const TITLES = [
  'Born in Kharkiv',
  'School No. 126',
  'Physics and Mathematics Lyceum No. 27',
  "Two master's degrees",
  'Websites in Dreamweaver',
  'Family',
  'Self-taught, first job',
  'The Kharkiv career years',
  'Kraków: leading the front end',
  'Back to Kharkiv',
  '24.02.2022',
  'Ciklum: starting from scratch',
  'IATA',
  'The garage',
];

const story = (page: Page) => page.getByRole('list', { name: 'Life story' });

test('screen readers get every chapter in order, once, while the 3D journey runs', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('canvas.scene')).toBeVisible();
  await expect(story(page).getByRole('heading', { level: 2 })).toHaveText(TITLES);
  await expect(story(page).locator('> li').nth(10)).toContainText('4 a.m. Explosions.');
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(TITLES.length);
});

test('when the renderer cannot start despite WebGL, the list takes over', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      id: string,
      ...rest: unknown[]
    ) {
      return this.classList.contains('scene')
        ? null
        : getContext.call(this, id as '2d', ...(rest as []));
    } as typeof getContext;
  });
  const pageErrors: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => msg.type() === 'warning' && warnings.push(msg.text()));

  await page.goto('/');
  await expect(page.locator('canvas.scene')).toHaveCount(0);
  await expect(story(page).getByRole('heading').first()).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(warnings.filter((w) => w.includes('story list'))).toHaveLength(1);
});

test.describe('without WebGL', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        id: string,
        ...rest: unknown[]
      ) {
        return /webgl/i.test(id) ? null : getContext.call(this, id as '2d', ...(rest as []));
      } as typeof getContext;
    });
  });

  test('all chapter titles are visible in order, with no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');

    await expect(page.locator('canvas.scene')).toHaveCount(0);
    const headings = story(page).getByRole('heading', { level: 2 });
    await expect(headings).toHaveText(TITLES);
    for (const heading of await headings.all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
    }
    expect(errors).toEqual([]);
  });

  test('a chapter deep link lands on that chapter in the list', async ({ page }) => {
    await page.goto('/#war');
    await expect(story(page).locator('#war')).toContainText('24.02.2022');
    await expect(story(page).locator('#war')).toBeInViewport();
    await expect(story(page).locator('#birth')).not.toBeInViewport();
  });

  test('Skip to CV and the contact links work', async ({ page }) => {
    await page.goto('/');
    const contacts = page.getByRole('list', { name: 'Contact' }).first();
    await expect(contacts.getByRole('link', { name: 'Email' })).toHaveAttribute(
      'href',
      'mailto:otecmuxah@gmail.com',
    );
    await expect(contacts.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      'https://www.linkedin.com/in/mykhailo-maliavin',
    );
    await expect(contacts.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/otecMuxah',
    );
    await contacts.getByRole('link', { name: 'GitHub' }).click({ trial: true });

    await page.mouse.wheel(0, 3000);
    await page.getByRole('button', { name: 'Skip to CV' }).click();
    const cv = page.getByRole('dialog', { name: 'CV' });
    await expect(cv).toBeVisible();
    await expect(
      cv.getByRole('heading', { name: /International Air Transport Association/ }),
    ).toBeVisible();
  });
});

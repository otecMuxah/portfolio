import { Page, expect, test } from '@playwright/test';

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

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

test('screen readers get every chapter in order while the 3D journey runs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas.scene')).toBeVisible();
  await expect(story(page).getByRole('listitem').getByRole('heading')).toHaveText(TITLES);
  await expect(story(page).getByRole('listitem').nth(10)).toContainText('4 a.m. Explosions.');
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
    const headings = story(page).getByRole('listitem').getByRole('heading');
    await expect(headings).toHaveText(TITLES);
    for (const heading of await headings.all()) {
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
    }
    expect(errors).toEqual([]);
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

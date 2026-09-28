import { expect, test } from '@playwright/test';
import { root } from './support';

const SITE = 'https://otecmuxah.github.io/portfolio/';

test('the served HTML carries the name, title and first chapter before any script runs', async ({ request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toContain('Mykhailo Maliavin');
  expect(html).toContain('Lead Full-Stack Engineer');
  expect(html).toContain('Born in Kharkiv');
  expect(html).toContain('26 May 1981.');
  expect(html).toMatch(/role="progressbar"/);
  // The age is computed in the visitor's browser; a prerendered number would go stale.
  expect(html).toMatch(/<h1[^>]*>(\s|<!--[^>]*-->)*one journey\.\s*<\/h1>/);
});

test('title, description, canonical and social preview tags are set', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Mykhailo Maliavin · Lead Full-Stack Engineer');

  const meta = (selector: string) => page.locator(`head ${selector}`);
  await expect(meta('meta[name="description"]')).toHaveAttribute('content', /Lead Full-Stack Engineer/);
  await expect(meta('link[rel="canonical"]')).toHaveAttribute('href', SITE);
  await expect(meta('meta[property="og:type"]')).toHaveAttribute('content', 'website');
  await expect(meta('meta[property="og:url"]')).toHaveAttribute('content', SITE);
  await expect(meta('meta[property="og:title"]')).toHaveAttribute('content', /Mykhailo Maliavin/);
  await expect(meta('meta[property="og:description"]')).toHaveAttribute('content', /Lead Full-Stack Engineer/);
  await expect(meta('meta[property="og:image"]')).toHaveAttribute('content', `${SITE}og-image.png`);
  await expect(meta('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
  await expect(meta('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
  await expect(meta('meta[property="og:image:alt"]')).toHaveAttribute('content', /.+/);
  await expect(meta('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  await expect(meta('meta[name="twitter:title"]')).toHaveAttribute('content', /Mykhailo Maliavin/);
  await expect(meta('meta[name="twitter:description"]')).toHaveAttribute('content', /Lead Full-Stack Engineer/);
  await expect(meta('meta[name="twitter:image"]')).toHaveAttribute('content', `${SITE}og-image.png`);

  // The image the tags point at ships with the site, at the size they claim.
  const image = await request.get('/og-image.png');
  expect(image.headers()['content-type']).toBe('image/png');
  const png = await image.body();
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);

  // No phone number in the tags previews and crawlers read.
  const tags = await page.locator('head meta').evaluateAll((els) => els.map((el) => el.getAttribute('content') ?? ''));
  expect(tags.join('\n')).not.toMatch(/\+?\d[\d ()-]{7,}\d|tel:/i);
});

test('a loader shows progress until the 3D scene is ready, without hiding the first chapter', async ({ page }) => {
  // Hold the app bundle back so the loader state is observable, as on a slow connection.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/main[^/]*\.js$/, async (route) => {
    await held;
    await route.continue();
  });

  await page.goto('/', { waitUntil: 'commit' });
  const loader = page.getByRole('progressbar', { name: 'Loading the 3D journey' });
  await expect(loader).toBeVisible();
  // Screen readers and crawlers get the first chapter while the scene loads.
  await expect(page.getByRole('heading', { name: 'Born in Kharkiv' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('one journey.');

  release();
  await expect(loader).toBeHidden();
  await expect(page.locator(root)).toHaveAttribute('data-scene', 'ready');
  await expect(page.getByRole('heading', { name: 'Born in Kharkiv' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^\d+ years, one journey\.$/);
});

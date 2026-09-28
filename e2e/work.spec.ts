import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { ChapterId, DOMAIN_TEXT } from '../src/app/content/life';
import { chapterSpans } from '../src/app/journey/journey';
import { chapterMoment, workSteps } from '../src/app/scene/work/work-layer';
import { collectErrors, root, scrollJourney, visit } from './support';

const EVIDENCE = 'docs/analysis/50-evidence';
const CAREER: ChapterId[] = [
  'first-code',
  'kharkiv-career',
  'krakow',
  'back-home',
  'ciklum',
  'iata',
];

interface SceneInfo {
  geometries: number;
  textures: number;
  settled: boolean;
  built: boolean;
}

const sceneInfo = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

/** Journey progress at which a chapter's company step `k` stands alone, facing the camera. */
function stepProgress(id: ChapterId, k: number): number {
  const span = chapterSpans().find((s) => s.chapter.id === id)!;
  return span.start + (span.end - span.start) * chapterMoment(id, k);
}

/** Scrolls, snaps the eased camera there and lets it render, so every pass draws exactly the same frames. */
async function snapTo(page: Page, progress: number): Promise<void> {
  await scrollJourney(page, progress);
  await page.evaluate(async (p) => {
    (window as unknown as { __sceneJump: (p: number) => void }).__sceneJump(p);
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
  }, progress);
}

const STEPS = CAREER.flatMap((id) => workSteps(id).map((role, k) => ({ id, k, role })));

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const { id, k, role } of STEPS) {
    test(`${id} step ${k + 1}: the card names ${role.company} with its stack, and the scene turns to it`, async ({
      page,
    }) => {
      const errors = collectErrors(page);
      await visit(page, '/');
      await expect.poll(async () => (await sceneInfo(page)).built, { timeout: 30_000 }).toBe(true);
      await snapTo(page, stepProgress(id, k));
      await expect(page.locator(root)).toHaveAttribute('data-chapter', id);
      const section = page
        .locator('.card__role')
        .filter({ has: page.locator('.card__company', { hasText: role.company }) });
      await expect(section).toBeVisible();
      await expect(section.locator('.card__skills li')).toHaveText(role.tech);
      if (role.domain)
        await expect(section.locator('.card__position').nth(1)).toHaveText(DOMAIN_TEXT.en[role.domain]);
      else await expect(section.locator('.card__position')).toHaveCount(1);
      await expect
        .poll(async () => (await sceneInfo(page)).settled, { timeout: 15_000 })
        .toBe(true);
      await page.screenshot({
        path: `${EVIDENCE}/${id}-${k + 1}-${role.company.replace(/\W+/g, '-')}.png`,
      });
      expect(errors).toEqual([]);
    });
  }

  test('the screen-reader story lists every company’s stack under its name', async ({ page }) => {
    await visit(page, '/');
    // A company met in two chapters (CFI in Kraków and back home) has a list in each, in story order.
    const seen = new Map<string, number>();
    for (const { role } of STEPS) {
      const n = seen.get(role.company) ?? 0;
      seen.set(role.company, n + 1);
      const list = page.getByRole('list', { name: `Technologies at ${role.company}` }).nth(n);
      await expect(list).toBeAttached();
      await expect(list.getByRole('listitem')).toHaveText(role.tech);
    }
  });

  test('two passes over every company step allocate no new GPU geometry or textures', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await visit(page, '/');
    await expect.poll(async () => (await sceneInfo(page)).built, { timeout: 30_000 }).toBe(true);
    // Every company step, among even steps down the whole journey, so the war between the steps plays too.
    const progress = [
      ...STEPS.map(({ id, k }) => stepProgress(id, k)),
      ...Array.from({ length: 29 }, (_, i) => i / 28),
    ];
    progress.sort((a, b) => a - b);
    const pass = async () => {
      for (const p of [...progress, ...[...progress].reverse()]) await snapTo(page, p);
      const { geometries, textures } = await sceneInfo(page);
      return { geometries, textures };
    };
    const first = await pass();
    const second = await pass();
    writeFileSync(`${EVIDENCE}/memory.json`, JSON.stringify({ first, second }, null, 2));
    expect(second).toEqual(first);
    expect(errors).toEqual([]);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const [id, k] of [
    ['kharkiv-career', 1],
    ['ciklum', 0],
  ] as const) {
    test(`${id} step ${k + 1} reads on a phone`, async ({ page }) => {
      const errors = collectErrors(page);
      await visit(page, '/');
      await expect.poll(async () => (await sceneInfo(page)).built, { timeout: 30_000 }).toBe(true);
      await snapTo(page, stepProgress(id, k));
      const company = page.locator('.card__company', { hasText: workSteps(id)[k].company });
      // The card starts folded to its title, leaving the scene to the sign and the ring.
      await expect(company).toBeHidden();
      await expect
        .poll(async () => (await sceneInfo(page)).settled, { timeout: 15_000 })
        .toBe(true);
      await page.screenshot({ path: `${EVIDENCE}/phone-${id}-${k + 1}.png` });
      await page.getByRole('button', { name: 'Chapter details' }).click();
      await expect(company).toBeVisible();
      await page
        .locator('.card')
        .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));
      await page.screenshot({ path: `${EVIDENCE}/phone-${id}-${k + 1}-open.png` });
      expect(errors).toEqual([]);
    });
  }
});

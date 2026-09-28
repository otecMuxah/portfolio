import { mkdirSync, writeFileSync } from 'node:fs';
import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { collectErrors, root, scrollJourney, scrollToChapter, visit } from './support';

const EVIDENCE = 'docs/analysis/6-evidence';

const CAREER = [
  { id: 'first-code', title: 'Self-taught, first job', company: 'Webholder' },
  { id: 'kharkiv-career', title: 'The Kharkiv career years', company: 'TEAM International' },
  { id: 'krakow', title: 'Kraków: leading the front end', company: 'Corporate Finance Institute' },
  { id: 'back-home', title: 'Back to Kharkiv', company: 'Corporate Finance Institute' },
];

interface SceneInfo {
  geometries: number;
  textures: number;
  settled: boolean;
  built: boolean;
}

/** The dev-build readout from the scene engine (see scene-engine.ts); absent from production bundles. */
const sceneInfo = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sceneInfo: () => SceneInfo }).__sceneInfo());

/** Scrolls, snaps the eased camera there and lets it render, so every pass draws exactly the same frames. */
async function snapTo(page: Page, progress: number): Promise<void> {
  await scrollJourney(page, progress);
  await page.evaluate(async (p) => {
    (window as unknown as { __sceneJump: (p: number) => void }).__sceneJump(p);
    for (let i = 0; i < 2; i++) await new Promise(requestAnimationFrame);
  }, progress);
}

/** Waits for the eased camera to reach the scroll position, then shoots the canvas. */
async function shoot(page: Page, name: string): Promise<void> {
  await expect.poll(async () => (await sceneInfo(page)).settled, { timeout: 15_000 }).toBe(true);
  await page.locator('canvas.scene').screenshot({ path: `${EVIDENCE}/${name}.png` });
}

/** Where a chapter's framing is exact: the middle of its scroll span. */
const midpoint = (id: string) => {
  const span = chapterSpans().find((s) => s.chapter.id === id)!;
  return (span.start + span.end) / 2;
};

test.use({ viewport: { width: 1440, height: 900 } });
test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

for (const [i, { id, title, company }] of CAREER.entries()) {
  test(`the ${id} chapter shows its card and scene without errors`, async ({ page }) => {
    const errors = collectErrors(page);
    await visit(page, '/');
    await scrollToChapter(page, id);
    await scrollJourney(page, midpoint(id));
    const card = page.locator('.card');
    await expect(card.locator('.card__title')).toHaveText(title);
    await expect(card.locator('.card__company').filter({ hasText: company })).toBeVisible();
    await expect(card.locator('.card__highlights li').first()).toBeVisible();
    await shoot(page, `0${i + 1}-${id}`);
    expect(errors).toEqual([]);
  });
}

test('the Kharkiv career card lists the skills that orbit the skyline', async ({ page }) => {
  await page.goto('/#kharkiv-career');
  const onCard = page.locator('.card__skills');
  await expect(onCard).toBeVisible();
  for (const skill of ['Angular', 'TypeScript', 'RxJS']) await expect(onCard).toContainText(skill);
  // The screen-reader story carries the same list.
  await expect(page.getByRole('list', { name: 'Skills' })).toContainText('RxJS');
});

test('two full scroll passes through the career chapters allocate no new GPU geometry or textures', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await visit(page, '/');
  await expect(page.locator(root)).toHaveAttribute('data-chapter', 'birth');
  await expect.poll(async () => (await sceneInfo(page)).built, { timeout: 15_000 }).toBe(true);

  const sample = async () => {
    const { geometries, textures } = await sceneInfo(page);
    const heap = await page.evaluate(
      () =>
        (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize ?? null,
    );
    return {
      geometries,
      textures,
      heapMB: heap === null ? null : Math.round((heap / 1048576) * 10) / 10,
    };
  };
  // Down and back up through the whole journey, pausing on each step so the camera renders it.
  const pass = async () => {
    for (let i = 0; i <= 28; i++) {
      await snapTo(page, i / 28);
    }
    for (let i = 28; i >= 0; i--) {
      await snapTo(page, i / 28);
    }
    return sample();
  };

  const start = await sample();
  const first = await pass();
  const second = await pass();
  writeFileSync(`${EVIDENCE}/memory.json`, JSON.stringify({ start, first, second }, null, 2));

  expect(second.geometries).toBe(first.geometries);
  expect(second.textures).toBe(first.textures);
  expect(errors).toEqual([]);
});

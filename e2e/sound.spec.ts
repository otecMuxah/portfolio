import { Page, expect, test } from '@playwright/test';
import { chapterSpans } from '../src/app/journey/journey';
import { warSpan } from '../src/app/sound/mix';
import { collectErrors, ready, scrollJourney, visit } from './support';

const WAR = warSpan(chapterSpans());
const toggle = (page: Page) => page.getByRole('button', { name: 'Sound' });

interface AudioSpy {
  contexts: number;
  plays: number;
  gains: GainNode[];
}

/** Count every way the page could make a sound, and keep the gain nodes it creates in order. */
async function spyOnAudio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spy = { contexts: 0, plays: 0, gains: [] as GainNode[] };
    (window as unknown as { audioSpy: typeof spy }).audioSpy = spy;
    const Real = window.AudioContext;
    window.AudioContext = class extends Real {
      constructor(options?: AudioContextOptions) {
        super(options);
        spy.contexts++;
      }
      override createGain(): GainNode {
        const gain = super.createGain();
        spy.gains.push(gain);
        return gain;
      }
    };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      spy.plays++;
      return play.call(this);
    };
  });
}

const audioSpy = (page: Page) =>
  page.evaluate(() => {
    const { contexts, plays } = (window as unknown as { audioSpy: AudioSpy }).audioSpy;
    return { contexts, plays, audioElements: document.querySelectorAll('audio, video').length };
  });

/** The soundtrack's bus gains: master, ambient and rumble are the first three it creates. */
const busGains = (page: Page) =>
  page.evaluate(() => {
    const [master, ambient, rumble] = (window as unknown as { audioSpy: AudioSpy }).audioSpy.gains;
    return { master: master.gain.value, ambient: ambient.gain.value, rumble: rumble.gain.value };
  });

test('sound is off and nothing audio exists until the visitor turns it on', async ({ page }) => {
  const errors = collectErrors(page);
  await spyOnAudio(page);

  await visit(page, '/');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.click(700, 450);
  await page.keyboard.press('ArrowDown');
  await scrollJourney(page, 0.5);
  expect(await audioSpy(page)).toEqual({ contexts: 0, plays: 0, audioElements: 0 });

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect(await audioSpy(page)).toEqual({ contexts: 1, plays: 0, audioElements: 0 });

  expect(errors).toEqual([]);
});

test('the sound choice is kept across a reload, and starts only on a gesture', async ({ page }) => {
  const errors = collectErrors(page);
  await spyOnAudio(page);

  await visit(page, '/');
  await toggle(page).focus();
  await page.keyboard.press('Enter');
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await ready(page);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
  expect((await audioSpy(page)).contexts).toBe(0);
  await page.mouse.click(700, 450);
  expect((await audioSpy(page)).contexts).toBe(1);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await ready(page);
  await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
  await page.mouse.click(700, 450);
  expect((await audioSpy(page)).contexts).toBe(0);

  expect(errors).toEqual([]);
});

test('the war chapter ducks the ambient under a rumble, then falls silent', async ({ page }) => {
  const errors = collectErrors(page);
  await spyOnAudio(page);
  await visit(page, '/');
  await toggle(page).click();
  const at = (local: number) => WAR.start + (WAR.end - WAR.start) * local;
  /** Scroll there and wait for the ramps to settle on the expected levels. */
  const expectMix = async (
    progress: number,
    ambient: 'full' | 'silent',
    rumble: 'full' | 'silent',
  ) => {
    await scrollJourney(page, progress);
    await expect
      .poll(async () => {
        const gains = await busGains(page);
        return [
          gains.ambient > 0.45 ? 'full' : gains.ambient < 0.01 ? 'silent' : 'moving',
          gains.rumble > 0.8 ? 'full' : gains.rumble < 0.01 ? 'silent' : 'moving',
        ];
      })
      .toEqual([ambient, rumble]);
  };

  await expectMix(WAR.start / 2, 'full', 'silent');
  await expectMix(at(0.35), 'silent', 'full');
  await expectMix(at(0.85), 'silent', 'silent');
  await expectMix(WAR.back, 'full', 'silent');
  // Scrolling back into the war brings the rumble back.
  await expectMix(at(0.35), 'silent', 'full');

  expect(errors).toEqual([]);
});

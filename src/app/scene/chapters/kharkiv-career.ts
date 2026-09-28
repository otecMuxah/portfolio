import * as THREE from 'three';
import { CHAPTER_TEXT } from '../../content/life';
import { enter, glow, leave, smoothstep } from '../art/kit';
import { PaletteKey } from '../art/palette';
import { ChapterBuilder } from '../chapter-scene';
import { risingSkyline, skylineWindows } from './kharkiv-city';
import { skillOrbit } from './skill-orbit';

/** One warm tint per token, in the card's skill order. */
const TINTS: PaletteKey[] = [
  'terracotta',
  'wheat',
  'homeWarm',
  'dawnGold',
  'brass',
  'candle',
  'brick',
];
// Around the top of Derzhprom's tower (its spire tops out near 10 m), centred on the tower.
const RING_Y = 9.5;
const RING_Z = -2.1;

/**
 * 2015–2021, the Kharkiv career years: the skyline in terracotta and wheat, with a ring of
 * skill badges above it that gains a badge and widens as the chapter plays.
 */
export const kharkivCareer: ChapterBuilder = () => {
  const object = new THREE.Group();
  const { skyline, rise } = risingSkyline({
    derzhprom: 'wheat',
    'panel-blocks': 'terracotta',
    'brick-blocks': 'brick',
  });
  const windowGlow = glow('candle', 0.9);
  const windows = new THREE.Mesh(skylineWindows(skyline, 0.35, 2015), windowGlow);

  const skills = CHAPTER_TEXT.en['kharkiv-career'].skills ?? [];
  const orbit = skillOrbit(skills.map((_, i) => TINTS[i % TINTS.length]));
  orbit.object.position.set(0, RING_Y, RING_Z);
  object.add(skyline, windows, orbit.object);

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      rise(built);
      const lit = smoothstep(0.85, 1, built) * (1 - 0.4 * leave(local));
      windows.visible = lit > 0;
      windowGlow.emissiveIntensity = 0.9 * lit;
      orbit.object.visible = built > 0.5;
      orbit.update(local, time);
    },
  };
};

import * as THREE from 'three';
import { enter, glow, leave, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';
import { risingSkyline, skylineWindows } from './kharkiv-city';

/**
 * 2015–2021, the Kharkiv career years: the skyline in terracotta and wheat. The companies and their stacks are the
 * work layer's (scene/work).
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
  object.add(skyline, windows);

  return {
    object,
    update({ local }) {
      const built = enter(local);
      rise(built);
      const lit = smoothstep(0.85, 1, built) * (1 - 0.4 * leave(local));
      windows.visible = lit > 0;
      windowGlow.emissiveIntensity = 0.9 * lit;
    },
  };
};

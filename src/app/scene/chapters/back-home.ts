import * as THREE from 'three';
import { enter, glow, halo, haloMap, leave, lightPool, seeded, smoothstep } from '../art/kit';
import { PALETTE } from '../art/palette';
import { ChapterBuilder } from '../chapter-scene';
import { risingSkyline, skylineWindows } from './kharkiv-city';

const EMBERS = 420;
const EMBER_TOP = 16;

/**
 * Early 2022, back home: the Kharkiv skyline returns, full and at its warmest. Most windows
 * are lit, a warm glow hangs over the city and embers of light drift up from it. The
 * fullest, warmest frame of the journey, just before the war.
 */
export const backHome: ChapterBuilder = (_chapter, _index, phone = false) => {
  const object = new THREE.Group();
  const windowGlow = glow('homeGlow', 1.6);
  const { skyline, rise } = risingSkyline(
    {
      derzhprom: 'homeGlow',
      'panel-blocks': 'homeWarm',
      'brick-blocks': 'terracotta',
    },
    windowGlow,
    phone,
  );
  const windows = new THREE.Mesh(skylineWindows(skyline, 0.75, 2022), windowGlow);

  // The city's glow: a wide halo behind Derzhprom and a pool of warm light on the ground.
  const sky = halo('homeWarm', 26, 0);
  sky.position.set(0, 7, -6);
  const pool = lightPool('homeGlow', 16, 9);
  pool.position.set(-1, 0.02, -2.5);

  // Embers: seeded columns of light rising over the city, looping on time (idle only).
  const random = seeded(2022);
  const base = new Float32Array(EMBERS * 3);
  for (let i = 0; i < EMBERS; i++) {
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(random());
    base[i * 3] = Math.cos(angle) * r * 8.5;
    base[i * 3 + 1] = random() * EMBER_TOP;
    // Kept behind z = 3, clear of the road on the front right.
    base[i * 3 + 2] = Math.min(-3 + Math.sin(angle) * r * 6, 3);
  }
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(base.slice(), 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  const emberMaterial = new THREE.PointsMaterial({
    color: PALETTE.homeGlow,
    map: haloMap(),
    size: 0.35,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const embers = new THREE.Points(geometry, emberMaterial);
  embers.frustumCulled = false;
  embers.renderOrder = 1;
  const positions = position.array as Float32Array;

  object.add(sky, pool, skyline, windows, embers);

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      const lit = smoothstep(0.7, 1, built);
      rise(built, lit);
      windows.visible = lit > 0;
      windowGlow.emissiveIntensity = 1.6 * lit * (1 - 0.3 * calm);
      sky.visible = pool.visible = embers.visible = lit > 0;
      sky.material.opacity = 0.45 * lit * (1 - 0.3 * calm);
      pool.material.opacity = 0.5 * lit;
      emberMaterial.opacity = 0.9 * lit * (1 - 0.4 * calm);
      // Heights only ever come from base + time, so the embers never drift out of the plot.
      for (let i = 0; i < EMBERS; i++) {
        const k = i * 3;
        positions[k + 1] = ((base[k + 1] + time * (0.4 + (i % 5) * 0.08)) % EMBER_TOP) * lit;
        positions[k] = base[k] + Math.sin(time * 0.5 + i) * 0.25;
      }
      position.needsUpdate = true;
    },
  };
};

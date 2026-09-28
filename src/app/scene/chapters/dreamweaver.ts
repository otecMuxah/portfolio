import * as THREE from 'three';
import { block, enter, glow, halo, leave, lightPool, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { PALETTE, PaletteKey } from '../art/palette';
import { ChapterBuilder } from '../chapter-scene';

const DESK_TOP = 2.95;
const SCREEN_W = 3.9;
const SCREEN_H = 3;
const SCREEN_Y = DESK_TOP + 2.35;
/** The CRT's front face, in the monitor's own frame; the screen and its page sit just proud of it. */
const SCREEN_Z = 1.62;
/** Where the monitor stands on the desk, turned towards the road (front-right) so its deep tube reads as a CRT. */
const MONITOR_Z = -3.1;
const MONITOR_TURN = 0.4;

/** A year-2000 page, in the order it types in: [left, bottom, width, height] on the screen, centred on it, and colour. */
const PAGE: [number, number, number, number, PaletteKey][] = [
  [-1.8, 1.05, 3.6, 0.32, 'brick'],
  [-1.8, -1.35, 0.7, 2.25, 'sandstone'],
  ...[0.72, 0.46, 0.2, -0.06, -0.32, -0.58].map(
    (y, i) => [-0.9, y, [1.5, 1.35, 1.55, 1.2, 2.5, 2.1][i], 0.12, 'chalk'] as [number, number, number, number, PaletteKey],
  ),
  [0.82, -0.2, 0.98, 1.02, 'dawnGold'],
  [-0.9, -1.35, 2.7, 0.2, 'brass'],
];

/** 2000: a beige CRT on a desk, its screen typing in a year-2000 website built from flat coloured rectangles. */
export const dreamweaver: ChapterBuilder = () => {
  const object = new THREE.Group();
  const set = new THREE.Group();
  object.add(set);

  set.add(
    mergedMesh(
      [block(12, 0.35, 8, 0, -3, DESK_TOP - 0.35), ...[-5.6, 5.6].flatMap((x) => [block(0.35, DESK_TOP - 0.35, 0.35, x, -6.6), block(0.35, DESK_TOP - 0.35, 0.35, x, 0.6)])],
      lowPoly('brass'),
    ),
    mergedMesh(
      [
        // Keyboard and mouse.
        block(5.2, 0.25, 1.7, -0.3, -0.25, DESK_TOP),
        block(0.45, 0.2, 0.7, 3.2, -0.2, DESK_TOP),
      ],
      lowPoly('crtBeige'),
    ),
  );
  const monitor = new THREE.Group();
  monitor.position.z = MONITOR_Z;
  monitor.rotation.y = MONITOR_TURN;
  monitor.add(
    mergedMesh(
      [
        // Bezel box, the deep tube behind it and a low foot.
        block(4.8, 4.1, 3.2, 0, 0, DESK_TOP + 0.3),
        block(3.6, 3.1, 2, 0, -2.4, DESK_TOP + 0.75),
        block(2.4, 0.3, 2.4, 0, -0.1, DESK_TOP),
      ],
      lowPoly('crtBeige'),
    ),
  );
  set.add(monitor);
  const keys: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 14; col++) keys.push(block(0.26, 0.1, 0.26, -2.25 + col * 0.33 - 0.3, -0.75 + row * 0.33, DESK_TOP + 0.25));
  }
  set.add(mergedMesh(keys, lowPoly('chalk')));

  const screenGlow = glow('screenGlow', 0);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenGlow);
  screen.position.set(0, SCREEN_Y, SCREEN_Z);
  monitor.add(screen);

  // One material per page colour; the rectangles only grow, their glow never changes.
  const pageMaterials = new Map<PaletteKey, THREE.MeshStandardMaterial>();
  const rects = PAGE.map(([left, bottom, w, h, key], i) => {
    if (!pageMaterials.has(key)) pageMaterials.set(key, glow(key, 0.9));
    // Anchored at its left edge, so growing scale.x reads as typing.
    const rect = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(w / 2, h / 2, 0), pageMaterials.get(key)!);
    rect.position.set(left, bottom, 0.01 + i * 0.001);
    screen.add(rect);
    return rect;
  });

  const scanMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.chalk,
    transparent: true,
    opacity: 0.12,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const scanLine = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, 0.14), scanMaterial);
  scanLine.position.z = 0.03;
  screen.add(scanLine);

  // No real light: a glow around the glass and its spill across the desk.
  const aura = halo('screenGlow', 6.5, 0);
  aura.position.set(0, SCREEN_Y, SCREEN_Z + 0.3);
  monitor.add(aura);
  const spill = lightPool('screenGlow', 6, 3.5);
  spill.position.set(0, DESK_TOP + 0.01, SCREEN_Z + 1.9);
  monitor.add(spill);

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      const placed = smoothstep(0.1, 0.4, built);
      set.visible = placed > 0;
      set.scale.setScalar(Math.max(placed, 1e-3));

      const power = smoothstep(0.25, 0.5, built);
      const typed = smoothstep(0.45, 1, built) * rects.length;
      rects.forEach((rect, i) => {
        const shown = Math.min(Math.max(typed - i, 0), 1);
        rect.visible = shown > 0;
        rect.scale.x = Math.max(shown, 1e-3);
      });

      // Idle only: a faint flicker and a scan line rolling down the glass.
      const flicker = 1 + (0.05 * Math.sin(time * 41) + 0.03 * Math.sin(time * 13.7)) * (1 - calm);
      screenGlow.emissiveIntensity = power * (0.55 - 0.15 * calm) * flicker;
      scanLine.visible = power > 0.5;
      scanLine.position.y = SCREEN_H / 2 - ((time * 0.35) % 1) * SCREEN_H;
      aura.material.opacity = power * (0.5 - 0.15 * calm) * flicker;
      spill.material.opacity = power * (0.3 - 0.1 * calm) * flicker;
    },
  };
};

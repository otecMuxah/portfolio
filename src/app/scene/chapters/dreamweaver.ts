import * as THREE from 'three';
import { block, enter, glow, halo, leave, lightPool, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { PALETTE, PaletteKey } from '../art/palette';
import { asDetail, box, detailMesh, merge, paint, place, shade, windowGrid } from '../art/details';
import { cable, chair, deskLamp, droop, roomCorner, shelf } from '../art/props';
import { bakeAO, contactShadows } from '../art/shading';
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
/** The set is built about four times life size: a 0.75 m desk stands 2.95 m. Props from the kit are scaled by it. */
const SCALE = 3.9;
/** The room's corner behind the desk: floor from x WEST to EAST and z BACK to FRONT; the walls stand on its west and back edges. */
const WEST = -8.2;
const EAST = 7;
const BACK = -8.2;
const FRONT = 3.8;
const WALL = 8.5;

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

/** A kit part at the set's scale. */
const big = (g: THREE.BufferGeometry) => g.scale(SCALE, SCALE, SCALE);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * 2000: a beige CRT on a desk, its screen typing in a year-2000 website built from flat coloured rectangles. The desk
 * stands in the corner of a room at night (#74): a curtained window, a shelf of books, a desk lamp, a kitchen chair
 * pulled out, the tower under the desk and the cables that tie them together.
 */
export const dreamweaver: ChapterBuilder = (_chapter, _index, phone = false) => {
  const object = new THREE.Group();
  const set = new THREE.Group();
  object.add(set);

  // The room: floor and two walls, the window in the side wall, the shelf on the back wall. It rises first.
  const room = new THREE.Group();
  const walls = place(
    roomCorner(EAST - WEST, FRONT - BACK, WALL, { floor: shade('brass', 0.55), wall: shade('crtBeige', 0.62), skirting: shade('brass', 0.35) }),
    (WEST + EAST) / 2,
    0,
    (BACK + FRONT) / 2,
  );
  bakeAO(walls, { corner: phone ? 0 : 1.2, fade: 3 });
  const pane = windowGrid({ columns: [2], rows: [3.6], width: 3.4, height: 4, frame: phone ? 0 : 0.14, sill: 0.4, lit: 0, glassTint: 'night' });
  const fittings = [
    place(pane.frames, WEST, 0, 0, Math.PI / 2),
    // Curtains drawn to either side of it.
    ...[-4.6, 0.6].map((z) => place(box(0.12, 5.2, 1.2, 'terracotta', 0.7), WEST + 0.08, 2.9, z)),
    place(box(0.1, 0.1, 6.4, 'soot'), WEST + 0.1, 8.1, -2),
    place(big(shelf(1.2, { shelves: 3, seed: 2000, low: phone })), 4.4, 5.4, BACK),
    // The wall socket the cables run to.
    place(box(0.5, 0.5, 0.08, 'chalk'), 1.4, 0.5, BACK),
  ];
  room.add(detailMesh(walls), detailMesh(bakeAO(merge(fittings), { corner: 0, fade: 1 })));
  object.add(room);

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

  // The CRT's secondary forms: vents across the top of its case, the power button and a blank badge on its bezel.
  const trim = [place(box(0.5, 0.18, 0.08, 'ash'), 1.7, DESK_TOP + 0.45, 1.6), place(box(0.7, 0.14, 0.05, 'brass', 0.8), -1.5, DESK_TOP + 0.47, 1.6)];
  if (!phone) for (let i = 0; i < 5; i++) trim.push(place(box(3.4, 0.05, 0.14, 'soot', 2), 0, DESK_TOP + 4.4, -1.35 + i * 0.28));
  monitor.add(detailMesh(trim));

  // On and around the desk: the lamp, a spindle of blank CDs, the tower on the floor, the chair, and the cables.
  const lamp = deskLamp({ shadeTint: 'steel' });
  const LAMP = v(-5, DESK_TOP, -1.6);
  const LAMP_TURN = 1.1;
  const monitorAt = (x: number, y: number, z: number) => v(x, y, z).applyAxisAngle(v(0, 1, 0), MONITOR_TURN).add(v(0, 0, MONITOR_Z));
  const TOWER = v(3.6, 0, -4.8);
  const props = [
    place(big(lamp.body), LAMP.x, LAMP.y, LAMP.z, LAMP_TURN),
    place(paint(new THREE.CylinderGeometry(0.28, 0.28, 0.36, 10), 'chalk', 0.9), 4.4, DESK_TOP + 0.18, -5.2),
    place(paint(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 5), 'soot'), 4.4, DESK_TOP + 0.3, -5.2),
    place(box(0.74, 1.68, 1.76, 'crtBeige', 0.95), TOWER.x, 0, TOWER.z),
    ...[1.25, 1.05].map((y) => place(box(0.56, 0.14, 0.04, 'ash'), TOWER.x, y, TOWER.z + 0.88)),
    place(box(0.12, 0.12, 0.04, 'soot'), TOWER.x, 0.7, TOWER.z + 0.88),
    place(big(chair('wooden', { tint: 'brass' })), -3.6, 0, 2.4, Math.PI + 0.45),
    // Video and power from the back of the tube, over the desk's back edge, down to the tower and the socket.
    cable([monitorAt(0.6, DESK_TOP + 0.9, -3.4), v(-0.6, DESK_TOP + 0.04, -6.6), v(-0.4, DESK_TOP + 0.04, -7.05), ...droop(v(-0.2, DESK_TOP - 0.2, -7.1), v(TOWER.x - 0.3, 1, TOWER.z - 0.9), 1.6, phone ? 2 : 4)], 0.08),
    cable([monitorAt(-0.6, DESK_TOP + 0.9, -3.4), v(-1.6, DESK_TOP + 0.04, -6.7), v(-1.5, DESK_TOP + 0.04, -7.05), ...droop(v(-1.3, DESK_TOP - 0.2, -7.1), v(1.4, 0.5, BACK + 0.05), 1.9, phone ? 2 : 4)], 0.08),
    // The keyboard's lead, across the desk and down the back to the tower.
    cable([v(-0.3, DESK_TOP + 0.1, -1.1), v(1.4, DESK_TOP + 0.04, -2.2), v(2.8, DESK_TOP + 0.04, -6.2), v(3.2, DESK_TOP + 0.04, -7.05), ...droop(v(3.3, DESK_TOP - 0.2, -7.1), v(TOWER.x, 1.3, TOWER.z - 0.9), 0.8, phone ? 1 : 3)], 0.06),
  ];
  set.add(detailMesh(bakeAO(merge(props), { corner: 0, fade: 1.2 })));
  const lampGlow = glow('candle', 0);
  set.add(detailMesh(place(big(lamp.lamp), LAMP.x, LAMP.y, LAMP.z, LAMP_TURN), lampGlow));
  const head = lamp.head.clone().multiplyScalar(SCALE).applyAxisAngle(v(0, 1, 0), LAMP_TURN).add(LAMP);
  const lampPool = asDetail(lightPool('candle', 4, 4));
  lampPool.position.set(head.x, DESK_TOP + 0.02, head.z + 0.3);
  set.add(lampPool);
  const shadows = contactShadows(
    [
      { x: 0, z: -3, w: 14, d: 10 },
      { x: TOWER.x, z: TOWER.z, w: 2, d: 2.6 },
      { x: -3.6, z: 2.4, w: 2.6, d: 2.6 },
    ],
    { opacity: 0.45 },
  );
  room.add(shadows);

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
      const walled = smoothstep(0, 0.35, built);
      room.visible = walled > 0;
      room.scale.y = Math.max(walled, 1e-3);
      shadows.material.opacity = 0.45 * walled;
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
      lampGlow.emissiveIntensity = power * (1.1 - 0.3 * calm);
      lampPool.material.opacity = power * (0.35 - 0.1 * calm);
    },
  };
};

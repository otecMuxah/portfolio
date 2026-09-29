import * as THREE from 'three';
import { asDetail, box, detailMesh, merge, paint, place, shade, windowGrid } from '../art/details';
import { enter, glow, halo, leave, lightPool, lowPoly, seeded, smoothstep } from '../art/kit';
import { cable, chair, deskLamp, droop, roomCorner, shelf } from '../art/props';
import { bakeAO, contactShadows } from '../art/shading';
import { ChapterBuilder } from '../chapter-scene';

const FACE_ROAD = 0.4;
const LINES = 8;
const LINE_HEIGHT = 0.3;
const SCREEN = { w: 3.8, h: 2.9, y: 4.6, z: 1.26 };
const GLYPH_ORBIT = { y: 8.2, spacing: 2.3, radius: 0.5 };
/** The desk is built about three and a half times life size (0.75 m stands 2.6 m); kit props are scaled by it. */
const SCALE = 3.47;
const DESK_TOP = 2.775;
/** The room's corner, square to the road rather than to the desk: floor from x WEST to EAST, z BACK to FRONT. */
const WEST = -7.8;
const EAST = 6.5;
const BACK = -7.2;
const FRONT = 3.8;
const WALL = 8.5;

const big = (g: THREE.BufferGeometry) => g.scale(SCALE, SCALE, SCALE);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A thin glowing bar, the stroke every glyph is built from. */
function bar(
  length: number,
  material: THREE.Material,
  x: number,
  y: number,
  angle: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, length, 0.2), material);
  mesh.position.set(x, y, 0);
  mesh.rotation.z = angle;
  return mesh;
}

/** `<`, `/` and `>` from boxes, no fonts. */
function glyphs(material: THREE.Material): THREE.Group[] {
  const arm = 1;
  const dx = (Math.cos(Math.PI / 6) * arm) / 2;
  const dy = (Math.sin(Math.PI / 6) * arm) / 2;
  const open = new THREE.Group().add(
    bar(arm, material, 0, dy, -Math.PI / 3),
    bar(arm, material, 0, -dy, Math.PI / 3),
  );
  const slash = new THREE.Group().add(bar(1.5, material, 0, 0, -0.38));
  const close = new THREE.Group().add(
    bar(arm, material, 0, dy, Math.PI / 3),
    bar(arm, material, 0, -dy, -Math.PI / 3),
  );
  open.children.forEach((c) => (c.position.x += dx / 2));
  close.children.forEach((c) => (c.position.x -= dx / 2));
  return [open, slash, close];
}

/**
 * 2012, first code: a dark desk, a terminal whose lines type themselves in as the
 * chapter enters, and `</>` rising out of the screen to orbit above it. The desk stands in the corner of a room at
 * night (#74): a window with blinds, a shelf of books, a desk lamp, an office chair pushed back, and the cables.
 */
export const firstCode: ChapterBuilder = (_chapter, _index, phone = false) => {
  const object = new THREE.Group();
  // Turned partway toward the road on the front right, so it reads head-on and from the 3/4 view.
  object.rotation.y = FACE_ROAD;
  const rig = new THREE.Group();
  object.add(rig);

  const desk = lowPoly('ground');
  const beige = lowPoly('crtBeige');
  const top = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.35, 3.4), desk);
  top.position.y = 2.6;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.45, 3), desk);
  legL.position.set(-3.9, 1.22, 0);
  const legR = legL.clone();
  legR.position.x = 3.9;
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.6, 2.4), beige);
  monitor.position.set(0, SCREEN.y, -0.05);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(SCREEN.w, SCREEN.h, 0.05), lowPoly('night'));
  screen.position.set(0, SCREEN.y, SCREEN.z - 0.04);
  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 0.9), beige);
  keyboard.position.set(0.2, 2.86, 1.15);
  keyboard.rotation.x = 0.06;
  rig.add(top, legL, legR, monitor, screen, keyboard);

  // The room, square to the road: it rises first. Walls, a window with blinds, the shelf, the chair.
  const room = new THREE.Group();
  room.rotation.y = -FACE_ROAD;
  object.add(room);
  const walls = place(
    roomCorner(EAST - WEST, FRONT - BACK, WALL, { floor: shade('wheat', 0.42), wall: shade('steel', 0.5), skirting: shade('chalk', 0.5) }),
    (WEST + EAST) / 2,
    0,
    (BACK + FRONT) / 2,
  );
  bakeAO(walls, { corner: phone ? 0 : 1.2, fade: 3 });
  const pane = windowGrid({ columns: [1.5], rows: [3.4], width: 3.2, height: 3.8, frame: phone ? 0 : 0.12, mullions: 0, transom: false, sill: 0.4, lit: 0, glassTint: 'night' });
  const fittings = [place(pane.frames, WEST, 0, 0, Math.PI / 2), place(big(shelf(1.1, { shelves: 3, seed: 2012, low: phone, tint: 'chalk' })), 3.6, 5.2, BACK)];
  // Blinds, half down.
  if (!phone) for (let i = 0; i < 7; i++) fittings.push(place(box(0.08, 0.05, 3.4, 'chalk', 0.8 - (i % 2) * 0.08), WEST + 0.12, 7.2 - i * 0.26, -1.5));
  fittings.push(place(big(chair('office', { tint: 'soot', frameTint: 'ash' })), -5.6, 0, 1.4, Math.PI / 2 + 0.3));
  room.add(detailMesh(walls), detailMesh(bakeAO(merge(fittings), { corner: 0, fade: 1 })), contactShadows([{ x: -5.6, z: 1.4, w: 2.8, d: 2.8 }], { opacity: 0.45 }));

  // On and under the desk: the lamp, a mug, the tower, a power strip, and the leads between them; a webcam and the
  // power light on the monitor.
  const lamp = deskLamp({ tint: 'ash', shadeTint: 'chalk' });
  const LAMP = v(-3.5, DESK_TOP, 0.2);
  const LAMP_TURN = 0.9;
  const TOWER = v(2.4, 0, -0.4);
  const props = [
    place(big(lamp.body), LAMP.x, LAMP.y, LAMP.z, LAMP_TURN),
    place(paint(new THREE.CylinderGeometry(0.16, 0.14, 0.36, 8), 'brick'), 2.9, DESK_TOP + 0.18, 0.5),
    place(box(0.06, 0.2, 0.14, 'brick', 0.8), 3.08, DESK_TOP + 0.08, 0.5),
    place(box(0.7, 1.56, 1.56, 'soot', 2.2), TOWER.x, 0, TOWER.z),
    place(box(0.1, 0.1, 0.04, 'screenGlow'), TOWER.x, 1.3, TOWER.z + 0.78),
    place(box(1.2, 0.14, 0.3, 'chalk', 0.8), -1.5, 0, -2.6),
    place(box(0.5, 0.22, 0.3, 'soot', 2), 0, SCREEN.y + 1.8, 0.4),
    place(box(0.12, 0.12, 0.04, 'terminal'), 1.9, SCREEN.y - 1.66, 1.16),
    cable([v(0.5, 3.2, -1.25), v(0.6, DESK_TOP + 0.03, -1.5), v(0.7, DESK_TOP + 0.03, -1.75), ...droop(v(0.8, DESK_TOP - 0.2, -1.8), v(TOWER.x, 0.9, TOWER.z - 0.8), 1.2, phone ? 2 : 4)], 0.07),
    cable([v(-0.5, 3.2, -1.25), v(-0.6, DESK_TOP + 0.03, -1.75), ...droop(v(-0.7, DESK_TOP - 0.2, -1.8), v(-1.2, 0.1, -2.6), 0.4, phone ? 1 : 3)], 0.07),
    cable([v(0.2, DESK_TOP + 0.08, 0.7), v(1.2, DESK_TOP + 0.03, -1.1), v(1.4, DESK_TOP + 0.03, -1.75), ...droop(v(1.5, DESK_TOP - 0.2, -1.8), v(TOWER.x - 0.2, 1.2, TOWER.z - 0.8), 0.6, phone ? 1 : 3)], 0.06),
    cable([v(TOWER.x - 0.2, 0.3, TOWER.z - 0.8), ...droop(v(TOWER.x - 0.4, 0.04, -2.2), v(-0.9, 0.04, -2.6), 0, 1)], 0.07),
  ];
  const lampGlow = glow('candle', 0);
  const lampPool = asDetail(lightPool('candle', 3.6, 3.6));
  const head = lamp.head.clone().multiplyScalar(SCALE).applyAxisAngle(v(0, 1, 0), LAMP_TURN).add(LAMP);
  lampPool.position.set(head.x, DESK_TOP + 0.02, head.z + 0.3);
  const deskShadow = contactShadows([{ x: 0, z: 0, w: 9, d: 3.6 }, { x: TOWER.x, z: TOWER.z, w: 1.8, d: 2.4 }], { opacity: 0.45 });
  rig.add(
    detailMesh(bakeAO(merge(props), { corner: 0, fade: 1.2 })),
    detailMesh(place(big(lamp.lamp), LAMP.x, LAMP.y, LAMP.z, LAMP_TURN), lampGlow),
    lampPool,
    deskShadow,
  );

  // Code lines, left-anchored so they grow rightwards as they type.
  const code = glow('terminal', 1.4);
  const lineGeometry = new THREE.BoxGeometry(1, 0.13, 0.04).translate(0.5, 0, 0);
  const rand = seeded(2012);
  const left = -SCREEN.w / 2 + 0.3;
  const lines = Array.from({ length: LINES }, (_, i) => {
    const indent =
      [0, 0.35, 0.7, 0.35][Math.floor(rand() * 4)] * (i === 0 || i === LINES - 1 ? 0 : 1);
    const width = 0.8 + rand() * (SCREEN.w - 1.3 - indent - 0.8);
    const mesh = new THREE.Mesh(lineGeometry, code);
    mesh.position.set(left + indent, SCREEN.y + SCREEN.h / 2 - 0.35 - i * LINE_HEIGHT, SCREEN.z);
    mesh.userData['width'] = width;
    rig.add(mesh);
    return mesh;
  });
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.04), code);
  rig.add(cursor);

  const tagMaterial = glow('terminal', 1.8);
  const tags = glyphs(tagMaterial);
  object.add(...tags);

  // The screen's spill is an additive halo, not a PointLight: no per-fragment cost across the world.
  const spill = halo('terminal', 9, 0);
  spill.position.set(0, SCREEN.y, SCREEN.z + 0.3);
  object.add(spill);

  const start = new THREE.Vector3(0, SCREEN.y, SCREEN.z);
  const orbit = new THREE.Vector3();
  let spin = 0;
  let lastTime = 0;

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      const walled = smoothstep(0, 0.35, built);
      room.visible = walled > 0;
      room.scale.y = Math.max(walled, 1e-3);
      rig.visible = built > 0.001;
      rig.scale.setScalar(0.7 + 0.3 * built);
      rig.position.y = -3 * (1 - built);

      // Typing runs from the moment the chapter is near until it is framed.
      const typed = smoothstep(-0.35, 0.45, local) * LINES;
      let cursorLine = 0;
      lines.forEach((line, i) => {
        const k = Math.min(Math.max(typed - i, 0), 1);
        line.visible = k > 0;
        line.scale.x = Math.max(k * line.userData['width'], 1e-3);
        if (k > 0) cursorLine = i;
      });
      const active = lines[cursorLine];
      cursor.position.set(active.position.x + active.scale.x + 0.14, active.position.y, SCREEN.z);
      cursor.visible = built > 0.001 && Math.sin(time * 6) > 0;

      const brightness = built * (1 - 0.55 * calm);
      code.emissiveIntensity = 1.4 * brightness;
      tagMaterial.emissiveIntensity = 1.8 * brightness;
      spill.material.opacity = 0.45 * brightness * (1 + 0.05 * Math.sin(time * 9));
      spill.visible = brightness > 0;
      lampGlow.emissiveIntensity = 1.1 * brightness;
      lampPool.material.opacity = 0.35 * brightness;

      // Idle orbit: the phase accumulates so slowing it after leave never jumps the tags.
      spin += (time - lastTime) * 0.35 * (1 - 0.7 * calm);
      lastTime = time;
      const rise = smoothstep(-0.1, 0.55, local);
      tags.forEach((tag, i) => {
        // Each tag circles its own slot in the `</>` row, so the row always reads front-on.
        const angle = spin + (i * Math.PI * 2) / 3;
        orbit.set(
          (i - 1) * GLYPH_ORBIT.spacing + Math.sin(angle) * GLYPH_ORBIT.radius,
          GLYPH_ORBIT.y + Math.cos(angle) * GLYPH_ORBIT.radius * 0.5,
          Math.cos(angle) * GLYPH_ORBIT.radius,
        );
        tag.position.lerpVectors(start, orbit, rise);
        tag.scale.setScalar(0.25 + 0.75 * rise);
        tag.visible = rise > 0;
        tag.rotation.y = Math.sin(angle) * 0.35 * rise;
      });
    },
  };
};

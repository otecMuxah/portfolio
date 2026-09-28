import * as THREE from 'three';
import { enter, glow, halo, leave, lowPoly, seeded, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';

const FACE_ROAD = 0.4;
const LINES = 8;
const LINE_HEIGHT = 0.3;
const SCREEN = { w: 3.8, h: 2.9, y: 4.6, z: 1.26 };
const GLYPH_ORBIT = { y: 8.2, spacing: 2.3, radius: 0.5 };

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
 * chapter enters, and `</>` rising out of the screen to orbit above it.
 */
export const firstCode: ChapterBuilder = () => {
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

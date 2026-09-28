import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Assembly, Piece, pieceMaterial, unit } from '../art/assembly';
import { block, halo, leave, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { PALETTE } from '../art/palette';
import { ChapterBuilder } from '../chapter-scene';

/**
 * The assembly runs over this stretch of the chapter, while the camera glides in: the tower stands by the time the
 * camera stops (0.5), with the crane still setting the low block, and all of it is done well before the camera leaves.
 */
const BUILD_FROM = 0.12;
const BUILD_TO = 0.66;

/**
 * The tower: three glass sections of three floors each, lined with light mullions and transoms, each section turned
 * further than the one below on a thin slab.
 */
const TOWER = new THREE.Vector3(-2.4, 0, -3.6);
const SECTIONS = 3;
const SECTION_FLOORS = 3;
const FLOOR = 1.05;
const SLAB = 0.08;
const TWIST = 0.2;
/**
 * The low block, front left of the tower: glass bars stacked askew, cantilevering over each other. Off the side the
 * camera leaves by (toward +x, -z), so nothing crowds it on the way out.
 */
const BARS = new THREE.Vector3(-5.2, 0, 3.6);
const BAR = 1.38;
/** Metres a floor is lowered from. */
const DROP = 2.5;

/** Brightness of the mullions against the glass they stand on (vertex colour, times the piece's own). */
const MULLION = 2.4;

/**
 * A unit glass section `floors` high: the pane box lined with thin light mullions at its corners and down each face,
 * and a transom at each floor, so it reads as curtain wall rather than a solid block.
 */
function glassSection(floors: number): THREE.BufferGeometry {
  const parts: [THREE.BufferGeometry, number][] = [[new THREE.BoxGeometry(1, 1, 1), 1]];
  for (let f = 1; f < floors; f++) {
    const y = f / floors - 0.5;
    parts.push(
      [new THREE.BoxGeometry(1.02, 0.02, 0.02).translate(0, y, 0.5), MULLION],
      [new THREE.BoxGeometry(1.02, 0.02, 0.02).translate(0, y, -0.5), MULLION],
      [new THREE.BoxGeometry(0.02, 0.02, 1.02).translate(0.5, y, 0), MULLION],
      [new THREE.BoxGeometry(0.02, 0.02, 1.02).translate(-0.5, y, 0), MULLION],
    );
  }
  for (const [x, z, w, d] of [
    [0.5, 0.5, 0.05, 0.05],
    [-0.5, 0.5, 0.05, 0.05],
    [0.5, -0.5, 0.05, 0.05],
    [-0.5, -0.5, 0.05, 0.05],
    [0, 0.5, 0.025, 0.03],
    [0, -0.5, 0.025, 0.03],
    [0.5, 0, 0.03, 0.025],
    [-0.5, 0, 0.03, 0.025],
  ]) {
    parts.push([new THREE.BoxGeometry(w, 1, d).translate(x, 0, z), MULLION]);
  }
  const flat = parts.map(([g, c]) => {
    const f = g.toNonIndexed().deleteAttribute('uv');
    f.setAttribute('color', new THREE.Float32BufferAttribute(new Array(f.getAttribute('position').count * 3).fill(c), 3));
    g.dispose();
    return f;
  });
  const merged = mergeGeometries(flat);
  flat.forEach((g) => g.dispose());
  return unit(merged);
}

/** The tower crane: mast at the plaza's back left, jib at JIB m, clear of the tower's top and every lowered block. */
const MAST = new THREE.Vector3(-8, 0, -2.5);
const JIB = 12.6;
const JIB_LENGTH = 14;

/**
 * 2022–2024, Ciklum: starting from scratch in Germany. Out of the dark a new place goes up block by block on a cool
 * blue plaza: a slender glass tower whose sections turn as they rise, a low block of glass bars stacked askew, and the
 * crane that lowers every piece. New architecture, cleaner and cooler than the city that broke; not the old one
 * restored. The crane is the one warm thing here: dawnGold, the journey's first colour, coming back.
 */
export const ciklum: ChapterBuilder = () => {
  const object = new THREE.Group();
  const box = unit(new THREE.BoxGeometry());
  const section = glassSection(SECTION_FLOORS);
  const pane = glassSection(1);
  const solid = pieceMaterial();
  // Cool blue glass that keeps its light while the colour is still coming back: lit from within as the place fills.
  const glass = pieceMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.15, emissive: PALETTE.dawnBlue, emissiveIntensity: 0 });

  // The plaza: the tower's ground, and a wing out front for the low block.
  const pieces: Piece[] = [
    { shape: box, material: solid, colour: 'steel', at: [-0.5, -0.25, -3.8], size: [15, 0.25, 9] },
    { shape: box, material: solid, colour: 'steel', at: [-4.6, -0.25, 3.4], size: [7.6, 0.25, 5.4] },
  ];
  const height = SECTION_FLOORS * FLOOR;
  for (let i = 0; i < SECTIONS; i++) {
    const y = i * height;
    const turn = i * TWIST;
    pieces.push(
      { shape: box, material: solid, colour: 'chalk', at: [TOWER.x, y, TOWER.z], size: [4.05, SLAB, 4.05], turn, drop: DROP },
      { shape: section, material: glass, colour: 'steel', at: [TOWER.x, y + SLAB, TOWER.z], size: [3.9, height - SLAB, 3.9], turn, drop: DROP },
    );
  }
  const top = SECTIONS * height;
  const crown = (SECTIONS - 1) * TWIST;
  pieces.push(
    { shape: box, material: solid, colour: 'chalk', at: [TOWER.x, top, TOWER.z], size: [4.05, 0.14, 4.05], turn: crown, drop: 1.5 },
    { shape: pane, material: glass, colour: 'glass', at: [TOWER.x, top + 0.14, TOWER.z], size: [2.2, 1, 2.2], turn: crown, drop: 0.8 },
  );
  for (let j = 0; j < 4; j++) {
    const x = BARS.x + (j % 2 ? 0.6 : -0.3);
    const turn = j % 2 ? 0.1 : -0.06;
    pieces.push(
      { shape: box, material: solid, colour: 'chalk', at: [x, j * BAR, BARS.z], size: [5, 0.12, 2.8], turn, drop: DROP },
      { shape: pane, material: glass, colour: 'steel', at: [x, j * BAR + 0.12, BARS.z], size: [4.7, BAR - 0.12, 2.5], turn, drop: DROP },
    );
  }
  pieces.push({ shape: box, material: solid, colour: 'chalk', at: [BARS.x + 0.6, 4 * BAR, BARS.z], size: [5, 0.12, 2.8], turn: 0.1, drop: DROP });
  const assembly = new Assembly(pieces, 1 / pieces.length, 0.3);

  // The crane: a mast that rises with the plaza, and a slewing top (jib, counter-jib, weight, cab, A-frame) above it.
  const yellow = lowPoly('dawnGold');
  const mast = mergedMesh([block(0.7, JIB, 0.7, 0, 0)], yellow);
  mast.position.copy(MAST);
  const slew = new THREE.Group();
  slew.position.set(MAST.x, JIB, MAST.z);
  const aFrame = new THREE.ConeGeometry(0.5, 2.2, 4).translate(0, 1.1, 0);
  slew.add(
    mergedMesh(
      [
        block(JIB_LENGTH, 0.45, 0.45, JIB_LENGTH / 2, 0),
        block(1.8, 0.45, 0.6, -0.9, 0),
        block(0.9, 0.9, 0.9, -1.35, 0, -0.9),
        block(0.8, 0.8, 0.8, 0.75, 0, -0.8),
        aFrame,
      ],
      yellow,
    ),
  );
  // Pendant lines from the A-frame's top to the jib and the counter-jib.
  const pendants = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 2.2, 0, 8, 0.4, 0, 0, 2.2, 0, -1.8, 0.4, 0], 3)),
    new THREE.LineBasicMaterial({ color: PALETTE.dawnGold }),
  );
  slew.add(pendants);
  // The trolley runs along the jib; the hook hangs from it on a cable, over the piece being lowered.
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.6), lowPoly('steel'));
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), lowPoly('steel'));
  const cablePosition = new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage);
  const cable = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', cablePosition), new THREE.LineBasicMaterial({ color: PALETTE.chalk }));
  cable.frustumCulled = false;

  // Dawn behind it: a wide, cool glow that comes up as the place does.
  const dawn = halo('dawnBlue', 34, 0);
  dawn.position.set(-3, 9, -10);
  object.add(dawn, assembly.object, mast, slew, trolley, hook, cable);

  const hookAt = new THREE.Vector3();
  const from = new THREE.Vector3();
  /** Where the hook hangs for piece `i` at assembly `k`: over its top as it is lowered, swinging to it in its lead. */
  const hookFor = (k: number, i: number, out: THREE.Vector3) => {
    assembly.baseAt(k, i, out);
    out.y += assembly.pieces[i].size[1] + 0.3;
    return out;
  };

  return {
    object,
    update({ local, time }) {
      const k = Math.min(Math.max((local - BUILD_FROM) / (BUILD_TO - BUILD_FROM), 0), 1);
      assembly.update(k);

      // The mast rises over the plaza's stretch; the top goes on once it stands.
      const raised = smoothstep(0, assembly.span, k);
      mast.visible = raised > 0;
      mast.scale.set(1, Math.max(raised, 1e-3), 1);
      const working = raised >= 1;
      slew.visible = trolley.visible = hook.visible = cable.visible = working;

      // The piece whose turn it is (the plaza's turn waits at the first floor), and how far into its turn.
      const n = assembly.pieces.length;
      const i = Math.min(Math.max(Math.floor(k * n), 1), n - 1);
      const into = Math.min(Math.max((k - assembly.start(i)) / assembly.span, 0), 1);
      hookFor(k, i, hookAt);
      if (into < assembly.lead && i > 1) {
        // Swing from over the last piece set to over this one, in the crane's own polar terms.
        hookFor(k, i - 1, from);
        const s = smoothstep(0, assembly.lead, into);
        const a0 = Math.atan2(from.z - MAST.z, from.x - MAST.x);
        const a1 = Math.atan2(hookAt.z - MAST.z, hookAt.x - MAST.x);
        const r0 = Math.hypot(from.x - MAST.x, from.z - MAST.z);
        const r1 = Math.hypot(hookAt.x - MAST.x, hookAt.z - MAST.z);
        const a = a0 + (a1 - a0) * s;
        const r = r0 + (r1 - r0) * s;
        hookAt.set(MAST.x + Math.cos(a) * r, from.y + (hookAt.y - from.y) * s, MAST.z + Math.sin(a) * r);
      }
      // Once the last piece is set the hook rises to rest under the jib.
      hookAt.y += (JIB - 1.5 - hookAt.y) * smoothstep(0.97, 1, k);
      // Idle only: the hook sways a little on its cable.
      hookAt.x += Math.sin(time * 0.9) * 0.05;
      const yaw = Math.atan2(hookAt.z - MAST.z, hookAt.x - MAST.x);
      const reach = Math.hypot(hookAt.x - MAST.x, hookAt.z - MAST.z);
      slew.rotation.y = -yaw;
      trolley.position.set(MAST.x + Math.cos(yaw) * reach, JIB - 0.35, MAST.z + Math.sin(yaw) * reach);
      hook.position.copy(hookAt).setY(hookAt.y + 0.2);
      cablePosition.setXYZ(0, trolley.position.x, trolley.position.y, trolley.position.z);
      cablePosition.setXYZ(1, hook.position.x, hook.position.y + 0.2, hook.position.z);
      cablePosition.needsUpdate = true;

      // Lights come on in the glass as the place fills, and the dawn comes up behind it.
      const calm = leave(local);
      glass.emissiveIntensity = (0.1 + 0.25 * smoothstep(0.3, 1, k)) * (1 - 0.4 * calm);
      dawn.visible = k > 0;
      dawn.material.opacity = 0.3 * smoothstep(0, 1, k) * (1 - 0.3 * calm);
    },
  };
};

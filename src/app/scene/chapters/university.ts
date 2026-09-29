import * as THREE from 'three';
import {
  arch,
  bench,
  box,
  canopy,
  chimney,
  cornice,
  detailMesh,
  door,
  gable,
  hipRoof,
  merge,
  paint,
  paintedMaterial,
  parapet,
  place,
  row,
  shade,
  steps,
  tree,
  windowGrid,
  WindowGrid,
} from '../art/details';
import { block, enter, glow, leave, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { bakeAO, contactShadows } from '../art/shading';
import { ChapterBuilder } from '../chapter-scene';

const FACE_ROAD = 0.4;

/**
 * Two schools either side of a courtyard, one per master's degree, each crowned with its emblem.
 *
 * Left, Business Management: the Main Auditorium Building of the Kharkiv Polytechnic Institute, vul. Kyrpychova 2
 * (1885, R. R. Henriksen; en/uk.wikipedia, Commons "Chief HAK"): three storeys of orange-red brick with white trim, a
 * projecting centre that rises into a gable edged in white, three arched windows on each upper floor and three
 * arched doors up a wide flight of granite steps; paired windows in the wings, a white band over the ground floor and
 * a white parapet at the eaves.
 *
 * Right, Jurisprudence: the Kharkiv National University of Internal Affairs, prosp. Lva Landau 27 (uk.wikipedia;
 * Commons "general view"): a white two-storey block under a red hipped roof, tall hall windows, and a glazed entrance
 * pavilion with the motto "Знання · Закон · Честь" over its door; blue spruces, columnar thujas, flower beds, benches
 * and a small white statue in the garden in front. Which of its buildings is the main one no source says; this is the
 * one pictured.
 */
const KHPI = { x: -3.55, w: 5.3, front: -2.6, d: 3.6, floor: 1.4, floors: 3 };
const KHPI_H = KHPI.floor * KHPI.floors;
const RISALIT = { w: 2.1, d: 0.35, h: KHPI_H + 0.35, gable: 1 };
const KHPI_FACE = KHPI.front + RISALIT.d;
const NUVS = { x: 3.9, w: 5, front: -3, d: 3.4, h: 3, roof: 1.1 };
const PAVILION = { x: 2.35, w: 1.7, d: 1.2, h: 2.7 };
const PAVILION_FACE = NUVS.front + PAVILION.d;
/** Where each crown lands: on the gable's apex, and on the pavilion's roof. */
const CROWN_TOPS = [RISALIT.h + RISALIT.gable + 0.05, PAVILION.h + 0.3];
const CROWN_AT: [number, number][] = [
  [KHPI.x, KHPI_FACE - 0.3],
  [PAVILION.x, NUVS.front + PAVILION.d / 2],
];

/** Business Management: a gear standing on its rim, facing the camera. */
function gear(): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(1.1, 1.1, 0.4, 16).rotateX(Math.PI / 2)];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(new THREE.BoxGeometry(0.42, 0.45, 0.4).translate(0, 1.25, 0).rotateZ(a));
  }
  return mergedMesh(parts, lowPoly('brass'));
}

/** Jurisprudence: balance scales, a post, a beam and two hanging pans. */
function scales(): { crown: THREE.Group; beam: THREE.Group; pans: THREE.Object3D[] } {
  const crown = new THREE.Group();
  crown.add(mergedMesh([block(0.9, 0.2, 0.9, 0, 0), block(0.24, 2.6, 0.24, 0, 0)], lowPoly('chalk')));
  const beam = new THREE.Group();
  beam.position.y = 2.5;
  beam.add(mergedMesh([block(3.4, 0.22, 0.22, 0, 0, -0.11), new THREE.IcosahedronGeometry(0.24, 0)], lowPoly('brass')));
  const pans = [-1.6, 1.6].map((x) => {
    const pan = new THREE.Group();
    pan.position.x = x;
    pan.add(
      mergedMesh(
        [block(0.06, 1.1, 0.06, -0.4, 0, -1.1), block(0.06, 1.1, 0.06, 0.4, 0, -1.1), new THREE.CylinderGeometry(0.7, 0.35, 0.3, 8).translate(0, -1.2, 0)],
        lowPoly('brass'),
      ),
    );
    beam.add(pan);
    return pan;
  });
  crown.add(beam);
  return { crown, beam, pans };
}

/** The motto over the pavilion's door, lettered on a canvas: dark blue on white, as on the building. */
function motto(width: number, height: number): THREE.Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = Math.round((512 * height) / width);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#eef2ef';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1f3a78';
  ctx.font = `700 ${Math.round(canvas.height * 0.62)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ЗНАННЯ · ЗАКОН · ЧЕСТЬ', canvas.width / 2, canvas.height / 2, canvas.width - 24);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
  sign.userData['detail'] = true;
  sign.name = 'motto';
  return sign;
}

/** The Polytechnic's Main Auditorium Building: its structure (which the war breaks) and its trim, windows and steps. */
function khpi(phone: boolean, ground: THREE.BufferGeometry) {
  const brick = shade('brick', 1.2);
  const white = 'chalk';
  const cz = KHPI.front - KHPI.d / 2;
  const structure = merge([
    place(box(KHPI.w, KHPI_H, KHPI.d, brick, 1, true), KHPI.x, 0, cz),
    place(box(RISALIT.w, RISALIT.h, RISALIT.d, brick, 1.04, true), KHPI.x, 0, KHPI.front + RISALIT.d / 2),
    place(paint(gable(RISALIT.w, RISALIT.gable, 0.5), brick, 1.04), KHPI.x, RISALIT.h, KHPI_FACE - 0.25),
  ]);
  bakeAO(structure, { occluders: [ground] });

  const granite = shade('gravel', 0.9);
  // The gable's white edge: a white gable a little larger behind the brick one, and a white band at its foot.
  const trim: THREE.BufferGeometry[] = [
    place(box(KHPI.w + 0.1, 0.35, KHPI.d + 0.1, granite, 1, true), KHPI.x, 0, cz),
    place(box(RISALIT.w + 0.1, 0.35, RISALIT.d + 0.05, granite, 1, true), KHPI.x, 0, KHPI.front + RISALIT.d / 2),
    place(paint(gable(RISALIT.w + 0.24, RISALIT.gable + 0.14, 0.4), white), KHPI.x, RISALIT.h - 0.02, KHPI_FACE - 0.32),
    place(box(RISALIT.w + 0.12, 0.12, RISALIT.d + 0.1, white), KHPI.x, RISALIT.h - 0.1, KHPI.front + RISALIT.d / 2),
    // The white band over the ground floor, the brick corbel frieze and the white parapet at the eaves.
    place(cornice(KHPI.w, KHPI.d, { tiers: 1, projection: 0.06, height: 0.09, tint: white }), KHPI.x, KHPI.floor, cz),
    place(cornice(RISALIT.w, RISALIT.d + 0.1, { tiers: 1, projection: 0.06, height: 0.09, tint: white }), KHPI.x, KHPI.floor, KHPI.front + 0.12),
    place(cornice(KHPI.w, KHPI.d, { tiers: 2, projection: 0.12, height: 0.2, tint: brick }), KHPI.x, KHPI_H - 0.2, cz),
    place(parapet(KHPI.w, KHPI.d, { height: 0.3, tint: white, coping: white, deck: 'slate' }), KHPI.x, KHPI_H, cz),
    // The big blind arch over the upper windows.
    place(arch(1.7, { thickness: 0.1, depth: 0.06, segments: phone ? 5 : 9, tint: white }), KHPI.x, RISALIT.h - 0.95, KHPI_FACE),
  ];

  const light = phone ? { frame: 0, mullions: 0, transom: false } : {};
  const grids: WindowGrid[] = [];
  const onWall = (grid: WindowGrid, x: number, z: number, rotation = 0) => {
    grids.push({ ...grid, frames: place(grid.frames, x, 0, z, rotation), lit: place(grid.lit, x, 0, z, rotation) });
  };
  const rows = Array.from({ length: KHPI.floors }, (_, f) => f * KHPI.floor + 0.45);
  // The wings: pairs of tall windows in white surrounds.
  const wing = (KHPI.w - RISALIT.w) / 2;
  const wings = [-1, 1].flatMap((s) => row(2, 0.52, KHPI.x + s * (RISALIT.w / 2 + wing / 2)));
  onWall(windowGrid({ columns: wings, rows, width: 0.34, height: 0.82, lit: 0.55, seed: 1885, frameTint: white, sillTint: white, ...light }), 0, KHPI.front);
  // The centre: three arched windows on each upper floor, three arched doors below.
  const centre = row(3, 0.6, KHPI.x);
  onWall(windowGrid({ columns: centre, rows: rows.slice(1), width: 0.36, height: 0.72, arched: true, lit: 0.6, seed: 1886, frameTint: white, sillTint: white, ...light }), 0, KHPI_FACE);
  onWall(
    windowGrid({ columns: row(2, 1.4, -cz), rows, width: 0.34, height: 0.82, lit: 0.5, seed: 1887, frameTint: white, sillTint: white, ...light }),
    KHPI.x + KHPI.w / 2,
    0,
    Math.PI / 2,
  );
  const sill = 0.35;
  const entrance = [
    place(steps(2.5, 4, sill, 0.22, granite), KHPI.x, 0, KHPI_FACE),
    ...centre.flatMap((x) => [
      place(door(0.38, 0.8, { double: true, glazed: true, leafTint: shade('brass', 0.5), frameTint: white }), x, sill, KHPI_FACE),
      place(arch(0.52, { thickness: 0.07, depth: 0.06, segments: phone ? 3 : 5, tint: white }), x, sill + 0.8, KHPI_FACE),
    ]),
  ];
  return { structure, frames: [...trim, ...grids.map((g) => g.frames), ...entrance], lit: grids.map((g) => g.lit) };
}

/** The University of Internal Affairs: white, a red hipped roof, the glazed pavilion with its motto. */
function nuvs(phone: boolean, ground: THREE.BufferGeometry) {
  const white = shade('chalk', 1.08);
  const cz = NUVS.front - NUVS.d / 2;
  const structure = merge([
    place(box(NUVS.w, NUVS.h, NUVS.d, white, 1, true), NUVS.x, 0, cz),
    place(box(PAVILION.w, PAVILION.h, PAVILION.d, white, 1.03, true), PAVILION.x, 0, NUVS.front + PAVILION.d / 2),
  ]);
  bakeAO(structure, { occluders: [ground] });

  const red = 'brick';
  const trim: THREE.BufferGeometry[] = [
    place(box(NUVS.w + 0.1, 0.3, NUVS.d + 0.1, shade('chalk', 0.72), 1, true), NUVS.x, 0, cz),
    place(box(PAVILION.w + 0.1, 0.3, PAVILION.d + 0.05, shade('chalk', 0.72), 1, true), PAVILION.x, 0, NUVS.front + PAVILION.d / 2),
    // The eaves and the roof.
    place(hipRoof(NUVS.w, NUVS.d, NUVS.roof, { tint: red, overhang: 0.25 }), NUVS.x, NUVS.h, cz),
    place(box(NUVS.w + 0.5, 0.08, NUVS.d + 0.5, shade(red, 0.8)), NUVS.x, NUVS.h - 0.08, cz),
    // The pavilion's low red roof, its motto band, and the canopy over its door.
    place(hipRoof(PAVILION.w, PAVILION.d, 0.3, { tint: red, overhang: 0.12 }), PAVILION.x, PAVILION.h, NUVS.front + PAVILION.d / 2),
    place(box(PAVILION.w + 0.24, 0.06, PAVILION.d + 0.24, shade(red, 0.8)), PAVILION.x, PAVILION.h - 0.06, NUVS.front + PAVILION.d / 2),
    place(canopy(0.95, 0.45, 1.05, { tint: 'chalk', posts: false, slab: 0.08 }), PAVILION.x, 0.3, PAVILION_FACE),
  ];
  if (!phone) trim.push(place(chimney(0.26, 0.45, 0.26, { tint: white, capTint: red }), NUVS.x + 1.2, NUVS.h + 0.55, cz - 0.4), place(chimney(0.26, 0.45, 0.26, { tint: white, capTint: red }), NUVS.x - 1.4, NUVS.h + 0.55, cz + 0.3));

  const light = phone ? { frame: 0, mullions: 0, transom: false } : {};
  const grids: WindowGrid[] = [];
  const onWall = (grid: WindowGrid, x: number, z: number, rotation = 0) => {
    grids.push({ ...grid, frames: place(grid.frames, x, 0, z, rotation), lit: place(grid.lit, x, 0, z, rotation) });
  };
  const frameTint = shade('chalk', 0.8);
  // The hall wing: tall windows through both storeys.
  const hall = row(4, 0.78, (PAVILION.x + PAVILION.w / 2 + NUVS.x + NUVS.w / 2) / 2);
  onWall(windowGrid({ columns: hall, rows: [0.5], width: 0.34, height: 2.1, lit: 0.6, seed: 1994, frameTint, sillTint: 'chalk', mullions: 0, ...light }), 0, NUVS.front);
  // The pavilion's glazed front, the door in its middle.
  onWall(
    windowGrid({
      columns: row(3, 0.5, PAVILION.x),
      rows: [0.35, 1.3],
      width: 0.42,
      height: 0.85,
      frame: phone ? 0 : 0.04,
      mullions: 0,
      transom: false,
      sill: 0,
      lit: 0.7,
      seed: 1995,
      frameTint: 'ash',
      skip: (c, r) => c === 1 && r === 0,
    }),
    0,
    PAVILION_FACE,
  );
  // The end wall toward the road, two storeys of windows.
  onWall(
    windowGrid({ columns: row(3, 0.95, -cz), rows: [0.5, 2], width: 0.4, height: 0.8, lit: 0.5, seed: 1996, frameTint, sillTint: 'chalk', ...light }),
    NUVS.x + NUVS.w / 2,
    0,
    Math.PI / 2,
  );
  const entrance = [place(door(0.44, 0.85, { double: true, glazed: true, leafTint: 'ash', frameTint: 'ash' }), PAVILION.x, 0.3, PAVILION_FACE), place(steps(1, 2, 0.3, 0.2), PAVILION.x, 0, PAVILION_FACE)];
  return { structure, frames: [...trim, ...grids.map((g) => g.frames), ...entrance], lit: grids.map((g) => g.lit) };
}

/** 1998–2004: the Polytechnic and the University of Internal Affairs across a courtyard, crowned with a gear and with scales. */
export const university: ChapterBuilder = (_chapter, _index, phone = false) => {
  const object = new THREE.Group();

  // The ground, which the war breaks: the lawn. Its edge, the paving and the beds are dressing.
  const ground = merge([place(paint(new THREE.PlaneGeometry(12.8, 8).rotateX(-Math.PI / 2), 'meadow'), 0, 0, -3)]);
  const paving = shade('concrete', 1.15);
  const courtX = (KHPI.x + KHPI.w / 2 + PAVILION.x - PAVILION.w / 2) / 2;
  const edges = merge([
    place(box(12.8, 0.24, 8, 'meadow', 0.72, true), 0, -0.25, -3),
    // The walk along the front, the courtyard between the two, and the red paving before the pavilion.
    place(box(12.8, 0.03, 0.9, paving, 1, true), 0, 0, 0.45),
    place(box(1.9, 0.03, 5.4, paving, 1, true), courtX, 0, -3.5),
    place(box(2.6, 0.03, 1.2, paving, 1, true), KHPI.x, 0, -0.9),
    place(box(PAVILION.w + 0.6, 0.03, 1.6, shade('terracotta', 0.7), 1, true), PAVILION.x, 0, PAVILION_FACE + 0.8),
    // Flower beds, yellow and red, either side of the pavilion's paving.
    place(box(1.6, 0.1, 0.3, 'sandstone', 1, true), PAVILION.x + 2.1, 0, -1.4),
    place(box(1.1, 0.1, 0.3, 'terracotta', 1, true), PAVILION.x + 1.9, 0, -0.9),
  ]);

  const a = khpi(phone, ground);
  const b = nuvs(phone, ground);
  const structures = [a.structure, b.structure];
  const buildings = [a, b].map(({ structure, frames, lit }) => {
    const facade = merge(frames);
    bakeAO(facade, { occluders: [...structures, ground], corner: phone ? 0 : 0.3 });
    const glowing = glow('candle', 0);
    const group = new THREE.Group().add(new THREE.Mesh(structure, paintedMaterial()), detailMesh(facade), detailMesh(merge(lit), glowing));
    object.add(group);
    return { group, glowing };
  });
  const sign = motto(1.5, 0.22);
  sign.position.set(PAVILION.x, 2.3, PAVILION_FACE + 0.02);
  buildings[1].group.add(sign);

  // The garden: blue spruces, columnar thujas along the courtyard, a bench, and the small white statue.
  const blue = new THREE.Color('#4f6f7a');
  const thuja = (seed: number, x: number, z: number) => place(tree('conifer', seed, { height: 1.5, low: true }).scale(0.55, 1, 0.55), x, 0, z);
  const gardenParts = [
    place(tree('conifer', 31, { height: 3.8, low: phone, foliage: blue }), -6, 0, -1.1),
    place(tree('conifer', 32, { height: 3.2, low: phone, foliage: blue }), courtX, 0, -6.2),
    thuja(33, courtX - 0.75, -1.9),
    thuja(34, courtX + 0.75, -1.9),
    // The statue: a figure on a plinth.
    place(box(0.36, 0.5, 0.36, 'chalk', 0.9), courtX, 0, -4),
    place(box(0.16, 0.5, 0.12, 'chalk'), courtX, 0.5, -4),
    place(paint(new THREE.IcosahedronGeometry(0.08, 0), 'chalk'), courtX, 1.08, -4),
  ];
  if (!phone) {
    gardenParts.push(
      thuja(35, courtX - 0.75, -3),
      thuja(36, courtX + 0.75, -3),
      place(bench(1.1), courtX + 0.7, 0, -4.9, -Math.PI / 2),
      place(bench(1.1), 5.7, 0, -1.2, Math.PI + 0.2),
    );
  }
  const gardenGeometry = merge(gardenParts);
  bakeAO(gardenGeometry, { corner: 0, fade: 1 });
  const garden = new THREE.Group().add(detailMesh(gardenGeometry));

  const shadows = contactShadows(
    [
      { x: KHPI.x, z: KHPI.front - KHPI.d / 2 + 0.3, w: KHPI.w + 1.4, d: KHPI.d + 2 },
      { x: NUVS.x, z: NUVS.front - NUVS.d / 2 + 0.3, w: NUVS.w + 1.4, d: NUVS.d + 2 },
      { x: -6, z: -1.1, w: 2.2, d: 2.2 },
      { x: courtX, z: -6.2, w: 2, d: 2 },
    ],
    { opacity: 0.5 },
  );
  const grounds = new THREE.Group().add(new THREE.Mesh(ground, paintedMaterial()), detailMesh(bakeAO(edges, { corner: 0 })));
  object.add(grounds, shadows, garden);

  const cog = gear();
  const gearCrown = new THREE.Group();
  gearCrown.add(cog);
  cog.position.y = 1.5;
  const { crown: scalesCrown, beam, pans } = scales();
  const crowns = [gearCrown, scalesCrown];
  crowns.forEach((c, i) => {
    c.position.set(CROWN_AT[i][0], CROWN_TOPS[i], CROWN_AT[i][1]);
    // Half-turned towards the road, so both read head-on and from the front-right.
    c.rotation.y = FACE_ROAD;
    object.add(c);
  });

  let turn = 0;
  let lastTime = 0;

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      const laid = smoothstep(0.1, 0.3, built);
      grounds.visible = laid > 0;
      shadows.visible = laid > 0;
      buildings.forEach(({ group, glowing }, i) => {
        const rise = smoothstep(0.1 + 0.2 * i, 0.55 + 0.2 * i, built);
        group.visible = rise > 0;
        group.scale.y = Math.max(rise, 1e-3);
        glowing.emissiveIntensity = smoothstep(0.55 + 0.1 * i, 0.9, built) * (1 - 0.4 * calm);
      });
      shadows.material.opacity = 0.5 * smoothstep(0.1, 0.55, built);
      const grow = smoothstep(0.3, 0.8, built);
      garden.visible = grow > 0;
      garden.scale.y = Math.max(grow, 1e-3);
      crowns.forEach((c, i) => {
        const land = smoothstep(0.7 + 0.1 * i, 0.9 + 0.1 * i, built);
        c.visible = land > 0;
        c.scale.setScalar(Math.max(land, 1e-3));
        c.position.y = CROWN_TOPS[i] + 2.5 * (1 - land);
      });
      const idle = 1 - 0.7 * calm;
      // Accumulated, so calming the idle on leave slows the gear without a jump.
      turn += Math.min(time - lastTime, 0.1) * 0.3 * idle;
      lastTime = time;
      cog.rotation.z = turn;
      beam.rotation.z = Math.sin(time * 0.7) * 0.09 * idle;
      for (const pan of pans) pan.rotation.z = -beam.rotation.z;
    },
  };
};

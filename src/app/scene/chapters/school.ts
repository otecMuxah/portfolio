import * as THREE from 'three';
import {
  bench,
  box,
  bush,
  canopy,
  detailMesh,
  door,
  fence,
  merge,
  paint,
  paintedMaterial,
  parapet,
  place,
  row,
  steps,
  streetLamp,
  tree,
  windowGrid,
  WindowGrid,
} from '../art/details';
import { enter, glow, leave, smoothstep } from '../art/kit';
import { bakeAO, contactShadows } from '../art/shading';
import { ChapterBuilder } from '../chapter-scene';

/**
 * School No. 126, vul. Pidlisna 9, Kharkiv, from its OpenStreetMap footprint (way 182188588): a three-storey slab
 * about 70 × 15 m, flat along its south-west side, three shallow bays standing out of its north-east side, and a
 * wing about 22 × 13.5 m at its north-west end running south-west (the gym or the hall). Its north-east side faces the
 * camera, which puts the wing at the right end, running back. Modelled at about a quarter scale across and twice
 * that up, so three storeys read. The finish (pale silicate brick, white frames, a flat roof behind a parapet) is the
 * period-typical one for a Soviet school: no photo of this building was found.
 */

const FLOOR = 1.5;
const FLOORS = 3;
const HEIGHT = FLOOR * FLOORS;
/** The slab: x from WEST to EAST, its flat back at BACK, its front at FRONT. */
const WEST = -9.5;
const EAST = 7.5;
const BACK = -4.8;
const FRONT = -1.2;
/** The three bays on the front: centre, width, how far they stand out. The middle one holds the entrance. */
const BAYS = [
  { x: -6.5, w: 1.2, d: 0.8 },
  { x: -1.5, w: 1.6, d: 1.2 },
  { x: 3.2, w: 1.2, d: 0.8 },
];
const ENTRANCE = BAYS[1];
/** The wing at the east end, running back from the slab: x from WING_X0 to EAST + 0.1, z from BACK to WING_BACK. */
const WING_X0 = 4.4;
const WING_BACK = -8.3;
const WING_HEIGHT = 3.6;
const PLINTH = 0.35;
/** The school fence, round the yard, and its gate on the entrance's axis. */
const FENCE: [number, number][] = [
  [-9.8, -5.6],
  [-9.8, 3.6],
  [7.9, 3.6],
  [7.9, -5.8],
];
/** Metres along the fence to its gate: up the west side, then along the front to the entrance. */
const GATE = 9.2 + (ENTRANCE.x + 9.8);

/** Window columns filling the wall from `from` to `to` (x) at the classroom rhythm. */
function ribbon(from: number, to: number): number[] {
  const spacing = 0.78;
  return row(Math.max(1, Math.floor((to - from - 0.5) / spacing)), spacing, (from + to) / 2);
}

/** The front wall between the bays, as runs of window columns. */
function frontColumns(): number[] {
  const edges = [WEST, ...BAYS.flatMap((b) => [b.x - b.w / 2, b.x + b.w / 2]), EAST];
  const out: number[] = [];
  for (let i = 0; i < edges.length; i += 2) out.push(...ribbon(edges[i] + 0.1, edges[i + 1] - 0.1));
  return out;
}

/** School No. 126 (1987–1994), the first chapter he walks to: the school rises from its yard, its windows lighting one by one. */
export const school: ChapterBuilder = (_chapter, _index, phone = false) => {
  const object = new THREE.Group();

  // The ground, which the war breaks: the grass of the plot (and a strip more under the wing). Its edges and the
  // asphalt are dressing, with the rest of the detail.
  const lawn = (w: number, d: number, x: number, z: number) => place(paint(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), 'meadow'), x, 0, z);
  const skirt = (w: number, d: number, x: number, z: number) => place(box(w, 0.24, d, 'meadow', 0.72, true), x, -0.25, z);
  const ground = merge([lawn(18.2, 9.9, -0.9, -1.05), lawn(4.1, 2.8, 5.95, -7.35)]);
  const edges = [
    skirt(18.2, 9.9, -0.9, -1.05),
    skirt(4.1, 2.8, 5.95, -7.35),
    place(box(16.6, 0.03, 3.4, 'concrete', 1.1, true), -1, 0, 0.9),
    place(box(1.4, 0.03, 1.2, 'concrete', 1.1, true), ENTRANCE.x, 0, 3.1),
  ];
  const dressing: THREE.BufferGeometry[] = [];

  // The building's structure, which the war breaks: slab, wing and bays. Plinths and parapets are dressing.
  const walls = 'silicate';
  const body: THREE.BufferGeometry[] = [
    place(box(EAST - WEST, HEIGHT, FRONT - BACK, walls, 1, true), (WEST + EAST) / 2, 0, (FRONT + BACK) / 2),
    place(box(EAST + 0.1 - WING_X0, WING_HEIGHT, BACK - WING_BACK, walls, 0.96, true), (WING_X0 + EAST + 0.1) / 2, 0, (BACK + WING_BACK) / 2),
  ];
  dressing.push(
    place(box(EAST - WEST + 0.1, PLINTH, FRONT - BACK + 0.1, 'concrete', 1, true), (WEST + EAST) / 2, 0, (FRONT + BACK) / 2),
    place(box(EAST + 0.2 - WING_X0, PLINTH, BACK - WING_BACK + 0.1, 'concrete', 1, true), (WING_X0 + EAST + 0.1) / 2, 0, (BACK + WING_BACK) / 2),
    place(parapet(EAST - WEST, FRONT - BACK), (WEST + EAST) / 2, HEIGHT, (FRONT + BACK) / 2),
    place(parapet(EAST + 0.1 - WING_X0, BACK - WING_BACK + 0.1), (WING_X0 + EAST + 0.1) / 2, WING_HEIGHT, (BACK + WING_BACK - 0.1) / 2),
  );
  for (const bay of BAYS) {
    // Stair bays: a little taller than the slab, their stairs lit at the half-landings.
    const z = FRONT + bay.d / 2;
    body.push(place(box(bay.w, HEIGHT + 0.4, bay.d, walls, 1.04, true), bay.x, 0, z));
    dressing.push(
      place(box(bay.w + 0.1, PLINTH, bay.d + 0.05, 'concrete', 1, true), bay.x, 0, z + 0.025),
      place(parapet(bay.w, bay.d + 0.02, { height: 0.25 }), bay.x, HEIGHT + 0.4, z),
    );
  }
  const structure = merge(body);
  bakeAO(structure, { occluders: [ground] });

  // Windows: the classroom rows along the front, the stairs' landing windows, the end wall and the gym's tall ones.
  const lit = phone ? 0.5 : 0.55;
  const light = phone ? { frame: 0, mullions: 0, transom: false } : {};
  const grids: WindowGrid[] = [];
  const onWall = (grid: WindowGrid, x: number, z: number, rotation = 0) => {
    grids.push({ ...grid, frames: place(grid.frames, x, 0, z, rotation), lit: place(grid.lit, x, 0, z, rotation) });
  };
  const sills = Array.from({ length: FLOORS }, (_, f) => f * FLOOR + 0.5);
  onWall(windowGrid({ columns: frontColumns(), rows: sills, width: 0.6, height: 0.82, lit, seed: 126, ...light }), 0, FRONT);
  BAYS.forEach((bay, i) => {
    const landings = bay === ENTRANCE ? [2.2, 3.7] : [1.2, 2.7];
    onWall(windowGrid({ columns: [bay.x], rows: landings, width: 0.5, height: 1, lit, seed: 200 + i, mullions: 0, ...light }), 0, FRONT + bay.d);
  });
  onWall(windowGrid({ columns: [-(BACK + FRONT) / 2], rows: sills, width: 0.6, height: 0.82, lit, seed: 301, ...light }), EAST, 0, Math.PI / 2);
  onWall(
    windowGrid({ columns: row(3, 1, -(BACK + WING_BACK) / 2), rows: [0.8], width: 0.7, height: 2.2, lit: 0.7, seed: 302, mullions: 2, ...light }),
    EAST + 0.1,
    0,
    Math.PI / 2,
  );

  // The entrance: steps up to double glazed doors, under a canopy on two posts.
  const face = FRONT + ENTRANCE.d;
  const entrance = [
    place(steps(1.5, 3, PLINTH, 0.28), ENTRANCE.x, 0, face),
    place(door(0.9, 1.2, { double: true, glazed: true, leafTint: 'terracotta' }), ENTRANCE.x, PLINTH, face),
    place(canopy(1.9, 1.2, 1.75), ENTRANCE.x, 0, face),
  ];
  const facade = merge([...dressing, ...grids.map((g) => g.frames), ...entrance]);
  bakeAO(facade, { occluders: [structure, ground], corner: phone ? 0 : 0.3 });

  const windowGlow = glow('dawnGold', 0);
  const building = new THREE.Group();
  building.add(new THREE.Mesh(structure, paintedMaterial()), detailMesh(facade), detailMesh(merge(grids.map((g) => g.lit)), windowGlow));
  object.add(building);

  // The yard: the fence and its gate, a lamp by the gate, trees (lime, chestnut, birch), the flagpole, a bench, and
  // the horizontal bar of the sports ground; phones get fewer and cheaper.
  const lamp = streetLamp({ height: 2.6, arm: 0.5 });
  const yardParts = [
    fence(FENCE, { height: 0.9, style: phone ? 'rail' : 'bars', gates: [{ at: GATE, width: 1.6 }] }),
    place(lamp.body, ENTRANCE.x + 1.3, 0, 3.2, Math.PI),
    place(lamp.lamp, ENTRANCE.x + 1.3, 0, 3.2, Math.PI),
    place(tree('broadleaf', 7, { height: 4.2, low: phone }), -8.4, 0, 2.1),
    place(tree('birch', 3, { height: 4, low: phone }), 6.4, 0, 2.3),
    // Flagpole, its flag clear of the facade.
    place(box(0.08, 4.6, 0.08, 'chalk'), -4, 0, 2.3),
    place(box(0.06, 0.12, 0.06, 'chalk', 0.8), -4, 4.6, 2.3),
    place(box(0.9, 0.55, 0.03, 'dawnGold'), -3.5, 3.95, 2.3),
    // The horizontal bar.
    place(box(0.08, 2, 0.08, 'ash'), 4.3, 0, 1.2),
    place(box(0.08, 2, 0.08, 'ash'), 5.9, 0, 1.2),
    place(box(1.7, 0.05, 0.05, 'chalk'), 5.1, 1.9, 1.2),
  ];
  if (!phone) {
    yardParts.push(
      place(tree('broadleaf', 12, { height: 3.6, foliage: 'meadow' }), -5.6, 0, 2.6),
      place(bench(1.4), ENTRANCE.x + 2.6, 0, 1.2, -Math.PI / 2 + 0.3),
      ...[-8.6, -4.7, 0.6, 5.4].map((x, i) => place(bush(40 + i, 0.8), x, 0, FRONT + 0.55)),
    );
  }
  const yardGeometry = merge(yardParts);
  bakeAO(yardGeometry, { corner: 0, fade: 1 });
  const yard = new THREE.Group();
  yard.add(detailMesh(yardGeometry));

  const shadows = contactShadows(
    [
      { x: (WEST + EAST) / 2, z: (FRONT + BACK) / 2 + 0.3, w: EAST - WEST + 1.6, d: FRONT - BACK + 2.4 },
      { x: (WING_X0 + EAST) / 2, z: (BACK + WING_BACK) / 2, w: 4.2, d: 4.2 },
      { x: -8.4, z: 2.1, w: 2.4, d: 2.4 },
      { x: 6.4, z: 2.3, w: 1.6, d: 1.6 },
      ...(phone ? [] : [{ x: -5.6, z: 2.6, w: 2, d: 2 }]),
    ],
    { opacity: 0.5 },
  );
  const grounds = new THREE.Group().add(new THREE.Mesh(ground, paintedMaterial()), detailMesh(bakeAO(merge(edges), { corner: 0 })));
  object.add(grounds, shadows, yard);

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      const shown = built > 0.1;
      grounds.visible = shown;
      const rise = smoothstep(0.1, 0.75, built);
      building.visible = rise > 0;
      building.scale.y = Math.max(rise, 1e-3);
      const grow = smoothstep(0.25, 0.8, built);
      yard.visible = grow > 0;
      yard.scale.y = Math.max(grow, 1e-3);
      shadows.visible = shown;
      shadows.material.opacity = 0.5 * rise;
      const on = smoothstep(0.6, 1, built);
      windowGlow.emissiveIntensity = on * (1 - 0.4 * calm) * (1 + 0.03 * Math.sin(time * 1.3));
    },
  };
};

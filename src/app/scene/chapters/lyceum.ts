import * as THREE from 'three';
import {
  arch,
  box,
  bush,
  column,
  cornice,
  detailMesh,
  door,
  merge,
  paint,
  paintedMaterial,
  parapet,
  pilasters,
  place,
  row,
  shade,
  steps,
  tree,
  windowGrid,
  WindowGrid,
} from '../art/details';
import { block, enter, glow, leave, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { PALETTE } from '../art/palette';
import { bakeAO, contactShadows } from '../art/shading';
import { ChapterBuilder } from '../chapter-scene';

const ORBIT_RADIUS = 5.2;
const ORBIT_Y = 7.4;
const ORBIT_Z = -3;
const MOTIF_SCALE = 1.25;
/** The roof line the motifs rise from as they build in: the top of the parapet. */
const ROOF_Y = 5;

/**
 * Physics and Mathematics Lyceum No. 27, vul. Marinska 12/14, Kharkiv: No. 12, built 1901–04 to B. M. Kornienko's
 * design as a commercial school (uk.wikipedia; Commons "12/14 Marinska Street"). Terracotta-red brick with cream
 * trim; two tall storeys over a semi-basement, about nine bays; round-arched upper windows under ogee "kokoshnik"
 * hoods; on the entrance axis, left of centre, a paired arched window under a big hood, pilaster-turrets and a
 * crenellated brick crown; below it an arched portal between pairs of short white columns, a small balcony over it.
 * Spruces and a white urn on the strip of lawn behind a whitewashed kerb. Modelled at about a quarter scale across.
 */
const W = 11;
const DEPTH = 4;
const FRONT = -2;
const HEIGHT = 4.6;
/** The semi-basement's top, and the string course under the upper storey. */
const PLINTH = 0.8;
const STRING = 2.5;
/** The nine bays, and the entrance axis on the third. */
const BAYS = row(9, 1.15);
const AXIS = BAYS[2];
/** The entrance risalit: its width, how far it stands out, and its height to the crown's foot. */
const RISALIT_W = 2;
const RISALIT_D = 0.25;
const RISALIT_H = 4.9;
const FACE = FRONT + RISALIT_D;
const DOOR_SILL = 0.45;

function atom(): THREE.Group {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), lowPoly('brass')));
  const ring = new THREE.TorusGeometry(1.05, 0.06, 5, 28);
  const rings = mergedMesh(
    [ring.clone().rotateX(Math.PI / 2).rotateZ(Math.PI / 3), ring.clone().rotateX(Math.PI / 2).rotateZ(-Math.PI / 3)],
    lowPoly('chalk'),
  );
  ring.dispose();
  rings.name = 'rings';
  group.add(rings);
  return group;
}

function sineWave(): THREE.Group {
  const group = new THREE.Group();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const x = -1.3 + (2.6 * i) / 48;
    points.push(new THREE.Vector3(x, 0.55 * Math.sin((x / 1.3) * 2 * Math.PI), 0));
  }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: PALETTE.brass })));
  group.add(mergedMesh([block(2.8, 0.04, 0.04, 0, 0, -0.02)], lowPoly('chalk')));
  return group;
}

function pendulum(): THREE.Group {
  const group = new THREE.Group();
  group.add(mergedMesh([block(1.4, 0.12, 0.12, 0, 0, 0.9), block(0.12, 0.9, 0.12, -0.65, 0), block(0.12, 0.9, 0.12, 0.65, 0)], lowPoly('chalk')));
  const arm = new THREE.Group();
  arm.name = 'arm';
  arm.position.y = 0.9;
  arm.add(mergedMesh([block(0.04, 1.2, 0.04, 0, 0, -1.2)], lowPoly('chalk')));
  const bob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), lowPoly('brass'));
  bob.position.y = -1.25;
  arm.add(bob);
  group.add(arm);
  group.position.y = -0.2;
  return group;
}

function pi(): THREE.Group {
  const group = new THREE.Group();
  group.add(
    mergedMesh(
      [
        block(1.5, 0.24, 0.24, 0, 0, 0.55),
        block(0.24, 1.2, 0.24, -0.35, 0, -0.65),
        block(0.24, 1.2, 0.24, 0.35, 0, -0.65),
        // The curl at the foot of the right leg.
        block(0.36, 0.2, 0.24, 0.59, 0, -0.65),
      ],
      lowPoly('brass'),
    ),
  );
  return group;
}

/** Physics and Mathematics Lyceum No. 27 (1994–1998), with an atom, a sine wave, a pendulum and π orbiting above. */
export const lyceum: ChapterBuilder = (_chapter, _index, phone = false) => {
  const object = new THREE.Group();
  // The terracotta-red of its brick: a shade lighter than the palette's brick.
  const brick = shade('brick', 1.12);
  const trim = 'wheat';
  const wood = shade('brass', 0.45);

  // The ground, which the war breaks: the lawn. Its edge, the pavement, the path and the kerb are dressing.
  const ground = merge([place(paint(new THREE.PlaneGeometry(12.6, 7.8).rotateX(-Math.PI / 2), 'meadow'), 0, 0, -3.1)]);
  const kerb = (from: number, to: number) => place(box(to - from, 0.18, 0.14, 'chalk', 0.95, true), (from + to) / 2, 0, -0.45);
  const edges = merge([
    place(box(12.6, 0.24, 7.8, 'meadow', 0.72, true), 0, -0.25, -3.1),
    place(box(12.6, 0.03, 0.9, 'concrete', 1.1, true), 0, 0, 0.2),
    place(box(1.2, 0.03, 1.15, 'concrete', 1.05, true), AXIS, 0, -0.95),
    kerb(-6.2, AXIS - 0.65),
    kerb(AXIS + 0.65, 6.2),
  ]);

  // The structure, which the war breaks: the block, the risalit and its crown wall.
  const structure = merge([
    place(box(W, HEIGHT, DEPTH, brick, 1, true), 0, 0, FRONT - DEPTH / 2),
    place(box(RISALIT_W, RISALIT_H, RISALIT_D, brick, 1.03, true), AXIS, 0, FRONT + RISALIT_D / 2),
    place(box(RISALIT_W - 0.36, 0.7, 0.3, brick, 1.03, true), AXIS, RISALIT_H, FRONT + 0.1),
  ]);
  bakeAO(structure, { occluders: [ground] });

  // Trim: the semi-basement, cream string courses and cornice, the parapet, the risalit's pilaster-turrets and crown.
  const band = (y: number) => place(cornice(W, DEPTH, { tiers: 1, projection: 0.06, height: 0.1, tint: trim }), 0, y, FRONT - DEPTH / 2);
  const dressing: THREE.BufferGeometry[] = [
    place(box(W + 0.1, PLINTH, DEPTH + 0.1, brick, 0.78, true), 0, 0, FRONT - DEPTH / 2),
    place(box(RISALIT_W + 0.1, PLINTH, RISALIT_D + 0.05, brick, 0.8, true), AXIS, 0, FRONT + RISALIT_D / 2),
    band(PLINTH),
    band(STRING),
    place(cornice(RISALIT_W, RISALIT_D + 0.1, { tiers: 1, projection: 0.06, height: 0.1, tint: trim }), AXIS, STRING, FRONT + 0.1),
    place(cornice(W, DEPTH, { tiers: 2, projection: 0.18, height: 0.26, tint: trim }), 0, HEIGHT - 0.26, FRONT - DEPTH / 2),
    place(parapet(W, DEPTH, { height: 0.3, tint: brick, coping: trim, deck: 'slate' }), 0, HEIGHT, FRONT - DEPTH / 2),
    place(pilasters([AXIS - RISALIT_W / 2 + 0.11, AXIS + RISALIT_W / 2 - 0.11], RISALIT_H - PLINTH, { width: 0.22, tint: trim }), 0, PLINTH, FACE),
    // The crown: merlons on its wall, a cream panel on it, and a turret either side.
    ...row(4, 0.42, AXIS).map((x) => place(box(0.22, 0.26, 0.3, brick, 1.06), x, RISALIT_H + 0.7, FRONT + 0.1)),
    place(box(0.9, 0.28, 0.03, trim), AXIS, RISALIT_H + 0.2, FRONT + 0.26),
    ...[-1, 1].flatMap((s) => {
      const x = AXIS + s * (RISALIT_W / 2 - 0.11);
      return [
        place(box(0.34, 1.3, 0.34, trim), x, RISALIT_H - 0.3, FACE - 0.12),
        place(box(0.42, 0.08, 0.42, trim, 0.9), x, RISALIT_H + 1, FACE - 0.12),
        ...[-0.13, 0.13].map((dx) => place(box(0.12, 0.18, 0.4, brick, 1.06), x + dx, RISALIT_H + 1.08, FACE - 0.12)),
      ];
    }),
  ];

  // Windows: small basement lights, the ground floor's in cream surrounds, the upper floor's arched under hoods, the
  // paired window on the axis, and the east end wall's.
  const light = phone ? { frame: 0, mullions: 0, transom: false } : { frameTint: wood };
  const grids: WindowGrid[] = [];
  const onWall = (grid: WindowGrid, x: number, z: number, rotation = 0) => {
    grids.push({ ...grid, frames: place(grid.frames, x, 0, z, rotation), lit: place(grid.lit, x, 0, z, rotation) });
  };
  const bays = BAYS.filter((x) => x !== AXIS);
  const lower = 1.15;
  const upper = 2.75;
  const surround = 0.04;
  for (const x of bays) {
    dressing.push(
      place(box(0.74, 1.2, surround, trim), x, lower - 0.12, FRONT),
      place(arch(0.84, { thickness: 0.12, depth: 0.08, segments: phone ? 5 : 7, tint: trim }), x, upper + 0.95, FRONT),
    );
  }
  onWall(windowGrid({ columns: bays, rows: [0.2], width: 0.45, height: 0.32, frame: 0, sill: 0, lit: 0, seed: 270 }), 0, FRONT);
  onWall(windowGrid({ columns: bays, rows: [lower], width: 0.5, height: 0.95, lit: 0.5, seed: 271, sillTint: trim, ...light }), 0, FRONT + surround);
  onWall(windowGrid({ columns: bays, rows: [upper], width: 0.6, height: 0.95, arched: true, lit: 0.5, seed: 272, sillTint: trim, ...light }), 0, FRONT);
  onWall(windowGrid({ columns: row(2, 0.46, AXIS), rows: [upper], width: 0.36, height: 0.95, arched: true, lit: 0.8, seed: 273, sillTint: trim, ...light }), 0, FACE);
  onWall(
    windowGrid({ columns: row(2, 1.6, -(FRONT - DEPTH / 2) - 0.4), rows: [lower, upper], width: 0.5, height: 0.95, lit: 0.5, seed: 274, sillTint: trim, ...light }),
    W / 2,
    0,
    Math.PI / 2,
  );
  // The big ogee hood over the paired window, its tip a cream lozenge.
  dressing.push(
    place(arch(1.36, { thickness: 0.14, depth: 0.1, segments: phone ? 5 : 9, tint: trim }), AXIS, upper + 0.95, FACE),
    place(box(0.16, 0.16, 0.1, trim).translate(0, -0.08, 0).rotateZ(Math.PI / 4), AXIS, upper + 0.95 + 0.84, FACE),
  );

  // The entrance: steps up to the double door in an arched cream portal, a pair of short white columns either side
  // on red pedestals, and the small balcony over it.
  const doorH = 1.35;
  const entrance = [
    place(steps(1.5, 3, DOOR_SILL, 0.24, 'concrete'), AXIS, 0, FACE),
    place(door(0.72, doorH, { double: true, leafTint: wood, frameTint: trim }), AXIS, DOOR_SILL, FACE),
    place(paint(new THREE.CircleGeometry(0.43, 6, 0, Math.PI), wood, 0.8), AXIS, DOOR_SILL + doorH, FACE + 0.02),
    place(arch(1.0, { thickness: 0.16, depth: 0.12, segments: phone ? 5 : 7, tint: trim }), AXIS, DOOR_SILL + doorH, FACE),
    ...[-1, 1].flatMap((s) => [
      place(box(0.56, DOOR_SILL, 0.34, brick, 0.85), AXIS + s * 0.74, 0, FACE + 0.17),
      ...[0.62, 0.86].map((dx) => place(column(1.35, 0.085, { capitalTint: trim, sides: phone ? 6 : 8 }), AXIS + s * dx, DOOR_SILL, FACE + 0.17)),
    ]),
    place(box(1.9, 0.1, 0.5, trim), AXIS, STRING, FACE + 0.25),
    place(box(1.9, 0.28, 0.06, brick, 1.05), AXIS, STRING + 0.1, FACE + 0.47),
    ...[-1, 1].map((s) => place(box(0.06, 0.28, 0.44, brick, 0.95), AXIS + s * 0.92, STRING + 0.1, FACE + 0.25)),
  ];
  const facade = merge([...dressing, ...grids.map((g) => g.frames), ...entrance]);
  bakeAO(facade, { occluders: [structure, ground], corner: phone ? 0 : 0.3 });

  const windowGlow = glow('candle', 0);
  const building = new THREE.Group();
  building.add(new THREE.Mesh(structure, paintedMaterial()), detailMesh(facade), detailMesh(merge(grids.map((g) => g.lit)), windowGlow));
  object.add(building);

  // The front strip: spruces at either end, clear of the windows, low clipped bushes, and the white urn by the path.
  const urn = AXIS + 1.6;
  const yardParts = [
    place(tree('conifer', 27, { height: 4, low: phone }), -6.4, 0, -1.2),
    place(tree('conifer', 12, { height: 3.6, low: phone }), 6.3, 0, -5.9),
    place(box(0.34, 0.5, 0.34, 'chalk', 0.92), urn, 0, -0.95),
    place(paint(new THREE.CylinderGeometry(0.22, 0.1, 0.3, 8, 1, true), 'chalk'), urn, 0.65, -0.95),
    place(paint(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 8), 'chalk', 0.95), urn, 0.8, -0.95),
  ];
  if (!phone) yardParts.push(...[-4.6, 0.6, 3.4].map((x, i) => place(bush(70 + i, 0.6, 'spruce'), x, 0, -1.1)));
  const yardGeometry = merge(yardParts);
  bakeAO(yardGeometry, { corner: 0, fade: 1 });
  const yard = new THREE.Group().add(detailMesh(yardGeometry));

  const shadows = contactShadows(
    [
      { x: 0, z: FRONT - DEPTH / 2 + 0.3, w: W + 1.6, d: DEPTH + 2.2 },
      { x: -6.4, z: -1.2, w: 2.2, d: 2.2 },
      { x: 6.3, z: -5.9, w: 2, d: 2 },
    ],
    { opacity: 0.5 },
  );
  const grounds = new THREE.Group().add(new THREE.Mesh(ground, paintedMaterial()), detailMesh(bakeAO(edges, { corner: 0 })));
  object.add(grounds, shadows, yard);

  const orbit = new THREE.Group();
  orbit.position.set(0, ORBIT_Y, ORBIT_Z);
  const motifs = [atom(), sineWave(), pendulum(), pi()];
  motifs.forEach((m) => {
    // Half-turned towards the road, so they read head-on and from the front-right.
    m.rotation.y = 0.4;
    orbit.add(m);
  });
  object.add(orbit);
  const rings = motifs[0].getObjectByName('rings')!;
  const arm = motifs[2].getObjectByName('arm')!;

  let spin = 0;
  let lastTime = 0;

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      const rise = smoothstep(0.1, 0.5, built);
      grounds.visible = built > 0.1;
      building.visible = rise > 0;
      building.scale.y = Math.max(rise, 1e-3);
      const grow = smoothstep(0.25, 0.7, built);
      yard.visible = grow > 0;
      yard.scale.y = Math.max(grow, 1e-3);
      shadows.visible = built > 0.1;
      shadows.material.opacity = 0.5 * rise;
      windowGlow.emissiveIntensity = smoothstep(0.4, 0.8, built) * (1 - 0.4 * calm);

      // Idle orbit: accumulated, so calming it on leave slows it without a jump.
      spin += Math.min(time - lastTime, 0.1) * 0.22 * (1 - 0.7 * calm);
      lastTime = time;
      motifs.forEach((motif, i) => {
        const grown = smoothstep(0.35 + 0.12 * i, 0.64 + 0.12 * i, built);
        const angle = spin + (i * Math.PI) / 2;
        motif.visible = grown > 0;
        motif.scale.setScalar(Math.max(grown, 1e-3) * MOTIF_SCALE);
        motif.position.set(Math.sin(angle) * ORBIT_RADIUS * grown, (ROOF_Y - ORBIT_Y) * (1 - grown), Math.cos(angle) * ORBIT_RADIUS * grown);
      });
      rings.rotation.y = spin * 3;
      arm.rotation.z = Math.sin(time * 2.2) * 0.5 * (1 - 0.6 * calm);
    },
  };
};

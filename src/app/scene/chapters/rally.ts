import * as THREE from 'three';
import { PALETTE } from '../art/palette';
import { enter, glow, haloMap, leave, lowPoly, mergedMesh, seeded, smoothstep } from '../art/kit';
import { ChapterBuilder, chapterAnchor } from '../chapter-scene';

/** Where the engine's car rides at the chapter midpoint: the anchor plus CAR_OFFSET (scene-engine.ts). */
const CAR_AT_MID = new THREE.Vector3(12, 0, 2);
const ROAD_HALF_WIDTH = 3.5;
/** The dust starts behind the rear bumper, so it never swallows the car. */
const BUMPER = 2.4;
const PUFFS = 110;
const SPRAY = 700;
const HAZE = 500;
/** Phones carry this share of the spray and haze (#16). */
const PHONE_SHARE = 0.5;

/**
 * How far the stage road runs along the car's lane, in metres before and after where the car stands at the chapter's
 * midpoint: the town road (road.ts) gives way to the gravel over it.
 */
export function stageAlong(index: number): [from: number, to: number] {
  const stride = chapterAnchor(index + 1).distanceTo(chapterAnchor(index - 1)) / 2;
  return [-0.55 * stride, 0.75 * stride];
}

/**
 * A gravel stage in autumn forest: the stage road under the car's lane, a berm, spectator tape,
 * a chevron board with hay bales at the corner, and the dust the passing Forester kicks up.
 * The Forester itself is the engine's car rig; the dust follows it from scroll alone.
 */
export const rally: ChapterBuilder = (_chapter, index, phone = false) => {
  const share = phone ? PHONE_SHARE : 1;
  const random = seeded(8);
  const object = new THREE.Group();

  // The road bends with the path through the chapter anchors; within one chapter it is near straight,
  // so the stage is laid along the chord through the neighbouring anchors.
  const chord = chapterAnchor(index + 1).sub(chapterAnchor(index - 1));
  /** How far the car travels across one chapter's span. */
  const stride = chord.length() / 2;
  const heading = chord.normalize();
  /** Along-lane distance of the car from its midpoint position, at a local progress. */
  const carAlong = (local: number) => (local - 0.5) * stride;

  // The lane frame: x runs with the car, z points from the scene out across the road.
  const lane = new THREE.Group();
  lane.position.copy(CAR_AT_MID);
  lane.rotation.y = Math.atan2(-heading.z, heading.x);
  object.add(lane);
  /** Scene position of a lane point `along` the road and `off` towards the scene. */
  const at = (along: number, off: number) => lane.localToWorld(new THREE.Vector3(along, 0, -off));
  lane.updateMatrixWorld();
  const inPlot = (along: number, off: number, margin: number) => {
    const p = at(along, off);
    return Math.hypot(p.x, p.z) <= 12 - margin;
  };

  // Forest floor, a gravel road over it with darker wheel ruts.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(11.6, 9).rotateX(-Math.PI / 2), lowPoly('ash'));
  const [roadStart, roadEnd] = stageAlong(index);
  const road = new THREE.Group();
  road.name = 'stage-road';
  road.add(strip(roadStart, roadEnd, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, 0.03, 0.5, random, lowPoly('gravel')));
  for (const z of [-0.8, 0.8]) road.add(strip(roadStart, roadEnd, z - 0.3, z + 0.3, 0.05, 0.1, random, lowPoly('concrete')));
  lane.add(road);

  // A gravel berm along the scene side of the road, then the spectator tape.
  const berm: THREE.BufferGeometry[] = [];
  for (let along = -14; along <= 12; along += 1.1) {
    const off = ROAD_HALF_WIDTH + 1 + random() * 0.4;
    if (!inPlot(along, off, 1)) continue;
    const r = 0.5 + random() * 0.4;
    berm.push(place(new THREE.IcosahedronGeometry(r, 0), along, r * 0.35, -off, random() * 3, [1.3, 0.7, 1]));
  }
  const bermMesh = mergedMesh(berm, lowPoly('brass'));
  lane.add(bermMesh);

  const tape = new THREE.Group();
  const posts: THREE.BufferGeometry[] = [];
  const red: THREE.BufferGeometry[] = [];
  const white: THREE.BufferGeometry[] = [];
  const TAPE_OFF = ROAD_HALF_WIDTH + 3;
  const spots: number[] = [];
  for (let along = -14; along <= 12; along += 2.6) if (inPlot(along, TAPE_OFF, 0.5)) spots.push(along);
  spots.forEach((along, i) => {
    posts.push(place(new THREE.CylinderGeometry(0.05, 0.06, 1.1, 5), along, 0.55, -TAPE_OFF));
    const next = spots[i + 1];
    if (next === undefined) return;
    // Each span is two tape lengths, red then white.
    const half = (next - along) / 2;
    red.push(place(new THREE.BoxGeometry(half, 0.1, 0.02), along + half / 2, 0.95, -TAPE_OFF));
    white.push(place(new THREE.BoxGeometry(half, 0.1, 0.02), along + half * 1.5, 0.95, -TAPE_OFF));
  });
  tape.add(mergedMesh(posts, lowPoly('soot')), mergedMesh(red, lowPoly('brick')), mergedMesh(white, lowPoly('chalk')));
  lane.add(tape);

  // The centre of interest: a chevron board warning of the corner, hay bales at its foot.
  const corner = new THREE.Group();
  corner.position.copy(at(-1, TAPE_OFF + 2));
  corner.rotation.y = Math.atan2(18 - corner.position.x, 16 - corner.position.z);
  const board: THREE.BufferGeometry[] = [
    place(new THREE.BoxGeometry(4.6, 1.6, 0.12), 0, 3.2, 0),
    place(new THREE.BoxGeometry(0.16, 2.6, 0.16), -1.7, 1.3, -0.1),
    place(new THREE.BoxGeometry(0.16, 2.6, 0.16), 1.7, 1.3, -0.1),
  ];
  const chevrons = [-1.4, 0, 1.4].map((x) => place(chevron(), x, 3.2, 0.07));
  // Reflective paint: a faint glow keeps the chevrons bright on a board that faces away from the key light.
  const reflectors = mergedMesh(chevrons, glow('sandstone', 0.5));
  corner.add(mergedMesh(board, lowPoly('soot')), reflectors);
  const bales: THREE.BufferGeometry[] = [];
  for (const [x, y, z] of [
    [-1.1, 0.55, 1.4],
    [0.1, 0.55, 1.5],
    [1.3, 0.55, 1.3],
    [-0.5, 1.5, 1.4],
    [0.7, 1.5, 1.4],
  ]) {
    bales.push(place(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 8), x, y, z, 0, [1, 1, 1], Math.PI / 2));
  }
  corner.add(mergedMesh(bales, lowPoly('wheat')));
  object.add(corner);

  // Autumn forest behind: dark pines among gold and red birches.
  const pines: THREE.BufferGeometry[] = [];
  const trunks: THREE.BufferGeometry[] = [];
  const birches: THREE.BufferGeometry[] = [];
  const gold: THREE.BufferGeometry[] = [];
  const rust: THREE.BufferGeometry[] = [];
  let planted = 0;
  const middle = new THREE.Vector3();
  for (let tries = 0; planted < 16 && tries < 400; tries++) {
    const along = -13 + random() * 24;
    const off = TAPE_OFF + 4 + random() * 14;
    if (!inPlot(along, off, 2)) continue;
    if (Math.abs(along + 1) < 3.5 && off < TAPE_OFF + 6) continue; // leave the board in view
    const p = at(along, off);
    const tall = 5 + random() * 6;
    if (random() < 0.5) {
      trunks.push(place(new THREE.CylinderGeometry(0.15, 0.25, tall * 0.3, 5), p.x, tall * 0.15, p.z));
      for (let tier = 0; tier < 3; tier++) {
        const r = (1.9 - tier * 0.45) * (tall / 8);
        pines.push(place(new THREE.ConeGeometry(r, tall * 0.4, 6), p.x, tall * (0.35 + tier * 0.2), p.z, random()));
      }
    } else {
      birches.push(place(new THREE.CylinderGeometry(0.12, 0.18, tall * 0.7, 5), p.x, tall * 0.35, p.z));
      const leaves = random() < 0.6 ? gold : rust;
      const r = 1 + random() * 0.8;
      leaves.push(place(new THREE.IcosahedronGeometry(r, 0), p.x, tall * 0.7, p.z, random() * 3, [1, 1.3, 1]));
      leaves.push(place(new THREE.IcosahedronGeometry(r * 0.7, 0), p.x + 0.4, tall * 0.7 + r, p.z, random() * 3));
    }
    middle.add(p);
    planted++;
  }
  // Pivot the forest on its middle, so it spreads out from there as it builds.
  const forest = new THREE.Group();
  forest.position.copy(middle.divideScalar(planted));
  for (const [parts, key] of [
    [pines, 'krakowRoof'],
    [trunks, 'brass'],
    [birches, 'chalk'],
    [gold, 'dawnGold'],
    [rust, 'brick'],
  ] as const) {
    const mesh = mergedMesh(parts, lowPoly(key));
    mesh.geometry.translate(-forest.position.x, 0, -forest.position.z);
    forest.add(mesh);
  }
  object.add(floor, forest);

  // Dust: faceted puffs rolling off the rear wheels, grit sprayed from the tyres, and haze in the air.
  // Each puff and grain is laid at a point on the stage; it rises once the car has passed that point.
  const dustMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.wheat,
    // Lit from within a little, so the shaded underside reads as dust rather than rock.
    emissive: PALETTE.wheat,
    emissiveIntensity: 0.6,
    flatShading: true,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), dustMaterial, PUFFS);
  puffs.name = 'dust';
  puffs.frustumCulled = false;
  const dustFrom = carAlong(0.02);
  const dustTo = carAlong(1.2);
  const puff = Array.from({ length: PUFFS }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    return {
      along: dustFrom + ((dustTo - dustFrom) * (i + random() * 0.8)) / PUFFS,
      side: side * (0.75 + random() * 0.2),
      drift: side * (0.2 + random() * 0.7),
      rise: 0.4 + random() * 1.1,
      size: 0.45 + random() * 0.35,
      life: 3 + random() * 4,
      spin: random() * Math.PI,
      phase: random() * Math.PI * 2,
    };
  });

  const spray = grains(SPRAY * share, 0.16);
  const grain = Array.from({ length: SPRAY * share }, () => ({
    along: dustFrom + (dustTo - dustFrom) * random(),
    side: random() < 0.5 ? -0.85 : 0.85,
    out: 0.5 + random() * 2.5,
    up: 1 + random() * 3,
  }));

  const haze = grains(HAZE * share, 0.35);
  const mote = Array.from({ length: HAZE * share }, () => ({
    along: dustFrom + (dustTo - dustFrom) * random(),
    off: -ROAD_HALF_WIDTH + random() * (ROAD_HALF_WIDTH * 2 + 1),
    y: 0.2 + random() * 2.5,
    phase: random() * Math.PI * 2,
  }));
  lane.add(puffs, spray.points, haze.points);

  // The floor and forest spread out from their middles; the berm, tape and board stand up in turn.
  const grow = [
    { part: floor, from: 0, spread: true },
    { part: forest, from: 0.15, spread: true },
    { part: bermMesh, from: 0.25, spread: false },
    { part: tape, from: 0.35, spread: false },
    { part: corner, from: 0.45, spread: false },
  ];

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      for (const { part, from, spread } of grow) {
        const k = smoothstep(from, from + 0.5, built);
        part.visible = k > 0;
        part.scale.set(spread ? k : 1, Math.max(k, 0.001), spread ? k : 1);
      }
      road.visible = built > 0.001;
      road.scale.set(1, 1, Math.max(built, 0.001));

      const car = carAlong(local);
      puff.forEach((p, i) => {
        const age = car - p.along - BUMPER;
        const t = age / p.life;
        let size = 0;
        if (t > 0 && t < 1) size = p.size * (0.5 + 0.5 * smoothstep(0, 0.15, t)) * (1 - smoothstep(0.3, 1, t));
        const settle = 1 - Math.exp(-age / 6);
        const wobble = Math.sin(time * 0.6 + p.phase) * 0.12;
        position.set(p.along + age * 0.08, 0.35 + p.rise * settle + wobble, p.side + p.drift * settle);
        quaternion.setFromEuler(euler.set(p.spin, p.spin * 1.7 + time * 0.05, 0));
        puffs.setMatrixAt(i, matrix.compose(position, quaternion, scale.setScalar(Math.max(size, 0.0001))));
      });
      puffs.instanceMatrix.needsUpdate = true;

      grain.forEach((g, i) => {
        // Distance past the grain stands in for time: flung up and out, then falling back.
        const s = (car - g.along - BUMPER + 1.2) / 5;
        const live = s > 0 && s < 1.4;
        const y = Math.max(g.up * s - 2.6 * s * s, 0.04);
        spray.set(i, g.along, y, g.side + Math.sign(g.side) * g.out * s, live ? 0.9 * (1 - smoothstep(0.8, 1.4, s)) : 0);
      });
      spray.done();

      const drift = time * 0.25;
      mote.forEach((m, i) => {
        // Dust the car raised hangs over the stage behind it and settles as the camera moves on.
        const age = car - m.along - BUMPER;
        const hang = smoothstep(0, 5, age) * (1 - smoothstep(18, 40, age)) * (0.4 - 0.25 * calm);
        const y = m.y * smoothstep(0, 8, age) + Math.sin(drift + m.phase) * 0.3;
        haze.set(i, m.along + Math.sin(drift * 0.7 + m.phase) * 0.6, Math.max(y, 0.05), -m.off, hang);
      });
      haze.done();
    },
  };
};

/** A flat, jagged-edged ribbon along the lane from `a` to `b`, between offsets `z0` and `z1`. */
function strip(
  a: number,
  b: number,
  z0: number,
  z1: number,
  y: number,
  jag: number,
  random: () => number,
  material: THREE.Material,
): THREE.Mesh {
  const points: number[] = [];
  const steps = Math.ceil((b - a) / 2.2);
  const edge = () => [z0 - random() * jag, z1 + random() * jag];
  let [l0, r0] = edge();
  for (let i = 0; i < steps; i++) {
    const x0 = a + ((b - a) * i) / steps;
    const x1 = a + ((b - a) * (i + 1)) / steps;
    const [l1, r1] = edge();
    points.push(x0, y, l0, x1, y, r1, x1, y, l1, x0, y, l0, x0, y, r0, x1, y, r1);
    [l0, r0] = [l1, r1];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

/** A right-pointing chevron, 1 m tall, in the board's plane. */
function chevron(): THREE.BufferGeometry {
  const shape = new THREE.Shape([
    new THREE.Vector2(-0.45, 0.6),
    new THREE.Vector2(-0.05, 0.6),
    new THREE.Vector2(0.45, 0),
    new THREE.Vector2(-0.05, -0.6),
    new THREE.Vector2(-0.45, -0.6),
    new THREE.Vector2(0.05, 0),
  ]);
  return new THREE.ExtrudeGeometry(shape, { depth: 0.04, bevelEnabled: false });
}

/** Poses a part geometry in place, ready to merge. */
function place(
  geometry: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  yaw = 0,
  stretch: [number, number, number] = [1, 1, 1],
  tilt = 0,
): THREE.BufferGeometry {
  return geometry
    .scale(...stretch)
    .rotateX(tilt)
    .rotateY(yaw)
    .translate(x, y, z);
}

/** Dust grains as points, each with its own alpha, positioned in the lane frame. */
function grains(count: number, size: number) {
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 4);
  const colour = new THREE.Color(PALETTE.wheat);
  for (let i = 0; i < count; i++) colour.toArray(colours, i * 4);
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(positions, 3);
  const alpha = new THREE.BufferAttribute(colours, 4);
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', alpha);
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size, map: haloMap(), vertexColors: true, transparent: true, depthWrite: false }),
  );
  points.name = 'dust';
  points.frustumCulled = false;
  return {
    points,
    set(i: number, x: number, y: number, z: number, a: number) {
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      colours[i * 4 + 3] = a;
    },
    done() {
      position.needsUpdate = true;
      alpha.needsUpdate = true;
    },
  };
}

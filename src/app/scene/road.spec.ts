import * as THREE from 'three';
import { CHAPTERS } from '../content/life';
import { chapterSpans, riderAt } from '../journey/journey';
import { chapterAnchor } from './chapter-scene';
import { build, nearestOn, stats, stubCanvas, uniqueVertices, vertices } from './chapters/scene-contract';
import { stageAlong } from './chapters/rally';
import { LIGHT } from './chapters/war';
import { BENDS, DRIVE, EscapeRoute, driveAt, driveProgress } from './escape';
import { cameraPath, carFrom, pathT, roadStops } from './path';
import { RiderRig } from './rider-rig';
import { CARRIAGEWAY, PAVEMENT, Road } from './road';

const spans = chapterSpans();
const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;
const anchors = spans.map((_, i) => chapterAnchor(i));
const stops = roadStops(spans);
const path = cameraPath(anchors);
const WAR = span('war');
const RALLY = span('rally');

/** The escape road as the engine lays it (scene-engine.ts escapeRoute). */
function escape(): EscapeRoute {
  const anchor = anchors[WAR.index];
  const t = pathT(stops, spans.length, DRIVE.to);
  const end = carFrom(path.getPoint(t), new THREE.Vector3());
  const heading = path.getTangent(t).setY(0).normalize();
  const points = [
    anchor.clone().add(LIGHT).setY(0),
    ...BENDS.map(([x, z]) => new THREE.Vector3(anchor.x + x, 0, anchor.z + z)),
    end.clone().addScaledVector(heading, -10),
    end,
  ];
  return new EscapeRoute(points, anchor.clone().add(LIGHT));
}

/** The road as the engine lays it, posed for `progress`. */
function road(progress = 0): Road {
  const built = new Road(path, stops, spans, escape().length);
  built.update(progress);
  built.object.updateMatrixWorld(true);
  return built;
}

/** Where the car rides and which way it heads at `progress`, as the engine places it off the camera path. */
function carAt(progress: number): { position: THREE.Vector3; heading: THREE.Vector3; side: THREE.Vector3 } {
  const t = pathT(stops, spans.length, progress);
  const position = carFrom(path.getPoint(t), new THREE.Vector3());
  const heading = path.getTangent(t);
  const side = new THREE.Vector3().crossVectors(heading, new THREE.Vector3(0, 1, 0)).normalize();
  return { position, heading, side };
}

const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
/** The height of the visible road surface right under `point`, or null where there is none. */
function surface(built: Road, point: THREE.Vector3): number | null {
  ray.set(point.clone().setY(5), DOWN);
  const hit = ray.intersectObjects(built.object.children.filter((o) => o.visible))[0];
  return hit ? hit.point.y : null;
}

/** Whether the car's line at `progress` lies on the rally's gravel stage, which the road gives way to, or near its ends. */
function onStage(progress: number): 'inside' | 'end' | false {
  const { position } = carAt(progress);
  const mid = carAt((RALLY.start + RALLY.end) / 2);
  const along = position.clone().sub(mid.position).dot(mid.heading.clone().setY(0).normalize());
  const [from, to] = stageAlong(RALLY.index);
  if (along > from + 2 && along < to - 2) return 'inside';
  return along > from - 2 && along < to + 2 ? 'end' : false;
}

describe('the road', () => {
  beforeAll(stubCanvas);

  it('lies under the car wherever the camera road carries it, both wheels on the asphalt, from birth to IATA', () => {
    const built = road();
    let checked = 0;
    for (let i = 0; i <= 400; i++) {
      const p = i / 400;
      // The escape road carries the car in the drive (escape.spec.ts).
      if (driveAt(p) > 0 && driveAt(p) < 1) continue;
      built.update(p);
      const { position, side } = carAt(p);
      const stage = onStage(p);
      if (stage) {
        // Past where the asphalt tucks under the gravel at either end, the stage is all there is.
        if (stage === 'inside') expect(surface(built, position), `rally at ${p}`).toBeNull();
        continue;
      }
      for (const across of [-0.9, 0, 0.9]) {
        const y = surface(built, position.clone().addScaledVector(side, across));
        expect(y, `progress ${p.toFixed(4)}, ${across} m across`).not.toBeNull();
        // The asphalt (0.02) or the paint on it (0.03): never the kerb or the pavement.
        expect(y!).toBeLessThan(0.05);
      }
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('puts him on the pavement before the first car, and the kerb between him and the lane', () => {
    const built = road();
    const rig = new RiderRig();
    for (const p of [at('birth', 0.5), at('school', 0.5), at('lyceum', 0.3), at('university', 0.5), at('dreamweaver', 0.2)]) {
      const { position, heading, side } = carAt(p);
      rig.update(riderAt(p), p, position, heading, 3);
      rig.object.updateMatrixWorld(true);
      const root = (rig.object.children[0] as THREE.SkinnedMesh).skeleton.bones[0];
      const feet = root.getWorldPosition(new THREE.Vector3());
      const across = feet.clone().sub(position).dot(side);
      expect(across, `at ${p}`).toBeCloseTo(PAVEMENT.side, 5);
      expect(feet.y, `at ${p}`).toBeCloseTo(PAVEMENT.height, 5);
      expect(surface(built, feet), `pavement at ${p}`).toBeCloseTo(PAVEMENT.height, 3);
      // The kerb stands between the pavement and the car's lane.
      expect(surface(built, position.clone().addScaledVector(side, (PAVEMENT.side - 0.9) / 2))).toBeGreaterThan(0.1);
    }
    // At the Golf's door he has stepped down off the pavement beside it.
    const p = at('dreamweaver', 0.5);
    const { position, heading, side } = carAt(p);
    rig.update(riderAt(p), p, position, heading, 3);
    rig.object.updateMatrixWorld(true);
    const feet = (rig.object.children[0] as THREE.SkinnedMesh).skeleton.bones[0].getWorldPosition(new THREE.Vector3());
    expect(feet.clone().sub(position).dot(side)).toBeGreaterThan(PAVEMENT.side + 0.8);
    expect(feet.y).toBeLessThan(0.02);
  });

  it('meets the escape road where the car arrives on its section, and runs on from there in its place', () => {
    const route = escape();
    const t = pathT(stops, spans.length, DRIVE.to);
    const join = carFrom(path.getPoint(t), new THREE.Vector3());
    expect(route.curve.getPointAt(1).distanceTo(join)).toBeLessThan(1e-6);
    const heading = path.getTangent(t).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(heading, new THREE.Vector3(0, 1, 0));
    // Just past the join it is the escape road's width, centred on the car, and no kerb yet.
    const built = road(DRIVE.to);
    const ahead = join.clone().addScaledVector(heading, 0.4);
    for (const across of [-2.7, 0, 2.7]) expect(surface(built, ahead.clone().addScaledVector(side, across))).toBeLessThan(0.05);
    for (const across of [-3, 3]) expect(surface(built, ahead.clone().addScaledVector(side, across))).toBeNull();
  });

  it('shows the build-phase road until the car leaves the war on the escape road; the German road throughout', () => {
    const built = road();
    const shown = (name: string) => built.object.children.filter((o) => o.name === name).map((o) => o.visible);
    built.update(driveProgress(0) - 1e-4);
    expect(shown('road-kharkiv').every(Boolean)).toBe(true);
    expect(shown('road-germany')).toEqual([true]);
    for (const p of [driveProgress(0.5), at('ciklum', 0.9), at('iata', 0.5)]) {
      built.update(p);
      expect(shown('road-kharkiv').some(Boolean)).toBe(false);
      expect(shown('road-germany')).toEqual([true]);
    }
  });

  describe('keeps its asphalt clear of everything the chapters stand on the ground', () => {
    // The car's line, finely sampled, with its right: how far across it each point of a scene lies.
    const line = Array.from({ length: 4001 }, (_, k) => {
      const position = carFrom(path.getPoint(k / 4000), new THREE.Vector3());
      const heading = path.getTangent(k / 4000).setY(0).normalize();
      return { position, side: new THREE.Vector3().crossVectors(heading, new THREE.Vector3(0, 1, 0)) };
    });
    CHAPTERS.forEach((chapter, i) => {
      // The rally lays its own gravel stage in place of the road; the war stands where the car has no road.
      if (chapter.scene === 'rally' || chapter.scene === 'war') return;
      it(chapter.id, () => {
        const near = line.filter(({ position }) => Math.abs(position.z - anchors[i].z) < 30);
        const nearest = nearestOn(near, (l) => l.position);
        // One build, posed at each local in turn as the scroll would (scene-contract.ts: its state is the scroll's alone).
        const scene = build(chapter.id);
        for (const local of [0, 0.5, 1]) {
          scene.update?.({ progress: 0, local, time: 3 });
          scene.object.updateMatrixWorld(true);
          for (const v of uniqueVertices(scene.object)) {
            if (v.y > 0.3) continue;
            v.add(anchors[i]);
            // The last of the nearest, as a reduce keeping the earlier only when strictly nearer finds it.
            const closest = nearest(v.x, v.z, (l) => l.position.distanceToSquared(v), true);
            const across = v.clone().sub(closest.position).dot(closest.side);
            expect(across < CARRIAGEWAY.left || across > CARRIAGEWAY.right, `${chapter.id} at local ${local}: ${across.toFixed(2)} m across`).toBe(true);
          }
        }
      });
    });
  });

  it('is built the same every time', () => {
    const a = vertices(road().object).map((v) => v.toArray());
    expect(vertices(road().object).map((v) => v.toArray())).toEqual(a);
  });

  it('stays within budget: a few merged segments of one material, no lights or particles, low-poly per chapter', () => {
    const built = road();
    const { drawCalls, particles, lights } = stats(built.object);
    expect(drawCalls).toBeLessThanOrEqual(6);
    expect(particles).toBe(0);
    expect(lights).toBe(0);
    const materials = new Set(built.object.children.map((o) => (o as THREE.Mesh).material));
    expect(materials.size).toBe(1);
    // Every triangle counted to the chapter it lies nearest.
    const perChapter = anchors.map(() => 0);
    for (const v of vertices(built.object).filter((_, k) => k % 3 === 0)) {
      let best = 0;
      anchors.forEach((a, i) => (Math.hypot(v.x - a.x, v.z - a.z) < Math.hypot(v.x - anchors[best].x, v.z - anchors[best].z) ? (best = i) : 0));
      perChapter[best]++;
    }
    for (const n of perChapter) expect(n).toBeLessThanOrEqual(1000);
    for (const v of vertices(built.object)) expect(v.y).toBeLessThanOrEqual(0.15);
  });
});

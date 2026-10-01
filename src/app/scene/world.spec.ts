import * as THREE from 'three';
import { chapterSpans } from '../journey/journey';
import { chapterAnchor } from './chapter-scene';
import { nearestOn, stats, stubCanvas, uniquePoints } from './chapters/scene-contract';
import { DRIVE } from './escape';
import { cameraPath, carFrom } from './path';
import { World } from './world';

const spans = chapterSpans();
const anchors = spans.map((_, i) => chapterAnchor(i));
const path = cameraPath(anchors);
const WAR = spans.find((s) => s.chapter.phase === 'shatter')!;
/** Where the engine's camera stands over chapter `i` (scene-engine.ts CAMERA_OFFSET). */
const cameraAt = (i: number) => chapterAnchor(i).add(new THREE.Vector3(18, 7, 16));

function world(phone = false): World {
  const built = new World(path, spans, phone);
  built.object.updateMatrixWorld(true);
  return built;
}

const meshes = (w: World, name: string) => {
  const out: THREE.Mesh[] = [];
  w.object.traverse((o) => o instanceof THREE.Mesh && o.name.startsWith(name) && out.push(o));
  return out;
};

/** The world-space points of `mesh`'s geometry. */
function points(mesh: THREE.Mesh): THREE.Vector3[] {
  const position = mesh.geometry.getAttribute('position');
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i++)
    out.push(new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld));
  return out;
}

/** The car's line, sampled: a point and its right. */
const line = Array.from({ length: 3000 }, (_, k) => {
  const u = k / 2999;
  const at = carFrom(path.getPointAt(u), new THREE.Vector3()).setY(0);
  const heading = path.getTangentAt(u).setY(0).normalize();
  return { at, side: new THREE.Vector3().crossVectors(heading, new THREE.Vector3(0, 1, 0)).normalize() };
});

const nearest = nearestOn(line, (l) => l.at);

/** How far `p` stands to the right of the car's line (negative: the scenes' side). */
function across(p: THREE.Vector3): number {
  // The first of the nearest, as a scan keeping the earlier unless the later is strictly nearer finds it.
  const best = nearest(p.x, p.z, (l) => (l.at.x - p.x) ** 2 + (l.at.z - p.z) ** 2);
  return (p.x - best.at.x) * best.side.x + (p.z - best.at.z) * best.side.z;
}

describe('the world', () => {
  beforeAll(stubCanvas);

  it('rides a sky with the camera whose horizon is the fog, darker overhead, lifting with the dawn', () => {
    const w = world();
    const camera = cameraAt(5);
    const fog = new THREE.Color('#0d0f14');
    w.update(0.4, camera, 0, fog, true);
    expect(w.sky.position.equals(camera)).toBe(true);
    const position = w.sky.geometry.getAttribute('position');
    const colour = w.sky.geometry.getAttribute('color');
    const at = (y: (v: number) => boolean) => {
      for (let i = 0; i < position.count; i++)
        if (y(position.getY(i))) return new THREE.Color().fromBufferAttribute(colour, i);
      throw new Error('no such ring');
    };
    expect(at((y) => Math.abs(y) < 1e-3).getHex()).toBe(fog.getHex());
    const zenith = at((y) => y > 399);
    expect(zenith.r + zenith.g + zenith.b).toBeLessThan(fog.r + fog.g + fog.b);
    w.update(0.95, camera, 1, new THREE.Color('#1b2c40'), false);
    expect(at((y) => y > 399).b).toBeGreaterThan(zenith.b);
  });

  it('lays the ground under every chapter, the car and the road, from before birth to past IATA', () => {
    const ground = meshes(world(), 'ground');
    const ray = new THREE.Raycaster();
    const down = new THREE.Vector3(0, -1, 0);
    const probes = [...anchors, ...line.filter((_, k) => k % 50 === 0).map((l) => l.at)];
    for (const p of probes) {
      ray.set(new THREE.Vector3(p.x, 20, p.z), down);
      const hit = ray.intersectObjects(ground)[0];
      expect(hit, `${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBeDefined();
      expect(hit.point.y).toBeLessThan(0);
      expect(hit.point.y).toBeGreaterThan(-0.1);
    }
  });

  it('keeps its props off the chapters, the car, the road side the camera frames and the road itself', () => {
    for (const phone of [false, true]) {
      const props = meshes(world(phone), 'props-');
      expect(props.length).toBeGreaterThan(10);
      const bad: string[] = [];
      for (const mesh of props)
        for (const p of uniquePoints(points(mesh))) {
          const where = `${phone ? 'phone ' : ''}${mesh.name} ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`;
          for (const a of anchors) {
            const x = p.x - a.x;
            const z = p.z - a.z;
            if (Math.hypot(x, z) <= 12) bad.push(`${where} on a plot`);
            if (x > 11 && x < 13 && z > -0.5 && z < 4.5) bad.push(`${where} on the car`);
            if (x >= 4 && z >= 4 && z <= 20) bad.push(`${where} on the road side`);
          }
          if (p.y < 1 && across(p) >= -3.3) bad.push(`${where} on the road`);
        }
      expect(bad.slice(0, 20)).toEqual([]);
    }
  });

  it('builds the same world every time', () => {
    const all = (w: World) =>
      meshes(w, '').map((m) => Array.from(m.geometry.getAttribute('position').array as Float32Array));
    expect(all(world())).toEqual(all(world()));
  });

  it('holds its budget, lighter on a phone', () => {
    const built = world();
    const desktop = stats(built.object);
    const phone = stats(world(true).object);
    expect(desktop.drawCalls).toBeLessThanOrEqual(26);
    expect(desktop.triangles).toBeLessThan(32_000);
    expect(phone.triangles).toBeLessThan(desktop.triangles / 2);
    expect(desktop.lights).toBe(0);
    // The one desktop world, posed at each chapter in turn as the scroll would.
    for (const i of [1, 9, 13]) {
      built.update(i / 13, cameraAt(i), 0, new THREE.Color(), i < WAR.index);
      let drawn = 0;
      built.object.traverseVisible((o) => o instanceof THREE.Mesh && drawn++);
      expect(drawn, spans[i].chapter.id).toBeLessThanOrEqual(14);
    }
  });

  it('takes the world built before the war with the shatter, and shows the one after only from the drive', () => {
    const w = world();
    const shown = (name: string) => w.object.getObjectByName(name)!.visible;
    const props = (id: string) => meshes(w, `props-${id}`)[0];
    w.update(0.1, cameraAt(1), 0, new THREE.Color(), true);
    expect(shown('distance-before')).toBe(true);
    expect(shown('distance-after')).toBe(false);
    expect(props('school').visible).toBe(true);
    expect(props('ciklum').visible).toBe(false);
    w.update(DRIVE.from - 0.001, cameraAt(WAR.index), 0, new THREE.Color(), false);
    expect(shown('distance-before')).toBe(false);
    expect(shown('distance-after')).toBe(false);
    expect(props('school').visible).toBe(false);
    expect(meshes(w, 'ground').every((m) => m.visible)).toBe(true);
    w.update(DRIVE.from, cameraAt(12), 0, new THREE.Color(), false);
    expect(shown('distance-after')).toBe(true);
    expect(props('ciklum').visible).toBe(true);
    expect(props('school').visible).toBe(false);
  });
});

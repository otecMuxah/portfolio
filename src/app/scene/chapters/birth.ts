import * as THREE from 'three';
import { box, detailMesh, merge, paint, PaneRhythm, paneSlots, parapet, place, shade } from '../art/details';
import { kharkivSkyline, kharkivSkylinePoints } from '../art/kharkiv';
import { enter, glow, haloMap, leave, seeded, smoothstep } from '../art/kit';
import { PALETTE } from '../art/palette';
import { gather, gatherDelays } from '../art/particles';
import { ChapterBuilder } from '../chapter-scene';

/** Particles in the cloud; phones get half (#16). */
const COUNT = 1200;
const PHONE_COUNT = 600;
const SEED = 1981;

/** Window rhythms: Derzhprom's dense constructivist glazing, and the plainer walls of the blocks round it. */
const DERZHPROM_PANES: PaneRhythm = { w: 0.3, h: 0.34, dx: 0.46, dy: 0.62, bottom: 0.35, top: 0.2, start: 0.2, end: 0.12 };
const BLOCK_PANES: PaneRhythm = { w: 0.26, h: 0.36, dx: 0.62, dy: 0.8, bottom: 0.45, top: 0.25, start: 0.3, end: 0.2 };

/**
 * Detail on the skyline (#73), from its own faces so it follows the blocks: windows on the walls the road sees (+z
 * fronts and +x sides), a low parapet round every roof and setback, lift rooms on the panel blocks, and Derzhprom's
 * mast painted in the red and white bands of the real TV mast (en.wikipedia "Derzhprom").
 */
function skylineDressing(skyline: THREE.Group, phone: boolean): { walls: THREE.BufferGeometry; lit: THREE.BufferGeometry } {
  const random = seeded(SEED + 1);
  const walls: THREE.BufferGeometry[] = [];
  const lit: THREE.BufferGeometry[] = [];
  const bounds = new THREE.Box3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (const layer of skyline.children as THREE.Mesh[]) {
    const tint = (layer.material as THREE.MeshStandardMaterial).color.clone();
    const derzhprom = layer.name === 'derzhprom';
    const rhythm = derzhprom ? DERZHPROM_PANES : BLOCK_PANES;
    const pos = layer.geometry.getAttribute('position');
    // Merged boxes are non-indexed: every face is two consecutive triangles (six vertices).
    for (let i = 0; i < pos.count; i += 6) {
      a.fromBufferAttribute(pos, i);
      b.fromBufferAttribute(pos, i + 1);
      c.fromBufferAttribute(pos, i + 2);
      normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      bounds.makeEmpty();
      for (let k = 0; k < 6; k++) bounds.expandByPoint(a.fromBufferAttribute(pos, i + k));
      const w = bounds.max.x - bounds.min.x;
      const d = bounds.max.z - bounds.min.z;
      if (normal.y > 0.9) {
        // The mast's top is too small for a parapet.
        if (w < 0.5) continue;
        const x = (bounds.min.x + bounds.max.x) / 2;
        const z = (bounds.min.z + bounds.max.z) / 2;
        walls.push(place(parapet(w, d, { height: 0.12, thickness: 0.08, tint: shade(tint, 0.92), coping: shade(tint, 1.1), deck: shade(tint, 0.7) }), x, bounds.max.y, z));
        if (layer.name === 'panel-blocks' && !phone) walls.push(place(box(w * 0.3, 0.35, d * 0.3, tint, 0.85), x - w * 0.15, bounds.max.y, z - d * 0.1));
        continue;
      }
      const front = normal.z > 0.9;
      if (!front && normal.x < 0.9) continue;
      if (Math.max(w, d) < 0.5) continue;
      const across: [number, number] = front ? [bounds.min.x, bounds.max.x] : [bounds.min.z, bounds.max.z];
      for (const [u, y] of paneSlots(across, [bounds.min.y, bounds.max.y], rhythm)) {
        const on = random() < (derzhprom ? 0.3 : 0.4);
        const pane = paint(new THREE.PlaneGeometry(rhythm.w, rhythm.h), on ? 'dawnGold' : 'ground');
        if (front) pane.translate(u + rhythm.w / 2, y + rhythm.h / 2, bounds.max.z + 0.03);
        else pane.rotateY(Math.PI / 2).translate(bounds.max.x + 0.03, y + rhythm.h / 2, u + rhythm.w / 2);
        (on ? lit : walls).push(pane);
      }
    }
  }
  // The mast: red and white bands up the stylised mast block (x 0, z -2.1, y 8.75 to 10.15 in skyline space).
  for (let i = 0; i < 5; i++) walls.push(place(box(0.26, 0.28, 0.26, i % 2 ? 'chalk' : 'brick'), 0, 8.75 + i * 0.28, -2.1));
  return { walls: merge(walls), lit: merge(lit) };
}

/** 1981: warm particles drift in a wide cloud and gather into Kharkiv's skyline, which fades in as they land. */
export const birth: ChapterBuilder = (_chapter, _index, phone = false) => {
  const count = phone ? PHONE_COUNT : COUNT;
  const object = new THREE.Group();

  const skyline = kharkivSkyline();
  const dressing = skylineDressing(skyline, phone);
  skyline.add(detailMesh(dressing.walls), detailMesh(dressing.lit, glow('dawnGold', 0.8)));
  // The skyline's own copies of the shared materials, so fading it doesn't fade every other chapter.
  const fading: THREE.Material[] = [];
  skyline.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const material = (obj.material as THREE.Material).clone();
    material.transparent = true;
    obj.material = material;
    fading.push(material);
  });
  object.add(skyline);

  const random = seeded(SEED);
  const cloud = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // A wide flat ellipse over the plot, ending short of the car lane (z < 4).
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(random());
    cloud[i * 3] = Math.cos(angle) * r * 10;
    cloud[i * 3 + 1] = 2 + random() * 16;
    cloud[i * 3 + 2] = -4 + Math.sin(angle) * r * 6.5;
  }
  const targets = kharkivSkylinePoints(count, SEED);
  const delays = gatherDelays(count, SEED);
  const geometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(cloud.slice(), 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  const material = new THREE.PointsMaterial({
    color: PALETTE.dawnGold,
    map: haloMap(),
    size: 0.45,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(geometry, material);
  // The cloud's bounds change as it gathers; never cull it on stale bounds.
  particles.frustumCulled = false;
  particles.renderOrder = 1;
  object.add(particles);

  const positions = position.array as Float32Array;

  return {
    object,
    update({ local, time }) {
      const built = enter(local);
      const calm = leave(local);
      gather(positions, cloud, targets, delays, built);
      // Idle drift while scattered; it fades to nothing as the cloud lands.
      const drift = 0.35 * (1 - built);
      if (drift > 0) {
        for (let i = 0; i < positions.length; i++) positions[i] += Math.sin(time * 0.6 + i * 1.7) * drift;
      }
      position.needsUpdate = true;
      material.opacity = 0.95 - 0.35 * smoothstep(0.85, 1, built) - 0.3 * calm;

      const shown = smoothstep(0.55, 1, built);
      skyline.visible = shown > 0;
      for (const m of fading) m.opacity = shown;
    },
  };
};

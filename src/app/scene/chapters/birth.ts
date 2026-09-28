import * as THREE from 'three';
import { kharkivSkyline, kharkivSkylinePoints } from '../art/kharkiv';
import { enter, haloMap, leave, seeded, smoothstep } from '../art/kit';
import { PALETTE } from '../art/palette';
import { gather, gatherDelays } from '../art/particles';
import { ChapterBuilder } from '../chapter-scene';

const COUNT = 1200;
const SEED = 1981;

/** 1981: warm particles drift in a wide cloud and gather into Kharkiv's skyline, which fades in as they land. */
export const birth: ChapterBuilder = () => {
  const object = new THREE.Group();

  const skyline = kharkivSkyline();
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
  const cloud = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    // A wide flat ellipse over the plot, ending short of the car lane (z < 4).
    const angle = random() * Math.PI * 2;
    const r = Math.sqrt(random());
    cloud[i * 3] = Math.cos(angle) * r * 10;
    cloud[i * 3 + 1] = 2 + random() * 16;
    cloud[i * 3 + 2] = -4 + Math.sin(angle) * r * 6.5;
  }
  const targets = kharkivSkylinePoints(COUNT, SEED);
  const delays = gatherDelays(COUNT, SEED);
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

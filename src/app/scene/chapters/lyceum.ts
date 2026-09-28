import * as THREE from 'three';
import { block, enter, glow, leave, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { PALETTE } from '../art/palette';
import { ChapterBuilder } from '../chapter-scene';

const ORBIT_RADIUS = 5.2;
const ORBIT_Y = 7.4;
const ORBIT_Z = -3;
const MOTIF_SCALE = 1.25;
/** The roof line the motifs rise from as they build in. */
const ROOF_Y = 4.5;

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

/** Physics and Mathematics Lyceum No. 27: a chalk-white porticoed building with an atom, a sine wave, a pendulum and π orbiting above. */
export const lyceum: ChapterBuilder = () => {
  const object = new THREE.Group();

  const building = new THREE.Group();
  const pediment = new THREE.Shape([new THREE.Vector2(-3.3, 0), new THREE.Vector2(3.3, 0), new THREE.Vector2(0, 1.3)]);
  building.add(
    mergedMesh(
      [
        block(11, 4.3, 4, 0, -4),
        block(11.4, 0.3, 4.4, 0, -4, 4.3),
        // Portico: steps, four columns, entablature and pediment.
        block(7, 0.35, 1.8, 0, -0.9),
        ...[-2.4, -0.8, 0.8, 2.4].map((x) => new THREE.CylinderGeometry(0.28, 0.32, 3.6, 8).translate(x, 2.15, -0.9)),
        block(6.6, 0.55, 2, 0, -1, 3.95),
        new THREE.ExtrudeGeometry(pediment, { depth: 1.8, bevelEnabled: false }).translate(0, 4.5, -1.9),
      ],
      lowPoly('chalk'),
    ),
  );
  const windows: THREE.BufferGeometry[] = [];
  for (const x of [-4.6, -3.4, 3.4, 4.6]) for (const y of [0.6, 2.4]) windows.push(block(0.7, 1.1, 0.08, x, -2, y));
  const windowGlow = glow('candle', 0);
  building.add(mergedMesh(windows, windowGlow));
  object.add(building);

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
      building.visible = rise > 0;
      building.scale.y = Math.max(rise, 1e-3);
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

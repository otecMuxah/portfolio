import * as THREE from 'three';
import { block, enter, leave, lowPoly, mergedMesh, smoothstep } from '../art/kit';
import { ChapterBuilder } from '../chapter-scene';

const PILLAR_X = 3.6;
const PILLAR_Z = -2;
/** Top of each pillar's capital, where its crown sits. */
const CAPITAL_TOP = 4.8;
const FACE_ROAD = 0.4;

function pillar(x: number): THREE.Mesh {
  return mergedMesh(
    [
      block(2.3, 0.5, 2.3, 0, 0),
      new THREE.CylinderGeometry(0.72, 0.8, 3.7, 8).translate(0, 2.35, 0),
      block(2.1, 0.3, 2.1, 0, 0, 4.2),
      block(1.7, 0.3, 1.7, 0, 0, 4.5),
    ].map((g) => g.translate(x, 0, PILLAR_Z)),
    lowPoly('sandstone'),
  );
}

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

/** 1998–2004: two sandstone pillars, one per master's degree, crowned with a gear and with scales. */
export const university: ChapterBuilder = () => {
  const object = new THREE.Group();
  object.add(mergedMesh([block(11, 0.35, 4, 0, PILLAR_Z)], lowPoly('chalk')));

  const pillars = [pillar(-PILLAR_X), pillar(PILLAR_X)];
  pillars.forEach((p) => object.add(p));

  const cog = gear();
  const gearCrown = new THREE.Group();
  gearCrown.add(cog);
  cog.position.y = 1.5;
  const { crown: scalesCrown, beam, pans } = scales();
  const crowns = [gearCrown, scalesCrown];
  crowns.forEach((c, i) => {
    c.position.set(i ? PILLAR_X : -PILLAR_X, CAPITAL_TOP, PILLAR_Z);
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
      pillars.forEach((p, i) => {
        const rise = smoothstep(0.1 + 0.2 * i, 0.55 + 0.2 * i, built);
        p.visible = rise > 0;
        p.scale.y = Math.max(rise, 1e-3);
      });
      crowns.forEach((c, i) => {
        const land = smoothstep(0.7 + 0.1 * i, 0.9 + 0.1 * i, built);
        c.visible = land > 0;
        c.scale.setScalar(Math.max(land, 1e-3));
        c.position.y = CAPITAL_TOP + 2.5 * (1 - land);
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

import * as THREE from 'three';
import { CHAPTERS, CHAPTER_TEXT, ChapterId, Domain } from '../../content/life';
import { ROLES } from '../../content/cv';
import { chapterSpans } from '../../journey/journey';
import { ChapterScene, chapterAnchor } from '../chapter-scene';
import { build, built, solids, stubCanvas, uniqueVertices, vertices } from '../chapters/scene-contract';
import { LIGHT } from '../chapters/war';
import { BENDS, DRIVE, EscapeRoute } from '../escape';
import { CAMERA_OFFSET, cameraPath, carFrom, pathT, roadStops } from '../path';
import { Road } from '../road';
import { SLATS, slatTurn } from './nameplate';
import { badgeScale, ringRadius, RING_MAX_RADIUS, RING_MIN_RADIUS } from './tech-ring';
import { behindScene, chapterMoment, stepAt, stepMoment, stepWeight, workSteps } from './work-layer';

const CAREER: ChapterId[] = [
  'first-code',
  'kharkiv-career',
  'krakow',
  'back-home',
  'ciklum',
  'iata',
];
const CAREER_STEPS = CAREER.flatMap((id) => workSteps(id));

/** The CV's own words for each domain; a step shows one only where its CV entry says so. */
const DOMAIN_IN_CV: Record<Exclude<Domain, 'fintech'>, string> = {
  tailoring: 'tailoring',
  edtech: 'online learning',
  restaurants: 'restaurant management and delivery',
  healthcare: 'HIPAA',
  iot: 'IoT',
  'data-protection': 'cloud data-protection',
  aviation: 'aviation',
};

/** Domains the owner confirmed where the CV names none. */
const DOMAIN_FROM_OWNER: Record<string, Domain> = {
  'Corporate Finance Institute': 'edtech',
  Deloitte: 'fintech',
};

/** Everything the CV says about a company: its title and highlights. */
const cvText = (company: string) =>
  ROLES.filter((r) => r.company === company)
    .map((r) => [r.title, ...r.highlights].join(' '))
    .join(' ')
    .toLowerCase();

const steps = (from: number, to: number, n: number) =>
  Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);

describe('work layer content', () => {
  it('only career chapters carry roles, one step per company in date order', () => {
    const withRoles = CHAPTERS.filter((c) => CHAPTER_TEXT.en[c.id].roles?.length).map((c) => c.id);
    expect(withRoles).toEqual(CAREER);
    for (const id of CAREER) {
      const starts = workSteps(id).map((r) => parseInt(r.years, 10));
      expect(starts, id).toEqual([...starts].sort());
    }
  });

  it('names every company, and every employer a client was served through, as the CV does', () => {
    const companies = ROLES.map((r) => r.company);
    for (const role of CAREER_STEPS) {
      expect(companies).toContain(role.company);
      if (role.via) expect(companies).toContain(role.via);
    }
  });

  it("takes every technology from that company's CV entry, or its employer's", () => {
    for (const role of CAREER_STEPS) {
      expect(role.tech.length, role.company).toBeGreaterThan(0);
      const text = cvText(role.company) + ' ' + (role.via ? cvText(role.via) : '');
      for (const tech of role.tech)
        expect(text, `${role.company}: ${tech}`).toContain(tech.toLowerCase());
    }
  });

  it("keeps the owner's decisions: Ciklum's clients shown via Ciklum, places where he lived", () => {
    const via = Object.fromEntries(CAREER_STEPS.map((r) => [r.company, r.via]));
    expect(via['Redstor']).toBe('Ciklum');
    expect(via['Deloitte']).toBe('Ciklum');
    expect(CHAPTER_TEXT.en.ciklum.place).toBe('Aschaffenburg, Bavaria');
    expect(CHAPTER_TEXT.en.iata.place).toBe('Aschaffenburg, then Frankfurt');
  });

  it('shows a domain only where the CV or the owner states it', () => {
    for (const role of CAREER_STEPS) {
      const owner = DOMAIN_FROM_OWNER[role.company];
      if (owner) expect(role.domain, role.company).toBe(owner);
      else if (role.domain)
        expect(cvText(role.company), role.company).toContain(
          DOMAIN_IN_CV[role.domain as keyof typeof DOMAIN_IN_CV].toLowerCase(),
        );
    }
  });
});

describe('work layer steps', () => {
  it('shows the first company until the first turn and the last after the last', () => {
    for (const n of [1, 2, 3]) {
      expect(stepAt(-1, n)).toBe(0);
      expect(stepAt(stepMoment(0, n), n)).toBe(0);
      expect(stepAt(stepMoment(n - 1, n), n)).toBe(n - 1);
      expect(stepAt(3, n)).toBe(n - 1);
    }
  });

  it('frames each company alone at its moment, inside the chapter', () => {
    for (const n of [1, 2, 3]) {
      for (let k = 0; k < n; k++) {
        const at = stepAt(stepMoment(k, n), n);
        expect(at).toBe(k);
        expect(stepMoment(k, n)).toBeGreaterThan(0.2);
        expect(stepMoment(k, n)).toBeLessThan(0.8);
        for (let j = 0; j < n; j++) expect(stepWeight(j, at, n)).toBe(j === k ? 1 : 0);
      }
    }
  });

  it('turns forward only as the scroll goes on, and never shows two companies at full size at once', () => {
    const locals = steps(-0.5, 1.5, 400);
    const at = locals.map((l) => stepAt(l, 3));
    at.slice(1).forEach((a, i) => expect(a).toBeGreaterThanOrEqual(at[i]));
    for (const a of at) {
      const weights = [0, 1, 2].map((k) => stepWeight(k, a, 3));
      expect(weights.filter((w) => w > 0).length).toBeLessThanOrEqual(1);
    }
  });

  it('frames Ciklum’s companies only once the drive out of the war has arrived', () => {
    expect(chapterMoment('ciklum', 0)).toBeGreaterThanOrEqual(0.5);
    expect(chapterMoment('ciklum', 1)).toBeLessThan(0.7);
  });

  it("turns the sign's slats together, left to right, landing on whole faces", () => {
    for (let s = 0; s < SLATS; s++) {
      expect(slatTurn(0, s)).toBe(0);
      expect(slatTurn(1, s)).toBe(1);
      expect(slatTurn(2, s)).toBe(2);
    }
    expect(slatTurn(0.3, 0)).toBeGreaterThan(slatTurn(0.3, SLATS - 1));
  });

  it('brings badges in one by one and takes them away in reverse', () => {
    expect(badgeScale(0, 3, 0.5)).toBe(1);
    expect(badgeScale(1, 3, 0.5)).toBe(0.5);
    expect(badgeScale(2, 3, 0.5)).toBe(0);
    expect([0, 1, 2].map((i) => badgeScale(i, 3, 1))).toEqual([1, 1, 1]);
    expect([0, 1, 2].map((i) => badgeScale(i, 3, 0))).toEqual([0, 0, 0]);
  });

  it('sizes the ring to its badges, within bounds', () => {
    expect(ringRadius([1])).toBe(RING_MIN_RADIUS);
    expect(ringRadius(Array(40).fill(2))).toBe(RING_MAX_RADIUS);
  });
});

describe('work layer in the scene', () => {
  beforeAll(stubCanvas);

  const layer = (object: THREE.Object3D) => object.getObjectByName('work-layer');

  describe('stands in every career chapter and no other', () => {
    for (const c of CHAPTERS) it(c.id, () => expect(!!layer(build(c.id).object), c.id).toBe(CAREER.includes(c.id)));
  });

  it('sits in the anchor frame, however the chapter turns its own scene', () => {
    for (const id of CAREER) {
      const object = built(id, 0.5);
      const at = layer(object)!.getWorldPosition(new THREE.Vector3());
      const turn = layer(object)!.getWorldQuaternion(new THREE.Quaternion());
      expect(at.length(), id).toBeCloseTo(0, 5);
      expect(turn.angleTo(new THREE.Quaternion()), id).toBeCloseTo(0, 5);
    }
  });

  it('poses the same at each company step whichever way the scroll reached it', () => {
    for (const id of CAREER) {
      const n = workSteps(id).length;
      const scene = build(id);
      const pose = (local: number) => {
        scene.update?.({ progress: 0, local, time: 3 });
        const out: number[] = [];
        layer(scene.object)!.traverse((o) => {
          if (o instanceof THREE.Mesh)
            out.push(...(o.geometry.getAttribute('position').array as Float32Array));
          out.push(o.visible ? 1 : 0, ...o.scale.toArray());
        });
        return out.map((v) => v.toFixed(4));
      };
      for (let k = 0; k < n; k++) {
        const local = chapterMoment(id, k);
        const forward = pose(local);
        pose(1.5);
        pose(-0.5);
        expect(pose(local), `${id} step ${k}`).toEqual(forward);
      }
    }
  });

  /** The work layer's own plot: it stands behind the chapter's 12 m one, so it gets a wider radius. */
  const WORK_PLOT = 20;
  const LOCALS = [-0.5, 0, 0.5, 1, 2];
  /** The layer's vertices with its chapter's one build posed at `local`, as the scroll would pose it (its state is the scroll's alone). */
  const layerVertices = (scene: ChapterScene, local: number) => {
    scene.update?.({ progress: 0, local, time: 3 });
    scene.object.updateMatrixWorld(true);
    return uniqueVertices(layer(scene.object)!);
  };

  it('turns camera terms into the anchor frame: behind is away from the camera road, across is to screen right', () => {
    const back = behindScene(10, 0, 3);
    expect(back.y).toBe(3);
    expect(back.clone().setY(0).normalize().dot(CAMERA_OFFSET.clone().setY(0).normalize())).toBeCloseTo(-1, 6);
    const right = behindScene(0, 1, 0);
    expect(right.dot(CAMERA_OFFSET.clone().setY(0))).toBeCloseTo(0, 6);
    // Screen right of a camera looking along -(18, 16): +x, -z.
    expect(right.x).toBeGreaterThan(0);
    expect(right.z).toBeLessThan(0);
  });

  it(`stands behind the set piece from the chapter camera, past its 12 m plot and inside a ${WORK_PLOT} m one, under 22 m`, () => {
    const away = CAMERA_OFFSET.clone().setY(0).normalize().negate();
    for (const id of CAREER) {
      const scene = build(id);
      for (const local of LOCALS)
        for (const v of layerVertices(scene, local)) {
          const flat = Math.hypot(v.x, v.z);
          expect(flat, `${id} at ${local}`).toBeLessThanOrEqual(WORK_PLOT);
          expect(flat, `${id} at ${local}`).toBeGreaterThan(12);
          expect(v.clone().setY(0).dot(away), `${id} behind at ${local}`).toBeGreaterThan(6);
          expect(v.y, `${id} at ${local}`).toBeLessThanOrEqual(22);
        }
    }
  });

  it("keeps clear of the road, the pavement, the escape road and the neighbouring chapters' plots", () => {
    const spans = chapterSpans();
    const anchors = spans.map((_, i) => chapterAnchor(i));
    const stops = roadStops(spans);
    const path = cameraPath(anchors);
    // The escape road as the engine lays it (scene-engine.ts escapeRoute).
    const war = spans.find((s) => s.chapter.id === 'war')!;
    const t = pathT(stops, spans.length, DRIVE.to);
    const end = carFrom(path.getPoint(t), new THREE.Vector3());
    const escape = new EscapeRoute(
      [
        anchors[war.index].clone().add(LIGHT).setY(0),
        ...BENDS.map(([x, z]) => new THREE.Vector3(anchors[war.index].x + x, 0, anchors[war.index].z + z)),
        end.clone().addScaledVector(path.getTangent(t).setY(0).normalize(), -10),
        end,
      ],
      anchors[war.index].clone().add(LIGHT),
    );
    const road = new Road(path, stops, spans, escape.length);
    road.object.updateMatrixWorld(true);
    escape.object.updateMatrixWorld(true);
    // Paving vertices lie at most ~2 m from any point of their surface, so 4 m from every one keeps 2 m clear.
    const town = uniqueVertices(road.object);
    const out = uniqueVertices(escape.object.children[0]);
    for (const id of CAREER) {
      const index = CHAPTERS.findIndex((c) => c.id === id);
      // The escape road only shows once the world built before the war has broken (escape.ts, scene-engine.ts).
      const paving = CHAPTERS[index].phase === 'build' ? town : [...town, ...out];
      const near = paving.filter((p) => Math.hypot(p.x - anchors[index].x, p.z - anchors[index].z) < WORK_PLOT + 6);
      const scene = build(id);
      for (const local of LOCALS) {
        let toRoad = Infinity;
        let toNeighbour = Infinity;
        for (const v of layerVertices(scene, local)) {
          const at = v.add(anchors[index]);
          for (const p of near) toRoad = Math.min(toRoad, Math.hypot(at.x - p.x, at.z - p.z));
          anchors.forEach((a, j) => {
            if (j !== index) toNeighbour = Math.min(toNeighbour, Math.hypot(at.x - a.x, at.z - a.z));
          });
        }
        expect(toRoad, `${id} road at ${local}`).toBeGreaterThan(4);
        expect(toNeighbour, `${id} neighbours at ${local}`).toBeGreaterThan(12);
      }
    }
  });

  it('never meets its set piece, moving parts and all (the IATA planes included), however far the scroll', () => {
    const inside = new THREE.Vector3();
    for (const id of CAREER) {
      const scene = build(id);
      const work = layer(scene.object)!;
      const [sign, ring] = work.children;
      const plates: THREE.Mesh[] = [];
      sign.traverse((o) => o instanceof THREE.Mesh && plates.push(o));
      // The whole scroll, and closer through the fold-away (FOLD).
      for (const local of [...new Set([...steps(-0.5, 2, 40), ...steps(1, 1.3, 6)])]) {
        scene.update?.({ progress: 0, local, time: 3 + local * 10 });
        scene.object.updateMatrixWorld(true);
        work.visible = false;
        const set = vertices(scene.object);
        work.visible = true;
        const at = `${id} at ${local.toFixed(3)}`;
        // The sign's parts in their own frame, so a sign turned to the road is not judged by its axis-aligned box;
        // only the set's vertices inside that box's world bounds can be in it.
        for (const mesh of plates) {
          mesh.geometry.computeBoundingBox();
          const box = mesh.geometry.boundingBox!;
          const bounds = box.clone().applyMatrix4(mesh.matrixWorld);
          const toLocal = mesh.matrixWorld.clone().invert();
          const hit = set.find((v) => bounds.containsPoint(v) && box.containsPoint(inside.copy(v).applyMatrix4(toLocal)));
          expect(hit, at).toBeUndefined();
        }
        // The ring leans and turns, and its badges are small: a metre clear of every one of its vertices; only the
        // set's vertices within a metre of the ring's bounds can come that close.
        const hoop = vertices(ring);
        const reach = new THREE.Box3().setFromPoints(hoop).expandByScalar(1);
        const near = set.filter((v) => reach.containsPoint(v));
        expect(near.find((v) => hoop.some((h) => h.distanceTo(v) < 1)), at).toBeUndefined();
      }
    }
  });

  it("stays out of the near view of the camera at every other chapter and company, on desktop and on phones held either way", () => {
    const spans = chapterSpans();
    const anchors = spans.map((_, i) => chapterAnchor(i));
    const stops = roadStops(spans);
    const path = cameraPath(anchors);
    // Where the camera stands: every chapter's midpoint and every company's moment, as scene-engine.ts poses it; each
    // framing the chapter it stands nearest (the war's frames back home breaking).
    const views = spans.flatMap(({ chapter, start, end }) =>
      [0.5, ...workSteps(chapter.id).map((_, k) => chapterMoment(chapter.id, k))].map((local) => {
        const t = pathT(stops, spans.length, start + (end - start) * local);
        const progress = start + (end - start) * local;
        return { index: Math.round(t * (spans.length - 1)), at: `${chapter.id} at ${local.toFixed(2)}`, camera: path.getPoint(t), progress };
      }),
    );
    // Its framings on desktop and on phones held sideways and upright (scene-engine.ts).
    const framings = (camera: THREE.Vector3) => {
      const look = camera.clone().sub(CAMERA_OFFSET).add(new THREE.Vector3(0, 3, 0));
      const car = carFrom(camera, new THREE.Vector3());
      const portraitLook = look.clone().lerp(car, 0.5);
      return [
        { aspect: 1440 / 900, camera, look },
        { aspect: 844 / 390, camera: camera.clone().sub(look).multiplyScalar(1.3).add(look), look: look.clone().setY(0) },
        { aspect: 390 / 844, camera: camera.clone().sub(portraitLook).multiplyScalar(1.6).add(portraitLook), look: portraitLook },
      ];
    };
    const frustum = new THREE.Frustum();
    const close: string[] = [];
    for (const id of CAREER) {
      const index = CHAPTERS.findIndex((c) => c.id === id);
      const { start, end } = spans[index];
      const scene = build(id);
      for (const view of views) {
        if (view.index === index) continue;
        // Posed as it stands at that moment.
        const world = layerVertices(scene, (view.progress - start) / (end - start)).map((v) => v.add(anchors[index]));
        for (const { aspect, camera, look } of framings(view.camera)) {
          const eye = new THREE.PerspectiveCamera(55, aspect, 0.1, 500);
          eye.position.copy(camera);
          eye.lookAt(look);
          eye.updateMatrixWorld();
          frustum.setFromProjectionMatrix(eye.projectionMatrix.clone().multiply(eye.matrixWorldInverse));
          const near = Math.min(...world.filter((v) => frustum.containsPoint(v)).map((v) => v.distanceTo(camera)));
          if (near < 40) close.push(`${id} ${near.toFixed(1)} m from the camera at ${view.at}, ${aspect.toFixed(2)}`);
        }
      }
    }
    expect(close).toEqual([]);
  });
});

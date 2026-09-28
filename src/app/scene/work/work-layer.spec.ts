import * as THREE from 'three';
import { CHAPTERS, CHAPTER_TEXT, ChapterId, Domain } from '../../content/life';
import { ROLES } from '../../content/cv';
import { build, built, stubCanvas } from '../chapters/scene-contract';
import { SLATS, slatTurn } from './nameplate';
import { badgeScale, ringRadius, RING_MAX_RADIUS, RING_MIN_RADIUS } from './tech-ring';
import { chapterMoment, stepAt, stepMoment, stepWeight, workSteps } from './work-layer';

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

  it('stands in every career chapter and no other', () => {
    for (const c of CHAPTERS) expect(!!layer(build(c.id).object), c.id).toBe(CAREER.includes(c.id));
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
});

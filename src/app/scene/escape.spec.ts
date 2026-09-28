import * as THREE from 'three';
import { ESCAPE_ROUTE } from '../content/life';
import { chapterSpans, journeyAt } from '../journey/journey';
import { chapterAnchor } from './chapter-scene';
import { LIGHT } from './chapters/war';
import { CAR, ROAD_SIDE, stats, stubCanvas, vertices } from './chapters/scene-contract';
import { BENDS, DRIVE, EscapeRoute, SIGNS, SPLIT, chaseAt, driveAt, driveProgress, travelAt } from './escape';

const spans = chapterSpans();
const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
const WAR = span('war');
const CIKLUM = span('ciklum');

/** The road as the engine lays it: from under the war's light, through BENDS, to the car's place at Ciklum's anchor. */
function route(): EscapeRoute {
  const anchor = chapterAnchor(WAR.index);
  const light = anchor.clone().add(LIGHT);
  const end = chapterAnchor(CIKLUM.index).add(new THREE.Vector3(12, 0, 2));
  const heading = chapterAnchor(CIKLUM.index + 1).sub(chapterAnchor(CIKLUM.index - 1)).setY(0).normalize();
  const points = [
    light.clone().setY(0),
    ...BENDS.map(([x, z]) => new THREE.Vector3(anchor.x + x, 0, anchor.z + z)),
    end.clone().addScaledVector(heading, -10),
    end,
  ];
  return new EscapeRoute(points, light);
}

describe('the escape route', () => {
  beforeAll(stubCanvas);

  it('crosses the borders in the order he drove them, Moldova to Germany, a sign each, in order along the road', () => {
    expect(ESCAPE_ROUTE.map((c) => c.code)).toEqual(['MD', 'RO', 'SI', 'IT', 'FR', 'ES', 'FR', 'DE']);
    expect(SIGNS).toHaveLength(ESCAPE_ROUTE.length);
    SIGNS.forEach((s, i) => {
      expect(s).toBeGreaterThan(i ? SIGNS[i - 1] : 0);
      expect(s).toBeLessThan(1);
    });
  });

  it('runs late in the war, after its one light has been alone, to the middle of Ciklum, all of it in the F30', () => {
    expect(DRIVE.from).toBeGreaterThan(WAR.start + 0.8 * (WAR.end - WAR.start));
    expect(DRIVE.from).toBeLessThan(WAR.end);
    expect(DRIVE.to).toBeCloseTo((CIKLUM.start + CIKLUM.end) / 2);
    for (let i = 0; i <= 50; i++) expect(journeyAt(driveProgress(i / 50)).carId).toBe('f30');
  });

  it('is posed from scroll alone: drive, travel and chase are pure and never go back as scroll goes on', () => {
    expect(driveAt(0)).toBe(0);
    expect(driveAt(DRIVE.from)).toBe(0);
    expect(driveAt(DRIVE.to)).toBe(1);
    expect(driveAt(1)).toBe(1);
    expect(travelAt(0)).toBe(0);
    expect(travelAt(SPLIT)).toBeCloseTo(0);
    expect(travelAt(1)).toBeCloseTo(1);
    const steps = Array.from({ length: 401 }, (_, i) => i / 400);
    const forward = steps.map(travelAt);
    expect([...steps].reverse().map(travelAt).reverse()).toEqual(forward);
    forward.forEach((k, i) => i > 0 && expect(k).toBeGreaterThanOrEqual(forward[i - 1]));
    expect(chaseAt(0)).toBe(0);
    expect(chaseAt(0.5)).toBe(1);
    expect(chaseAt(1)).toBe(0);
  });

  it('puts the car in the same place at the same scroll, whichever way it was reached', () => {
    const road = route();
    const at = new THREE.Vector3();
    const heading = new THREE.Vector3();
    const pose = (u: number) => {
      road.pose(u, at, heading);
      road.update(driveProgress(u), 0);
      return [...at.toArray(), ...heading.toArray()].map((v) => v.toFixed(4));
    };
    const mid = pose(0.5);
    pose(0.9);
    pose(0.1);
    expect(pose(0.5)).toEqual(mid);
    road.pose(1, at, heading);
    expect(at.distanceTo(chapterAnchor(CIKLUM.index).add(new THREE.Vector3(12, 0, 2)))).toBeLessThan(1e-3);
  });

  it('is built the same every time', () => {
    const a = vertices(route().object).map((v) => v.toArray());
    expect(vertices(route().object).map((v) => v.toArray())).toEqual(a);
  });

  it('stays within a chapter budget: merged, no lights, low to the ground', () => {
    const road = route();
    road.update(driveProgress(0.5), 0);
    road.object.updateMatrixWorld(true);
    const { triangles, drawCalls, particles, lights } = stats(road.object);
    expect(triangles).toBeLessThanOrEqual(5000);
    expect(drawCalls).toBeLessThanOrEqual(25);
    expect(particles).toBeLessThanOrEqual(1500);
    expect(lights).toBe(0);
    for (const v of vertices(road.object)) expect(v.y).toBeLessThanOrEqual(22);
  });

  it('keeps its signs and reflectors off the plots of the chapters it passes, but for the road side they keep open', () => {
    const road = route();
    road.update(driveProgress(0.5), 0);
    road.object.updateMatrixWorld(true);
    const furniture = road.object.children.filter((o) => o instanceof THREE.Points || (o as THREE.Mesh).geometry?.getAttribute('uv'));
    for (const index of [WAR.index - 1, CIKLUM.index, CIKLUM.index + 1]) {
      const anchor = chapterAnchor(index);
      for (const v of furniture.flatMap(vertices)) {
        const local = v.clone().sub(anchor);
        const open = Math.hypot(local.x, local.z) > 12 || ROAD_SIDE.containsPoint(local) || CAR.containsPoint(local);
        expect(open, `${local.toArray().map((c) => c.toFixed(1))} from chapter ${index}`).toBe(true);
      }
    }
  });

  it('is shown only from the drive until the camera has gone on past Ciklum', () => {
    const road = route();
    road.update(driveProgress(0) - 0.001, 0);
    expect(road.object.visible).toBe(false);
    road.update(driveProgress(0.5), 0);
    expect(road.object.visible).toBe(true);
    road.update(span('iata').start + 0.001, 1);
    expect(road.object.visible).toBe(false);
  });
});

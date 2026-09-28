import * as THREE from 'three';
import { chapterSpans } from '../journey/journey';
import { DAWN, DRIVE, driveProgress } from './escape';
import { GRADE_UNIFORMS, dawnAt, gradeAt, gradeColor, graded } from './grade';

const spans = chapterSpans();
const span = (id: string) => spans.find((s) => s.chapter.id === id)!;
const at = (id: string, local: number) => span(id).start + (span(id).end - span(id).start) * local;

/** Runs a material's onBeforeCompile against the real three.js shaders, as the renderer would. */
function compiled(material: THREE.Material, kind: keyof typeof THREE.ShaderLib) {
  const lib = THREE.ShaderLib[kind];
  const shader = { uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader };
  material.onBeforeCompile(shader as never, undefined as never);
  return shader;
}

describe('gradeAt', () => {
  it('leaves the build phase in its authored colour, right up to the war', () => {
    for (const p of [0, at('family', 0.5), at('back-home', 0.5), at('war', 0)]) {
      expect(gradeAt(p)).toEqual({ saturation: 1, exposure: 1 });
    }
  });

  it('drains to grey and black through the war, never back up while it lasts', () => {
    let last = gradeAt(at('war', 0));
    for (let i = 1; i <= 100; i++) {
      const g = gradeAt(at('war', i / 100));
      expect(g.saturation).toBeLessThanOrEqual(last.saturation);
      expect(g.exposure).toBeLessThanOrEqual(last.exposure);
      last = g;
    }
    expect(gradeAt(at('war', 0.25)).saturation).toBeGreaterThan(0.2);
    expect(gradeAt(at('war', 0.25)).saturation).toBeLessThan(0.8);
    expect(gradeAt(at('war', 0.5))).toEqual({ saturation: 0, exposure: expect.closeTo(0.3) });
    expect(gradeAt(at('war', 0.999))).toEqual({ saturation: 0, exposure: expect.closeTo(0.3) });
  });

  it('holds the night on the road out of the war until past Italy', () => {
    for (const u of [0, 0.3, DAWN]) expect(gradeAt(driveProgress(u))).toEqual(gradeAt(at('war', 0.999)));
  });

  it('brings light and colour back from the drive through the rebuild, never down again, to full early in IATA', () => {
    const from = driveProgress(DAWN);
    let last = gradeAt(from);
    for (let i = 1; i <= 400; i++) {
      const g = gradeAt(from + (1 - from) * (i / 400));
      expect(g.saturation).toBeGreaterThanOrEqual(last.saturation);
      expect(g.exposure).toBeGreaterThanOrEqual(last.exposure);
      // Continuous: no step jumps, the drive hands over into Ciklum without a cut in the light.
      expect(g.saturation - last.saturation).toBeLessThan(0.02);
      expect(g.exposure - last.exposure).toBeLessThan(0.02);
      last = g;
    }
    // Light first, full as the car arrives, so the new place is seen going up; colour follows it.
    expect(gradeAt(DRIVE.to).exposure).toBeCloseTo(1);
    expect(gradeAt(at('ciklum', 0.5)).saturation).toBeGreaterThan(0.3);
    expect(gradeAt(at('ciklum', 0.5)).saturation).toBeLessThan(0.9);
    expect(gradeAt(at('iata', 0.25))).toEqual({ saturation: 1, exposure: 1 });
    expect(gradeAt(at('iata', 0.9))).toEqual({ saturation: 1, exposure: 1 });
    expect(gradeAt(1)).toEqual({ saturation: 1, exposure: 1 });
  });

  it('is a pure function of progress, whichever way it is reached, and writes into the object it is given', () => {
    const out = { saturation: 1, exposure: 1 };
    const steps = Array.from({ length: 201 }, (_, i) => i / 200);
    const forward = steps.map((p) => ({ ...gradeAt(p, out) }));
    const back = [...steps].reverse().map((p) => ({ ...gradeAt(p, out) })).reverse();
    expect(back).toEqual(forward);
    expect(gradeAt(0.5, out)).toBe(out);
  });
});

describe('dawnAt', () => {
  it('keeps the night until the road out of the war is past Italy, then turns the sky to dawn by IATA, the same way back', () => {
    for (const p of [0, at('back-home', 0.5), at('war', 0.5), at('ciklum', 0), driveProgress(DAWN)]) expect(dawnAt(p)).toBe(0);
    expect(dawnAt(at('ciklum', 0.5))).toBeGreaterThan(0);
    expect(dawnAt(at('ciklum', 0.5))).toBeLessThan(1);
    for (const p of [at('iata', 0.25), at('iata', 0.9), 1]) expect(dawnAt(p)).toBe(1);
    const steps = Array.from({ length: 101 }, (_, i) => i / 100);
    const forward = steps.map(dawnAt);
    expect([...steps].reverse().map(dawnAt).reverse()).toEqual(forward);
    forward.forEach((d, i) => i > 0 && expect(d).toBeGreaterThanOrEqual(forward[i - 1]));
  });
});

describe('graded materials', () => {
  it('grade the final colour, fog included, by the shared uniforms', () => {
    const material = new THREE.MeshStandardMaterial();
    graded(material);
    const shader = compiled(material, 'physical');
    expect(shader.fragmentShader).toMatch(/#include <fog_fragment>\s+float gradeLuma/);
    expect(shader.uniforms['uGradeSaturation']).toBe(GRADE_UNIFORMS.uGradeSaturation);
    expect(material.customProgramCacheKey()).toContain('graded');
  });

  it('covers sprites and points, so halos and particles drain too', () => {
    const sprite = new THREE.SpriteMaterial();
    const points = new THREE.PointsMaterial();
    graded(sprite);
    graded(points);
    expect(compiled(sprite, 'sprite').fragmentShader).toContain('gradeLuma');
    expect(compiled(points, 'points').fragmentShader).toContain('gradeLuma');
  });

  it('patch once, and leave the last light alone', () => {
    const material = new THREE.MeshBasicMaterial();
    graded(material);
    graded(material);
    expect(compiled(material, 'basic').fragmentShader.match(/gradeLuma =/g)).toHaveLength(1);
    const light = new THREE.MeshBasicMaterial();
    light.userData['ungraded'] = true;
    graded(light);
    expect(compiled(light, 'basic').fragmentShader).not.toContain('gradeLuma');
  });
});

describe('gradeColor', () => {
  it('drains the background as the shader drains pixels: grey at no saturation, darker with exposure', () => {
    const night = new THREE.Color('#0d0f14');
    const out = new THREE.Color();
    expect(gradeColor(night, { saturation: 1, exposure: 1 }, out).getHexString()).toBe('0d0f14');
    const drained = gradeColor(new THREE.Color('#ff8000'), { saturation: 0, exposure: 0.3 }, out).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    expect(drained.r).toBeCloseTo(drained.g);
    expect(drained.g).toBeCloseTo(drained.b);
    expect(drained.r).toBeLessThan(0.3);
  });
});

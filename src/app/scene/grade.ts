import * as THREE from 'three';
import { chapterSpans } from '../journey/journey';
import { smoothstep } from './art/kit';
import { DAWN, DRIVE, driveProgress } from './escape';

/** The phase grade at a scroll position: how much colour is left and how bright the world is. */
export interface Grade {
  /** 1 is authored colour, 0 is grey. */
  saturation: number;
  /** Multiplies the final colour: 1 is authored brightness, lower sinks toward black. */
  exposure: number;
}

/** How dark the war leaves the world: exposure at the fullest drain. */
const DARKEST = 0.3;
/** Colour is back in full this share of the way into the last rebuild chapter. */
const FULL = 0.25;

const SPANS = chapterSpans();
const WAR = SPANS.find((s) => s.chapter.phase === 'shatter')!;
const REBUILD = SPANS.filter((s) => s.chapter.phase === 'rebuild');
const LAST = REBUILD[REBUILD.length - 1];
/** Where the night starts to lift: on the road out of the war, past Italy (escape.ts). */
const FIRST_LIGHT = driveProgress(DAWN);

/**
 * The global grade from journey progress (art-direction.md: never baked into chapter materials). Colour drains to grey
 * and black through the war, and the drive out of it starts in that night. Past Italy light starts to return, a dawn
 * that is full as the car arrives in Ciklum, and colour follows it, fast at first and easing in, to full saturation
 * early in IATA. Pure and allocation-free: writes into `out`.
 */
export function gradeAt(progress: number, out: Grade = { saturation: 1, exposure: 1 }): Grade {
  const drained = smoothstep(0.05, 0.5, (progress - WAR.start) / (WAR.end - WAR.start));
  const dawn = smoothstep(FIRST_LIGHT, DRIVE.to, progress);
  const full = LAST.start + FULL * (LAST.end - LAST.start);
  const colour = Math.min(Math.max((progress - FIRST_LIGHT) / (full - FIRST_LIGHT), 0), 1);
  out.saturation = 1 - drained * (1 - colour) ** 2;
  out.exposure = 1 - (1 - DARKEST) * drained * (1 - dawn);
  return out;
}

/**
 * How far the sky has turned from night to the rebuild's dawn (PALETTE.dawnSky): none through the war and the first
 * half of the drive out of it, rising with the colour from past Italy through Ciklum, and whole from IATA on. Pure.
 */
export function dawnAt(progress: number): number {
  const full = LAST.start + FULL * (LAST.end - LAST.start);
  return smoothstep(FIRST_LIGHT, full, progress);
}

/** Shared by every graded program, so one write per frame grades the whole scene. */
export const GRADE_UNIFORMS = {
  uGradeSaturation: { value: 1 },
  uGradeExposure: { value: 1 },
};

const GRADE_FRAGMENT = /* glsl */ `
  float gradeLuma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb = mix(vec3(gradeLuma), gl_FragColor.rgb, uGradeSaturation) * uGradeExposure;`;

const patched = new WeakSet<THREE.Material>();

/**
 * Grades a material's final colour (fog included) by the shared uniforms. Patched once, before it first compiles;
 * materials flagged `userData['ungraded']` (the war's last light) keep their colour.
 */
export function graded(material: THREE.Material): void {
  if (patched.has(material) || material.userData['ungraded']) return;
  patched.add(material);
  const before = material.onBeforeCompile;
  const key = material.customProgramCacheKey;
  material.onBeforeCompile = (shader, renderer) => {
    before.call(material, shader, renderer);
    Object.assign(shader.uniforms, GRADE_UNIFORMS);
    shader.fragmentShader =
      'uniform float uGradeSaturation;\nuniform float uGradeExposure;\n' +
      shader.fragmentShader.replace('#include <fog_fragment>', `#include <fog_fragment>${GRADE_FRAGMENT}`);
  };
  material.customProgramCacheKey = () => `${key.call(material)}|graded`;
}

/** Grades every material under `object`. */
export function gradeAll(object: THREE.Object3D): void {
  object.traverse((obj) => {
    const material = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (material) [material].flat().forEach(graded);
  });
}

const rgb = { r: 0, g: 0, b: 0 };

/** Applies a grade to a colour on the CPU, as the shader does to pixels (the clear colour never passes a shader). */
export function gradeColor(source: THREE.Color, grade: Grade, target: THREE.Color): THREE.Color {
  source.getRGB(rgb, THREE.SRGBColorSpace);
  const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
  const mix = (c: number) => (luma + (c - luma) * grade.saturation) * grade.exposure;
  return target.setRGB(mix(rgb.r), mix(rgb.g), mix(rgb.b), THREE.SRGBColorSpace);
}

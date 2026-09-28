import * as THREE from 'three';
import { ChapterSpan, journeyAt, riderAt } from '../journey/journey';
import { PALETTE } from './art/palette';
import { CarRig } from './car-rig';
import { buildCar } from './cars';
import { ChapterScene, chapterAnchor } from './chapter-scene';
import { CHAPTER_BUILDERS } from './chapters';
import { LIGHT } from './chapters/war';
import { GRADE_UNIFORMS, dawnAt, gradeAll, gradeAt, gradeColor } from './grade';
import { f30Assembled } from './rebuild';
import { RiderRig } from './rider-rig';
import { Shatter, shakeAt } from './shatter';

/** The camera travels a road beside the scenes, framing each subject from the front-right (a 3/4 view). */
const CAMERA_OFFSET = new THREE.Vector3(18, 7, 16);
const LOOK_OFFSET = new THREE.Vector3(0, 3, 0);
/**
 * Where the car rides relative to the point the camera frames (camera minus CAMERA_OFFSET): at a chapter's
 * midpoint that is the anchor, putting the car on the road outside the scene footprint (art-direction.md).
 */
const CAR_OFFSET = new THREE.Vector3(12, 0, 2);
/**
 * In the war the camera parks just past back-home, so the world it built breaks in frame: it creeps this far (in
 * anchor units) and stops this share of the way into the chapter. The chapter after picks the road up from there.
 */
const WAR_PARK = 0.12;
const WAR_STOP = 0.3;
const NIGHT = new THREE.Color(PALETTE.night);
const DAWN_SKY = new THREE.Color(PALETTE.dawnSky);

/** Where the camera is along the road (anchor units) at given progress points; linear between them. */
function roadStops(spans: ChapterSpan[]): [progress: number, at: number][] {
  return spans.flatMap(({ chapter, index, start, end }): [number, number][] =>
    chapter.phase === 'shatter'
      ? [
          [start + WAR_STOP * (end - start), index - 1 + WAR_PARK],
          [end, index - 1 + WAR_PARK],
        ]
      : [[(start + end) / 2, index]],
  );
}

/** Owns the Three.js renderer, camera and loop. Runs outside Angular change detection. */
export class SceneEngine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private readonly anchors: THREE.Vector3[];
  private readonly path: THREE.CatmullRomCurve3;
  private readonly resizeObserver: ResizeObserver;
  /** Sparse until every chapter has been built. */
  private readonly chapterScenes: ChapterScene[] = [];
  private readonly clock = new THREE.Timer();
  private readonly carRig = new CarRig();
  /** Before the first car he travels the road himself, where the car rides later. */
  private readonly rider = new RiderRig();
  private readonly riderState = riderAt(0);
  private readonly carAt = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly look = new THREE.Vector3();
  private readonly shake = new THREE.Vector3();
  private readonly grade = gradeAt(0);
  private readonly sky = new THREE.Color();
  private readonly stops: [number, number][];
  /** The war chapter's span, and the world breaking in it once every chapter has been built. */
  private readonly war?: ChapterSpan;
  /** Where the war's last light hangs (world): the F30 assembles out of it. */
  private readonly lastLight = new THREE.Vector3();
  private shatter?: Shatter;
  private target = 0;
  private disposed = false;
  private current = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly spans: ChapterSpan[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.scene.background = new THREE.Color(PALETTE.night);
    this.scene.fog = new THREE.Fog(PALETTE.night, 20, 90);
    this.scene.add(new THREE.HemisphereLight(PALETTE.sky, PALETTE.ground, 1.2));
    // A low key light from the upper left gives flat-shaded facets readable contrast.
    const sun = new THREE.DirectionalLight(PALETTE.sun, 2);
    sun.position.set(-20, 30, 15);
    this.scene.add(sun);

    this.anchors = spans.map((_, i) => chapterAnchor(i));
    this.path = new THREE.CatmullRomCurve3(this.anchors.map((a) => a.clone().add(CAMERA_OFFSET)));
    this.stops = roadStops(spans);
    this.war = spans.find((s) => s.chapter.phase === 'shatter');
    if (this.war) this.lastLight.copy(this.anchors[this.war.index]).add(LIGHT);
    // Added before load() compiles so the car materials are ready with the first chapter.
    gradeAll(this.carRig.object);
    this.scene.add(this.carRig.object);
    gradeAll(this.rider.object);
    this.scene.add(this.rider.object);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  /**
   * Builds and compiles the first chapter, starts the loop and resolves: the page is ready.
   * The other chapters then build in the background, one per frame. Reports progress 0..1
   * toward that first chapter so the page can show a loader meanwhile.
   */
  async load(onProgress: (progress: number) => void): Promise<void> {
    onProgress(0);
    this.build(0);
    onProgress(0.5);
    await this.renderer.compileAsync(this.scene, this.camera);
    if (this.disposed) return;
    this.frame();
    this.renderer.setAnimationLoop(() => this.frame());
    // Dev builds only (stripped from prod): lets e2e read GPU memory, wait for the eased camera to settle
    // or every chapter (and the war's shards) to build, snap the camera to a progress so repeated passes draw the
    // same frames, and read the shards' budget and the last frame's draw calls.
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      Object.assign(window, {
        __sceneInfo: () => ({
          ...this.renderer.info.memory,
          settled: Math.abs(this.target - this.current) < 1e-4,
          built: this.chapterScenes.filter(Boolean).length === this.spans.length && (!this.war || !!this.shatter),
          shatter: this.shatter?.stats,
          frame: { ...this.renderer.info.render },
        }),
        __sceneJump: (progress: number) => (this.target = this.current = progress),
      });
    }
    onProgress(1);
    this.buildRest().catch((err) => console.warn('Chapter scenes failed to build', err));
  }

  private async buildRest(): Promise<void> {
    for (let i = 1; i < this.spans.length; i++) {
      await new Promise(requestAnimationFrame);
      if (this.disposed) return;
      // Compile now, not on the first frame that shows it, so scrolling there doesn't hitch.
      await this.renderer.compileAsync(this.build(i), this.camera, this.scene);
    }
    if (!this.war) return;
    await new Promise(requestAnimationFrame);
    if (this.disposed) return;
    this.shatter = this.breakable(this.war);
    this.scene.add(this.shatter.object);
    await this.renderer.compileAsync(this.shatter.object, this.camera, this.scene);
  }

  /**
   * Everything built before the war and the car carrying the camera, posed as they stand when the war starts, ready
   * to break. Runs once; the next frame poses the chapters for the real scroll again.
   */
  private breakable(war: ChapterSpan): Shatter {
    const time = this.clock.getElapsed();
    const sources: THREE.Object3D[] = [];
    this.spans.forEach(({ chapter, start, end }, i) => {
      const built = this.chapterScenes[i];
      if (chapter.phase !== 'build' || !built) return;
      built.update?.({ progress: war.start, local: (war.start - start) / (end - start), time });
      built.object.visible = true;
      sources.push(built.object);
    });
    const carId = journeyAt(war.start).carId;
    const car = carId ? buildCar(carId) : undefined;
    if (car) {
      // A stand-in where the rig stands at the war's start, so the live rig's own state is never touched.
      const t = this.pathT(war.start);
      car.position.copy(this.path.getPoint(t)).sub(CAMERA_OFFSET).add(CAR_OFFSET);
      this.path.getTangent(t, this.tangent);
      car.rotation.y = Math.atan2(-this.tangent.z, this.tangent.x);
      sources.push(car);
    }
    const shatter = new Shatter(sources);
    car?.traverse((obj) => (obj as THREE.Mesh).geometry?.dispose());
    return shatter;
  }

  private build(index: number): THREE.Object3D {
    const { chapter } = this.spans[index];
    const built = CHAPTER_BUILDERS[chapter.scene](chapter, index);
    gradeAll(built.object);
    built.object.position.add(this.anchors[index]);
    this.scene.add(built.object);
    this.chapterScenes[index] = built;
    return built.object;
  }

  /** Journey progress 0..1; the camera eases toward it each frame. */
  setProgress(progress: number): void {
    this.target = progress;
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
        obj.geometry.dispose();
        if (obj instanceof THREE.SkinnedMesh) obj.skeleton.dispose();
        [obj.material].flat().forEach((m: THREE.Material) => {
          if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose();
          m.dispose();
        });
      } else if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose();
        obj.material.dispose();
      }
    });
    this.renderer.dispose();
  }

  private frame(): void {
    this.current += (this.target - this.current) * 0.08;
    this.clock.update();
    const time = this.clock.getElapsed();
    this.spans.forEach(({ start, end }, i) =>
      this.chapterScenes[i]?.update?.({ progress: this.current, local: (this.current - start) / (end - start), time }),
    );
    // getPoint is uniform per segment, so t = i / (n - 1) lands exactly on anchor i.
    const t = this.pathT(this.current);
    this.camera.position.copy(this.path.getPoint(t));
    this.look.copy(this.camera.position).sub(CAMERA_OFFSET).add(LOOK_OFFSET);
    this.carAt.copy(this.camera.position).sub(CAMERA_OFFSET).add(CAR_OFFSET);
    const rider = riderAt(this.current, this.riderState);
    this.carRig.update(journeyAt(this.current).carId, this.carAt, this.path.getTangent(t, this.tangent), time, rider.arrival);
    this.rider.update(rider, this.current, this.carAt, this.tangent, time);

    const war = this.war ? (this.current - this.war.start) / (this.war.end - this.war.start) : 0;
    // Whole until the war; after it, assembled anew out of the last light.
    this.carRig.assemble(war >= 1 ? f30Assembled(this.current) : 1, this.lastLight);
    const roll = shakeAt(war, this.shake);
    this.camera.position.add(this.shake);
    this.camera.lookAt(this.look.add(this.shake));
    this.camera.rotateZ(roll);
    if (this.shatter) {
      // Once the war starts the world built before it, and the car, exist only as shards; after it, not at all. The
      // car comes back after the war, assembled anew out of the last light.
      const whole = this.shatter.update(war) <= 0;
      for (let i = 0; i < this.spans.length; i++) {
        const built = this.chapterScenes[i];
        if (built && this.spans[i].chapter.phase === 'build') built.object.visible = whole;
      }
      this.carRig.object.visible = whole || war >= 1;
    }

    gradeAt(this.current, this.grade);
    GRADE_UNIFORMS.uGradeSaturation.value = this.grade.saturation;
    GRADE_UNIFORMS.uGradeExposure.value = this.grade.exposure;
    // The rebuild opens the night into a dawn sky; the fog takes its colour so distance fades into it.
    this.sky.lerpColors(NIGHT, DAWN_SKY, dawnAt(this.current));
    (this.scene.fog as THREE.Fog).color.copy(this.sky);
    gradeColor(this.sky, this.grade, this.scene.background as THREE.Color);
    this.renderer.render(this.scene, this.camera);
  }

  /** The middle of each chapter's scroll span puts the camera on that chapter's anchor; the war parks it (roadStops). */
  private pathT(progress: number): number {
    const stops = this.stops;
    let at = stops[stops.length - 1][1];
    if (progress <= stops[0][0]) at = stops[0][1];
    else
      for (let i = 1; i < stops.length; i++) {
        if (progress < stops[i][0]) {
          const k = (progress - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
          at = stops[i - 1][1] + (stops[i][1] - stops[i - 1][1]) * k;
          break;
        }
      }
    return Math.min(Math.max(at / (this.spans.length - 1), 0), 1);
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}

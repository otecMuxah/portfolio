import * as THREE from 'three';

/** A region of the atlas in UV space (v up, as three samples it). */
export interface Cell {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Width over height of the region, so a plate can be sized to its text. */
  aspect: number;
}

/** What a nameplate face says: the company, then a small line (via, years, domain). */
export interface FaceText {
  name: string;
  line: string;
}

const WIDTH = 1536;
const FACE = { w: 768, h: 192 };
const LABEL = { w: 384, h: 72 };
const LABEL_FONT = 40;
/** Room either side of a label's text; wider than a badge's chamfered ends, so they never clip it. */
const LABEL_PAD = 26;
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/**
 * Every nameplate face and tech label of the work layer, drawn once into one canvas texture that all career chapters
 * share. Faces are white type on a dark ground, so a material's colour and emissive tint them; labels are dark type on
 * white, so a badge's vertex colour tints its plate and leaves the type dark.
 */
export class WorkAtlas {
  readonly texture: THREE.CanvasTexture;
  private readonly faces = new Map<string, Cell>();
  private readonly labels = new Map<string, Cell>();
  /** A white patch for a plate's sides and back. */
  readonly blank: Cell;

  constructor(faces: FaceText[], labels: string[]) {
    const uniqueFaces = [...new Map(faces.map((f) => [faceKey(f), f])).values()];
    const uniqueLabels = [...new Set(labels)];
    const faceCols = WIDTH / FACE.w;
    const labelCols = WIDTH / LABEL.w;
    const faceRows = Math.ceil(uniqueFaces.length / faceCols);
    const labelTop = faceRows * FACE.h;
    const blankTop = labelTop + Math.ceil(uniqueLabels.length / labelCols) * LABEL.h;
    const height = blankTop + 8;

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const cell = (x: number, y: number, w: number, h: number): Cell => ({
      u0: x / WIDTH,
      u1: (x + w) / WIDTH,
      v0: 1 - (y + h) / height,
      v1: 1 - y / height,
      aspect: w / h,
    });

    uniqueFaces.forEach((face, i) => {
      const x = (i % faceCols) * FACE.w;
      const y = Math.floor(i / faceCols) * FACE.h;
      if (ctx) drawFace(ctx, face, x, y);
      this.faces.set(faceKey(face), cell(x, y, FACE.w, FACE.h));
    });
    uniqueLabels.forEach((label, i) => {
      const x = (i % labelCols) * LABEL.w;
      const y = labelTop + Math.floor(i / labelCols) * LABEL.h;
      const width = ctx ? drawLabel(ctx, label, x, y) : LABEL.w;
      this.labels.set(label, cell(x, y, width, LABEL.h));
    });
    if (ctx) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, blankTop, 8, 8);
    }
    this.blank = cell(2, blankTop + 2, 4, 4);

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  face(face: FaceText): Cell {
    return this.faces.get(faceKey(face))!;
  }

  label(text: string): Cell {
    return this.labels.get(text)!;
  }
}

const faceKey = (f: FaceText) => `${f.name}\n${f.line}`;

/** The largest bold size (px) at which `text` fits `width`, capped at `max`. */
function fit(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): number {
  ctx.font = `700 ${max}px ${SANS}`;
  return Math.min(max, Math.floor((max * width) / Math.max(ctx.measureText(text).width, 1)));
}

/** Splits a name into two lines of near-equal length at a space. */
function balance(name: string): [string, string] {
  const words = name.split(' ');
  let best: [string, string] = [name, ''];
  let diff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    if (Math.abs(a.length - b.length) < diff) {
      diff = Math.abs(a.length - b.length);
      best = [a, b];
    }
  }
  return best;
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  { name, line }: FaceText,
  x: number,
  y: number,
): void {
  const inner = FACE.w - 72;
  ctx.fillStyle = '#10131a';
  ctx.fillRect(x, y, FACE.w, FACE.h);
  // A thin rule inset from the edge, like the trim of a lit sign box.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 12, y + 12, FACE.w - 24, FACE.h - 24);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = x + FACE.w / 2;
  const one = fit(ctx, name, inner, 96);
  if (one >= 70 || !name.includes(' ')) {
    ctx.font = `700 ${one}px ${SANS}`;
    ctx.fillText(name, cx, y + 76);
  } else {
    const [a, b] = balance(name);
    const size = Math.min(fit(ctx, a, inner, 58), fit(ctx, b, inner, 58));
    ctx.font = `700 ${size}px ${SANS}`;
    ctx.fillText(a, cx, y + 46);
    ctx.fillText(b, cx, y + 46 + size * 1.02);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  const small = fit(ctx, line.toUpperCase(), inner, 34);
  ctx.font = `600 ${small}px ${SANS}`;
  ctx.fillText(line.toUpperCase(), cx, y + FACE.h - 32);
}

/** Draws a label and returns the width (px) its plate needs. */
function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): number {
  const size = Math.min(LABEL_FONT, fit(ctx, text, LABEL.w - 2 * LABEL_PAD, LABEL_FONT));
  ctx.font = `700 ${size}px ${SANS}`;
  const width = Math.min(LABEL.w, Math.ceil(ctx.measureText(text).width) + 2 * LABEL_PAD);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, LABEL.h);
  ctx.fillStyle = '#10131a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + LABEL.h / 2 + 2);
  return width;
}

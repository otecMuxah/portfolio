/**
 * The procedurally generated soundtrack (original, no audio files): a warm, slowly breathing pad
 * and, for the war chapter, a low rumble. Browser only; construct it inside a user gesture.
 *
 * Pad: an open D add9 voicing (D2 A2 D3 F#3 A3 E4), two triangle
 * oscillators per note detuned ±7 cents, each note breathing on its own slow sine LFO
 * (0.031–0.096 Hz), all through one low-pass (1100 Hz, Q 0.6) whose cutoff drifts ±350 Hz at
 * 0.04 Hz. Rumble: looped brown noise through a 110 Hz low-pass with a 0.13 Hz swell, plus a 38 Hz
 * sine sub that wobbles ±1.5 Hz. Both buses feed a master gain.
 */

/** Bus levels at full: the pad sits quietly under the page; the rumble is felt more than heard. */
const AMBIENT_PEAK = 0.5;
const RUMBLE_PEAK = 0.9;
const MASTER_ON = 0.6;
/** Time constants (s) of the gain ramps: scroll changes, fading in, fading out. */
const FOLLOW = 0.3;
const FADE_IN = 0.8;
const FADE_OUT = 0.25;
/** Suspend the context this long after fading out, once the fade has settled. */
const SUSPEND_AFTER_MS = 1500;

const PAD_NOTES = [73.42, 110, 146.83, 185, 220, 329.63];
const NOTE_LEVEL = 0.06;

export class Soundscape {
  private readonly ctx = new AudioContext();
  private readonly master = this.ctx.createGain();
  private readonly ambient = this.ctx.createGain();
  private readonly rumble = this.ctx.createGain();
  private readonly sources: AudioScheduledSourceNode[] = [];
  private ambientTarget = -1;
  private rumbleTarget = -1;
  private suspendTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(ambient: number, rumble: number) {
    const { ctx } = this;
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    this.ambient.connect(this.master);
    this.rumble.connect(this.master);
    this.buildPad();
    this.buildRumble();
    this.ambient.gain.value = ambient * AMBIENT_PEAK;
    this.rumble.gain.value = rumble * RUMBLE_PEAK;
    this.ambientTarget = ambient;
    this.rumbleTarget = rumble;
    for (const source of this.sources) source.start();
  }

  /** Resolves true once audio is actually running (it stays suspended without a user gesture). */
  async enable(): Promise<boolean> {
    clearTimeout(this.suspendTimer);
    // Scheduled before resuming, so a disable() that lands meanwhile still wins.
    this.master.gain.setTargetAtTime(MASTER_ON, this.ctx.currentTime, FADE_IN);
    await this.ctx.resume().catch(() => undefined);
    return this.ctx.state === 'running';
  }

  disable(): void {
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, FADE_OUT);
    clearTimeout(this.suspendTimer);
    this.suspendTimer = setTimeout(() => this.ctx.suspend(), SUSPEND_AFTER_MS);
  }

  /** Glide each bus towards its level, 0..1. Only a changed target schedules a ramp. */
  setLevels(ambient: number, rumble: number): void {
    const now = this.ctx.currentTime;
    if (ambient !== this.ambientTarget) {
      this.ambientTarget = ambient;
      this.ambient.gain.setTargetAtTime(ambient * AMBIENT_PEAK, now, FOLLOW);
    }
    if (rumble !== this.rumbleTarget) {
      this.rumbleTarget = rumble;
      this.rumble.gain.setTargetAtTime(rumble * RUMBLE_PEAK, now, FOLLOW);
    }
  }

  dispose(): void {
    clearTimeout(this.suspendTimer);
    this.ctx.close();
  }

  private buildPad(): void {
    const { ctx } = this;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.6;
    filter.connect(this.ambient);
    this.lfo(0.04, 350, filter.frequency);

    PAD_NOTES.forEach((frequency, i) => {
      const note = ctx.createGain();
      note.gain.value = NOTE_LEVEL;
      note.connect(filter);
      // Each note breathes at its own slow rate, so the chord keeps shifting its weight.
      this.lfo(0.031 + i * 0.013, NOTE_LEVEL * 0.6, note.gain);
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        osc.connect(note);
        this.sources.push(osc);
      }
    });
  }

  private buildRumble(): void {
    const { ctx } = this;
    // Four seconds of brown noise, looped: long enough that the loop isn't heard as a pattern.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 110;
    low.Q.value = 0.9;
    const swell = ctx.createGain();
    swell.gain.value = 0.7;
    this.lfo(0.13, 0.3, swell.gain);
    noise.connect(low).connect(swell).connect(this.rumble);
    this.sources.push(noise);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 38;
    this.lfo(0.2, 1.5, sub.frequency);
    const subLevel = ctx.createGain();
    subLevel.gain.value = 0.35;
    sub.connect(subLevel).connect(this.rumble);
    this.sources.push(sub);
  }

  /** A slow sine that swings `param` by ±depth around its set value. */
  private lfo(rate: number, depth: number, param: AudioParam): void {
    const osc = this.ctx.createOscillator();
    osc.frequency.value = rate;
    const amount = this.ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount).connect(param);
    this.sources.push(osc);
  }
}

/**
 * WaterSoundEngine — procedural "underwater movement" sound (Web Audio only).
 *
 * Framework-agnostic: no React, no Three, no app state. A looping noise source
 * through a low-pass filter is the "swish"; its volume and brightness (cutoff)
 * are driven by a normalized motion level, panned in stereo. Short synthesized
 * "bloop" bubbles can be triggered on demand. Everything is heavily low-passed
 * so it reads as submerged rather than a splash in air.
 *
 * Autoplay policy: call `start()` from a user gesture (pointerdown/keydown).
 *
 * Usage:
 *   const engine = new WaterSoundEngine({ volume: 0.6 });
 *   document.addEventListener('pointerdown', () => engine.start(), { once: true });
 *   // per frame, from whatever motion source you have:
 *   engine.setMotion(level01, panMinus1to1);
 *   // occasionally:
 *   engine.bubble(pan, 1);
 */

export interface WaterSoundOptions {
  /** Master volume, 0..1. */
  volume?: number;
  /** Low-pass cutoff (Hz) when motion is zero — the dull rumble floor. */
  baseCutoff?: number;
  /** Low-pass cutoff (Hz) at full motion — brightness/turbulence ceiling. */
  maxCutoff?: number;
  /** Filter resonance. */
  q?: number;
  /** Smoothing time-constant (s) for the motion-driven params. */
  smoothing?: number;
  /** Length of the looping noise buffer (s). */
  noiseSeconds?: number;
}

type Required_<T> = { [K in keyof T]-?: T[K] };

export class WaterSoundEngine {
  private opts: Required_<WaterSoundOptions>;
  private ctx: AudioContext | null = null;
  private noise: AudioBufferSourceNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private swishGain: GainNode | null = null;
  private panner: StereoPannerNode | null = null;
  private master: GainNode | null = null;
  private enabled = true;

  constructor(options: WaterSoundOptions = {}) {
    this.opts = {
      volume: 0.6,
      baseCutoff: 450,
      maxCutoff: 2600,
      q: 0.6,
      smoothing: 0.08,
      noiseSeconds: 2,
      ...options,
    };
  }

  /** True once the audio graph is built. */
  get started(): boolean {
    return this.ctx !== null;
  }

  /** Build the graph (idempotent). Must be called from a user gesture. */
  start(): void {
    if (this.ctx) {
      this.ctx.resume?.();
      return;
    }
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    const ctx = new Ctx();

    // Looping white noise — the raw material for the swish.
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * this.opts.noiseSeconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.opts.baseCutoff;
    filter.Q.value = this.opts.q;

    const swishGain = ctx.createGain();
    swishGain.gain.value = 0;

    const panner = ctx.createStereoPanner();

    const master = ctx.createGain();
    master.gain.value = this.enabled ? this.opts.volume : 0;

    noise.connect(filter);
    filter.connect(swishGain);
    swishGain.connect(panner);
    panner.connect(master);
    master.connect(ctx.destination);
    noise.start();

    this.ctx = ctx;
    this.noise = noise;
    this.filter = filter;
    this.swishGain = swishGain;
    this.panner = panner;
    this.master = master;
    ctx.resume?.();
  }

  /**
   * Per-frame update.
   * @param level Normalized motion, 0 (still) .. 1 (fast). Higher = louder + brighter.
   * @param panX  Stereo position, -1 (left) .. 1 (right).
   */
  setMotion(level: number, panX = 0): void {
    if (!this.ctx || !this.swishGain || !this.filter || !this.panner) return;
    const l = Math.min(1, Math.max(0, level));
    const now = this.ctx.currentTime;
    const cutoff = this.opts.baseCutoff + l * (this.opts.maxCutoff - this.opts.baseCutoff);
    this.swishGain.gain.setTargetAtTime(l * 0.9, now, this.opts.smoothing);
    this.filter.frequency.setTargetAtTime(cutoff, now, this.opts.smoothing);
    this.panner.pan.setTargetAtTime(Math.min(1, Math.max(-1, panX)), now, this.opts.smoothing * 1.5);
  }

  setVolume(v: number): void {
    this.opts.volume = v;
    if (this.master && this.ctx && this.enabled) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
    }
  }

  setCutoffRange(base: number, max: number): void {
    this.opts.baseCutoff = base;
    this.opts.maxCutoff = max;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(on ? this.opts.volume : 0, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Trigger a short "bloop" bubble: a sine with a quick upward pitch sweep and
   * a fast amplitude blip — the classic water-drop resonance.
   * @param pan       Stereo position, -1..1.
   * @param gainScale Loudness multiplier.
   */
  bubble(pan = 0, gainScale = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = Math.min(1, Math.max(-1, pan));

    const f0 = 260 + Math.random() * 520;
    osc.frequency.setValueAtTime(f0 * 0.55, t);
    osc.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.07);

    const peak = 0.18 * gainScale;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    osc.connect(g);
    g.connect(p);
    p.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  dispose(): void {
    if (this.noise) {
      try { this.noise.stop(); } catch { /* already stopped */ }
    }
    this.ctx?.close?.();
    this.ctx = null;
    this.noise = null;
    this.filter = null;
    this.swishGain = null;
    this.panner = null;
    this.master = null;
  }
}

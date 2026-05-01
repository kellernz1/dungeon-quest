/**
 * Procedural audio system using the Web Audio API.
 * Generates all SFX synthetically — no external assets required.
 * Includes a low ambient dungeon drone that plays during gameplay.
 */

type SfxName =
  | 'attack_melee'
  | 'attack_ranged'
  | 'hit'
  | 'enemy_death'
  | 'player_hurt'
  | 'pickup_gold'
  | 'pickup_health'
  | 'pickup_weapon'
  | 'chest_open'
  | 'level_up'
  | 'dodge'
  | 'door'
  | 'ability'
  | 'game_over'
  | 'shop_buy';

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private muted = false;
  private musicNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  private musicStarted = false;
  private lastPlayed: Partial<Record<SfxName, number>> = {};

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dr_muted');
      this.muted = stored === '1';
    }
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const Ctor = (window.AudioContext || (window as any).webkitAudioContext);
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.7;
        this.master.connect(this.ctx.destination);

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(this.master);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0.25;
        this.musicBus.connect(this.master);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (typeof window !== 'undefined') localStorage.setItem('dr_muted', m ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(m ? 0 : 0.7, this.ctx.currentTime + 0.1);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggle(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** Initialize on first user gesture. */
  unlock() {
    this.ensure();
    if (!this.musicStarted) {
      this.musicStarted = true;
      this.startMusic();
    }
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(opts: {
    freq: number;
    type?: OscillatorType;
    duration: number;
    volume?: number;
    freqEnd?: number;
    attack?: number;
    delay?: number;
  }) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = this.now() + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t + opts.duration);
    }
    const peak = opts.volume ?? 0.3;
    const atk = opts.attack ?? 0.005;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + atk);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);
    osc.connect(gain).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + opts.duration + 0.05);
  }

  private noise(opts: { duration: number; volume?: number; freq?: number; q?: number; delay?: number }) {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus) return;
    const t = this.now() + (opts.delay ?? 0);
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * opts.duration));
    const buf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = opts.freq ?? 1200;
    filter.Q.value = opts.q ?? 1;
    const gain = ctx.createGain();
    const peak = opts.volume ?? 0.3;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + opts.duration);
    src.connect(filter).connect(gain).connect(this.sfxBus);
    src.start(t);
    src.stop(t + opts.duration + 0.05);
  }

  play(name: SfxName) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;

    // Throttle rapid repeats
    const nowMs = performance.now();
    const last = this.lastPlayed[name] ?? 0;
    const minGap: Partial<Record<SfxName, number>> = {
      hit: 40, attack_melee: 60, attack_ranged: 60,
    };
    if (nowMs - last < (minGap[name] ?? 20)) return;
    this.lastPlayed[name] = nowMs;

    switch (name) {
      case 'attack_melee':
        this.noise({ duration: 0.12, volume: 0.25, freq: 800, q: 2 });
        this.tone({ freq: 220, freqEnd: 110, type: 'square', duration: 0.08, volume: 0.12 });
        break;
      case 'attack_ranged':
        this.tone({ freq: 900, freqEnd: 1600, type: 'triangle', duration: 0.12, volume: 0.18 });
        break;
      case 'ability':
        this.tone({ freq: 200, freqEnd: 800, type: 'sawtooth', duration: 0.35, volume: 0.22 });
        this.tone({ freq: 400, freqEnd: 1200, type: 'sine', duration: 0.4, volume: 0.15, delay: 0.05 });
        break;
      case 'hit':
        this.noise({ duration: 0.08, volume: 0.18, freq: 600, q: 1 });
        break;
      case 'enemy_death':
        this.tone({ freq: 300, freqEnd: 80, type: 'sawtooth', duration: 0.25, volume: 0.22 });
        this.noise({ duration: 0.18, volume: 0.15, freq: 400 });
        break;
      case 'player_hurt':
        this.tone({ freq: 180, freqEnd: 90, type: 'square', duration: 0.22, volume: 0.28 });
        break;
      case 'pickup_gold':
        this.tone({ freq: 880, type: 'square', duration: 0.06, volume: 0.18 });
        this.tone({ freq: 1320, type: 'square', duration: 0.08, volume: 0.18, delay: 0.05 });
        break;
      case 'pickup_health':
        this.tone({ freq: 660, freqEnd: 990, type: 'sine', duration: 0.18, volume: 0.22 });
        break;
      case 'pickup_weapon':
        this.tone({ freq: 523, type: 'triangle', duration: 0.08, volume: 0.2 });
        this.tone({ freq: 659, type: 'triangle', duration: 0.08, volume: 0.2, delay: 0.07 });
        this.tone({ freq: 784, type: 'triangle', duration: 0.12, volume: 0.22, delay: 0.14 });
        break;
      case 'chest_open':
        this.noise({ duration: 0.18, volume: 0.18, freq: 2400, q: 4 });
        this.tone({ freq: 392, type: 'sine', duration: 0.18, volume: 0.18, delay: 0.08 });
        this.tone({ freq: 587, type: 'sine', duration: 0.24, volume: 0.22, delay: 0.18 });
        break;
      case 'level_up':
        this.tone({ freq: 523, type: 'triangle', duration: 0.12, volume: 0.22 });
        this.tone({ freq: 659, type: 'triangle', duration: 0.12, volume: 0.22, delay: 0.1 });
        this.tone({ freq: 784, type: 'triangle', duration: 0.14, volume: 0.22, delay: 0.2 });
        this.tone({ freq: 1047, type: 'triangle', duration: 0.32, volume: 0.26, delay: 0.3 });
        break;
      case 'dodge':
        this.noise({ duration: 0.18, volume: 0.18, freq: 1800, q: 3 });
        break;
      case 'door':
        this.tone({ freq: 140, freqEnd: 80, type: 'sawtooth', duration: 0.35, volume: 0.22 });
        this.noise({ duration: 0.2, volume: 0.12, freq: 300 });
        break;
      case 'shop_buy':
        this.tone({ freq: 988, type: 'square', duration: 0.08, volume: 0.18 });
        this.tone({ freq: 1319, type: 'square', duration: 0.1, volume: 0.18, delay: 0.07 });
        break;
      case 'game_over':
        this.tone({ freq: 392, freqEnd: 196, type: 'sawtooth', duration: 0.45, volume: 0.3 });
        this.tone({ freq: 294, freqEnd: 147, type: 'sawtooth', duration: 0.55, volume: 0.3, delay: 0.3 });
        this.tone({ freq: 196, freqEnd: 80, type: 'sawtooth', duration: 0.85, volume: 0.32, delay: 0.7 });
        break;
    }
  }

  /** Low ambient drone — two detuned oscillators with slow LFO. */
  private startMusic() {
    const ctx = this.ensure();
    if (!ctx || !this.musicBus) return;

    const make = (freq: number, type: OscillatorType, detune: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);
      osc.connect(gain).connect(this.musicBus!);
      osc.start();
      this.musicNodes.push({ osc, gain });
    };

    make(55, 'sine', 0);       // A1 root
    make(82.4, 'sine', -8);    // E2 fifth
    make(110, 'triangle', 5);  // A2 octave, gentle shimmer

    // Slow LFO on the music bus volume for breathing
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain).connect(this.musicBus.gain);
    lfo.start();
  }
}

export const audio = new AudioManager();

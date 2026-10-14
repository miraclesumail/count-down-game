/**
 * Audio Engine supporting Web Audio API procedural synthesis,
 * preset sound themes, custom audio uploads, and voice recording.
 */

export type SoundTheme = 'arcade' | 'mechanical' | 'synth' | 'chime';

export interface CustomSounds {
  win?: string;      // Base64 Data URL or Object URL
  fail?: string;     // Base64 Data URL or Object URL
  tick?: string;     // Base64 Data URL or Object URL
  countdown?: string;// Base64 Data URL or Object URL
}

export interface AudioSettings {
  muted: boolean;
  volume: number; // 0.0 to 1.0
  tickEnabled: boolean;
  theme: SoundTheme;
  customSounds: CustomSounds;
}

const DEFAULT_SETTINGS: AudioSettings = {
  muted: false,
  volume: 0.8,
  tickEnabled: true,
  theme: 'arcade',
  customSounds: {},
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = DEFAULT_SETTINGS;
  private audioElements: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    this.loadSettings();
  }

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
  }

  private loadSettings() {
    try {
      const saved = localStorage.getItem('chrono_precision_audio');
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
  }

  private saveSettings() {
    try {
      localStorage.setItem('chrono_precision_audio', JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  /**
   * Play custom audio data URL if set, otherwise fallback to procedural synthesis
   */
  private async playCustomOr(type: keyof CustomSounds, fallback: () => void) {
    if (this.settings.muted || this.settings.volume <= 0) return;

    const customUrl = this.settings.customSounds[type];
    if (customUrl) {
      try {
        let audio = this.audioElements.get(type);
        if (!audio || audio.src !== customUrl) {
          audio = new Audio(customUrl);
          this.audioElements.set(type, audio);
        }
        audio.currentTime = 0;
        audio.volume = this.settings.volume;
        await audio.play();
        return;
      } catch (e) {
        console.warn(`Failed to play custom sound for ${type}, falling back to synth`, e);
      }
    }

    // Fallback to Web Audio synthesis
    fallback();
  }

  /**
   * VICTORY / WIN SOUND
   */
  public playWin() {
    this.playCustomOr('win', () => {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const theme = this.settings.theme;
      const masterVol = ctx.createGain();
      masterVol.gain.value = this.settings.volume;
      masterVol.connect(ctx.destination);

      if (theme === 'arcade') {
        // High energy 8-bit arpeggio fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          gain.gain.setValueAtTime(0, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.2, now + idx * 0.08 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);

          osc.connect(gain);
          gain.connect(masterVol);

          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.3);
        });
      } else if (theme === 'chime') {
        // Pure harmonic bell triad
        const freqs = [523.25, 659.25, 783.99, 1046.50];
        freqs.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.25 / (i + 1), now + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

          osc.connect(gain);
          gain.connect(masterVol);

          osc.start(now);
          osc.stop(now + 1.2);
        });
      } else if (theme === 'mechanical') {
        // Crisp brass mechanical victory strike
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.6);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

        osc.connect(gain);
        gain.connect(masterVol);
        osc.start(now);
        osc.stop(now + 0.7);
      } else {
        // Modern Synth Chord
        [440, 554.37, 659.25, 880].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

          osc.connect(gain);
          gain.connect(masterVol);
          osc.start(now);
          osc.stop(now + 0.85);
        });
      }
    });
  }

  /**
   * DEFEAT / FAIL SOUND
   */
  public playFail() {
    this.playCustomOr('fail', () => {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const masterVol = ctx.createGain();
      masterVol.gain.value = this.settings.volume;
      masterVol.connect(ctx.destination);

      const theme = this.settings.theme;

      if (theme === 'arcade') {
        // 8-bit descending buzz
        const freqs = [330, 311.13, 293.66, 220];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0.2, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.16);

          osc.connect(gain);
          gain.connect(masterVol);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.18);
        });
      } else if (theme === 'chime') {
        // Low melancholy chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.6);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

        osc.connect(gain);
        gain.connect(masterVol);
        osc.start(now);
        osc.stop(now + 0.8);
      } else {
        // Deep thud / wah-wah
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.45);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + 0.45);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterVol);

        osc.start(now);
        osc.stop(now + 0.5);
      }
    });
  }

  /**
   * TICK SOUND (played on seconds or step intervals)
   */
  public playTick() {
    if (!this.settings.tickEnabled) return;
    this.playCustomOr('tick', () => {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = this.settings.theme === 'arcade' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

      gain.gain.setValueAtTime(this.settings.volume * 0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    });
  }

  /**
   * COUNTDOWN BEEP (3, 2, 1, GO)
   */
  public playCountdown(isGo = false) {
    if (this.settings.muted) return;
    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const freq = isGo ? 880 : 440;
    const duration = isGo ? 0.35 : 0.15;

    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(this.settings.volume * 0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /**
   * BUTTON CLICK HAPTIC SOUND
   */
  public playClick() {
    if (this.settings.muted) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(this.settings.volume * 0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // AudioContext may need user interaction
    }
  }
}

export const soundManager = new SoundManager();

/**
 * Audio Engine supporting Web Audio API procedural synthesis,
 * mobile (iOS/Android) touch-unlock, preset sound themes,
 * custom audio uploads, and voice recording.
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
  private isUnlocked: boolean = false;

  constructor() {
    this.loadSettings();
    this.setupMobileUnlockListeners();
  }

  /**
   * Set up passive touch listeners to unlock Web Audio on mobile browsers (iOS Safari, Android Chrome)
   */
  private setupMobileUnlockListeners() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlock();
      // Remove once unlocked
      window.removeEventListener('touchstart', unlockHandler);
      window.removeEventListener('touchend', unlockHandler);
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('click', unlockHandler);
    };

    window.addEventListener('touchstart', unlockHandler, { passive: true, once: false });
    window.addEventListener('touchend', unlockHandler, { passive: true, once: false });
    window.addEventListener('pointerdown', unlockHandler, { passive: true, once: false });
    window.addEventListener('click', unlockHandler, { passive: true, once: false });
  }

  /**
   * Explicitly unlock audio context on mobile user gesture
   */
  public unlock() {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      if (!this.isUnlocked) {
        // Play 1-sample silent buffer to satisfy iOS WebKit restrictions
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        this.isUnlocked = true;
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }
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
   * Attempt to play custom audio. If unavailable or fails, synchronously execute Web Audio fallback.
   */
  private playCustomOr(type: keyof CustomSounds, fallback: () => void) {
    if (this.settings.muted || this.settings.volume <= 0) return;

    // Make sure context is unblocked
    this.unlock();

    const customUrl = this.settings.customSounds[type];
    if (customUrl) {
      try {
        let audio = this.audioElements.get(type);
        if (!audio || audio.src !== customUrl) {
          audio = new Audio(customUrl);
          audio.setAttribute('playsinline', 'true');
          audio.setAttribute('webkit-playsinline', 'true');
          this.audioElements.set(type, audio);
        }
        audio.currentTime = 0;
        audio.volume = this.settings.volume;
        const promise = audio.play();
        if (promise !== undefined) {
          promise.catch(() => {
            // Fallback to synth if custom playback was blocked
            fallback();
          });
        }
        return;
      } catch {
        // Fallback to synth
      }
    }

    fallback();
  }

  /**
   * VICTORY / WIN SOUND
   */
  public playWin() {
    this.playCustomOr('win', () => {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const now = ctx.currentTime;
        const theme = this.settings.theme;
        const masterVol = ctx.createGain();
        masterVol.gain.value = Math.max(0.1, this.settings.volume);
        masterVol.connect(ctx.destination);

        if (theme === 'arcade') {
          // High energy 8-bit arpeggio fanfare (C5, E5, G5, C6, E6, G6)
          const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + idx * 0.07);

            gain.gain.setValueAtTime(0, now + idx * 0.07);
            gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.07 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.22);

            osc.connect(gain);
            gain.connect(masterVol);

            osc.start(now + idx * 0.07);
            osc.stop(now + idx * 0.07 + 0.25);
          });
        } else if (theme === 'chime') {
          // Harmonic bell triad
          const freqs = [523.25, 659.25, 783.99, 1046.50];
          freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3 / (i + 1), now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

            osc.connect(gain);
            gain.connect(masterVol);

            osc.start(now);
            osc.stop(now + 1.2);
          });
        } else if (theme === 'mechanical') {
          // Crisp brass bell strike
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(880, now);
          osc.frequency.exponentialRampToValueAtTime(440, now + 0.5);

          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

          osc.connect(gain);
          gain.connect(masterVol);
          osc.start(now);
          osc.stop(now + 0.6);
        } else {
          // Modern Synth Chord
          [440, 554.37, 659.25, 880].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

            osc.connect(gain);
            gain.connect(masterVol);
            osc.start(now);
            osc.stop(now + 0.75);
          });
        }
      } catch (err) {
        console.warn('Error in playWin:', err);
      }
    });
  }

  /**
   * DEFEAT / FAIL SOUND
   */
  public playFail() {
    this.playCustomOr('fail', () => {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const now = ctx.currentTime;
        const masterVol = ctx.createGain();
        masterVol.gain.value = Math.max(0.1, this.settings.volume);
        masterVol.connect(ctx.destination);

        const theme = this.settings.theme;

        if (theme === 'arcade') {
          // 8-bit descending buzz
          const freqs = [330, 311.13, 293.66, 220];
          freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, now + idx * 0.1);

            gain.gain.setValueAtTime(0.25, now + idx * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.14);

            osc.connect(gain);
            gain.connect(masterVol);

            osc.start(now + idx * 0.1);
            osc.stop(now + idx * 0.1 + 0.16);
          });
        } else if (theme === 'chime') {
          // Low melancholy bell
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(140, now + 0.6);

          gain.gain.setValueAtTime(0.35, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

          osc.connect(gain);
          gain.connect(masterVol);
          osc.start(now);
          osc.stop(now + 0.7);
        } else {
          // Deep thud
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(180, now);
          osc.frequency.exponentialRampToValueAtTime(70, now + 0.4);

          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

          osc.connect(gain);
          gain.connect(masterVol);

          osc.start(now);
          osc.stop(now + 0.45);
        }
      } catch (err) {
        console.warn('Error in playFail:', err);
      }
    });
  }

  /**
   * TICK SOUND
   */
  public playTick() {
    if (!this.settings.tickEnabled || this.settings.muted) return;
    this.playCustomOr('tick', () => {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = this.settings.theme === 'arcade' ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

        gain.gain.setValueAtTime(Math.max(0.05, this.settings.volume * 0.2), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.04);
      } catch {
        // ignore
      }
    });
  }

  /**
   * COUNTDOWN BEEP
   */
  public playCountdown(isGo = false) {
    if (this.settings.muted) return;
    this.unlock();
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const freq = isGo ? 880 : 440;
      const duration = isGo ? 0.35 : 0.15;

      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(Math.max(0.1, this.settings.volume * 0.35), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch {
      // ignore
    }
  }

  /**
   * BUTTON CLICK HAPTIC SOUND
   */
  public playClick() {
    if (this.settings.muted) return;
    this.unlock();
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(Math.max(0.05, this.settings.volume * 0.15), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // ignore
    }
  }
}

export const soundManager = new SoundManager();

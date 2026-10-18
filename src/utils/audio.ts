/**
 * Dual-Pipeline Audio Engine for 100% Cross-Platform Audio Reliability
 * (Desktop, iOS Safari, Android Chrome, WeChat, Mobile Webview)
 *
 * Pipeline 1: Web Audio API (AudioBufferSourceNode) for zero-latency instant playback
 * Pipeline 2: Pre-synthesized PCM WAV HTML5 Audio for mobile fallback & suspended context bypass
 */

import { 
  encodeWAV, 
  generateWinSamples, 
  generateFailSamples, 
  generateTickSamples, 
  generateBeepSamples, 
  generateClickSamples 
} from './soundGenerator';

export type SoundTheme = 'arcade' | 'mechanical' | 'synth' | 'chime';

export interface CustomSounds {
  win?: string;
  fail?: string;
  tick?: string;
  countdown?: string;
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
  volume: 0.85,
  tickEnabled: true,
  theme: 'arcade',
  customSounds: {},
};

class SoundManager {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings = DEFAULT_SETTINGS;
  private isUnlocked: boolean = false;
  private audioListeners: Set<(isUnlocked: boolean) => void> = new Set();

  // Cached AudioBuffers for Web Audio
  private bufferWin: AudioBuffer | null = null;
  private bufferFail: AudioBuffer | null = null;
  private bufferTick: AudioBuffer | null = null;
  private bufferBeep: AudioBuffer | null = null;
  private bufferBeepGo: AudioBuffer | null = null;
  private bufferClick: AudioBuffer | null = null;

  // Cached HTML5 Audio elements for mobile fallback
  private htmlAudioWin: HTMLAudioElement | null = null;
  private htmlAudioFail: HTMLAudioElement | null = null;
  private htmlAudioTick: HTMLAudioElement | null = null;
  private htmlAudioBeep: HTMLAudioElement | null = null;
  private htmlAudioBeepGo: HTMLAudioElement | null = null;
  private htmlAudioClick: HTMLAudioElement | null = null;

  // Custom audio elements
  private customAudioCache: Map<string, HTMLAudioElement> = new Map();

  constructor() {
    this.loadSettings();
    this.rebuildAudioCaches();
    this.setupGlobalUnlock();
  }

  public subscribeUnlock(cb: (isUnlocked: boolean) => void): () => void {
    this.audioListeners.add(cb);
    cb(this.isUnlocked);
    return () => {
      this.audioListeners.delete(cb);
    };
  }

  private notifyUnlock() {
    this.audioListeners.forEach((cb) => cb(this.isUnlocked));
  }

  /**
   * Rebuild synthesized WAV & AudioBuffers whenever theme changes
   */
  private rebuildAudioCaches() {
    try {
      const theme = this.settings.theme;

      // Generate raw float samples
      const winSamples = generateWinSamples(theme);
      const failSamples = generateFailSamples(theme);
      const tickSamples = generateTickSamples();
      const beepSamples = generateBeepSamples(false);
      const beepGoSamples = generateBeepSamples(true);
      const clickSamples = generateClickSamples();

      // Convert to WAV Data URLs
      const winWav = encodeWAV(winSamples);
      const failWav = encodeWAV(failSamples);
      const tickWav = encodeWAV(tickSamples);
      const beepWav = encodeWAV(beepSamples);
      const beepGoWav = encodeWAV(beepGoSamples);
      const clickWav = encodeWAV(clickSamples);

      // Create HTML5 Audio instances
      this.htmlAudioWin = this.createHTMLAudio(winWav);
      this.htmlAudioFail = this.createHTMLAudio(failWav);
      this.htmlAudioTick = this.createHTMLAudio(tickWav);
      this.htmlAudioBeep = this.createHTMLAudio(beepWav);
      this.htmlAudioBeepGo = this.createHTMLAudio(beepGoWav);
      this.htmlAudioClick = this.createHTMLAudio(clickWav);

      // Populate AudioBuffers if context exists
      if (this.ctx) {
        this.bufferWin = this.createAudioBuffer(winSamples);
        this.bufferFail = this.createAudioBuffer(failSamples);
        this.bufferTick = this.createAudioBuffer(tickSamples);
        this.bufferBeep = this.createAudioBuffer(beepSamples);
        this.bufferBeepGo = this.createAudioBuffer(beepGoSamples);
        this.bufferClick = this.createAudioBuffer(clickSamples);
      }
    } catch (e) {
      console.warn('Failed to rebuild audio caches:', e);
    }
  }

  private createHTMLAudio(src: string): HTMLAudioElement {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.setAttribute('playsinline', 'true');
    audio.setAttribute('webkit-playsinline', 'true');
    audio.volume = this.settings.volume;
    return audio;
  }

  private createAudioBuffer(samples: Float32Array): AudioBuffer {
    const ctx = this.getAudioContext();
    const buffer = ctx.createBuffer(1, samples.length, 22050);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  /**
   * Global unlock for mobile browsers
   */
  private setupGlobalUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlock();
    };

    // Multiple listeners to ensure any user interaction unlocks audio
    ['touchstart', 'touchend', 'click', 'pointerdown'].forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { passive: true });
    });
  }

  /**
   * Unlock Web Audio & HTML5 Audio
   */
  public unlock(): boolean {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
        ctx.resume();
      }

      // Rebuild Web Audio buffers if not already created
      if (!this.bufferWin) {
        this.rebuildAudioCaches();
      }

      // Play 1-sample silent buffer to unlock iOS Safari Web Audio
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);

      this.isUnlocked = true;
      this.notifyUnlock();
      return true;
    } catch {
      return false;
    }
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
    if (partial.theme) {
      this.rebuildAudioCaches();
    }
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
   * Dual-pipeline playback helper:
   * 1. Try Web Audio buffer source first (ultra low latency)
   * 2. If Web Audio is suspended or throws, fallback to HTML5 Audio element
   */
  private playSound(
    buffer: AudioBuffer | null,
    htmlAudio: HTMLAudioElement | null,
    customKey?: keyof CustomSounds
  ) {
    if (this.settings.muted || this.settings.volume <= 0) return;

    this.unlock();

    // Check if custom sound exists
    if (customKey && this.settings.customSounds[customKey]) {
      const customUrl = this.settings.customSounds[customKey]!;
      try {
        let customEl = this.customAudioCache.get(customKey);
        if (!customEl || customEl.src !== customUrl) {
          customEl = new Audio(customUrl);
          customEl.setAttribute('playsinline', 'true');
          customEl.setAttribute('webkit-playsinline', 'true');
          this.customAudioCache.set(customKey, customEl);
        }
        customEl.currentTime = 0;
        customEl.volume = this.settings.volume;
        customEl.play().catch(() => {
          // fallback to built-in sound if custom play failed
          this.playBuiltin(buffer, htmlAudio);
        });
        return;
      } catch {
        // fallback
      }
    }

    this.playBuiltin(buffer, htmlAudio);
  }

  private playBuiltin(buffer: AudioBuffer | null, htmlAudio: HTMLAudioElement | null) {
    let webAudioSuccess = false;

    // Pipeline 1: Web Audio BufferSource
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'running' && buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.value = this.settings.volume;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        webAudioSuccess = true;
      } else if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {
      webAudioSuccess = false;
    }

    // Pipeline 2: HTML5 Audio Fallback (essential for iOS Safari & Android Chrome when Web Audio is suspended or muted)
    if (!webAudioSuccess && htmlAudio) {
      try {
        htmlAudio.currentTime = 0;
        htmlAudio.volume = this.settings.volume;
        const playPromise = htmlAudio.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('HTML5 Audio fallback play blocked:', err);
          });
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Sound triggers
   */
  public playWin() {
    this.playSound(this.bufferWin, this.htmlAudioWin, 'win');
  }

  public playFail() {
    this.playSound(this.bufferFail, this.htmlAudioFail, 'fail');
  }

  public playTick() {
    if (!this.settings.tickEnabled) return;
    this.playSound(this.bufferTick, this.htmlAudioTick, 'tick');
  }

  public playCountdown(isGo = false) {
    if (isGo) {
      this.playSound(this.bufferBeepGo, this.htmlAudioBeepGo);
    } else {
      this.playSound(this.bufferBeep, this.htmlAudioBeep);
    }
  }

  public playClick() {
    this.playSound(this.bufferClick, this.htmlAudioClick);
  }
}

export const soundManager = new SoundManager();

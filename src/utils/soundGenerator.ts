/**
 * Pure JavaScript procedural sound generator.
 * Synthesizes high-fidelity sound waves into both Float32Array (for Web Audio AudioBuffer)
 * and Base64 PCM WAV Data URLs (for HTML5 Audio fallback on mobile devices).
 */

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function encodeWAV(samples: Float32Array, sampleRate = 22050): string {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

const SAMPLE_RATE = 22050;

/**
 * Generate Victory Fanfare Sound (Theme-aware)
 */
export function generateWinSamples(theme: string = 'arcade'): Float32Array {
  const duration = 0.65;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  if (theme === 'arcade') {
    // 8-bit upbeat arpeggio (C5, E5, G5, C6, E6, G6)
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    const noteLen = 0.09;
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteLen));
      const noteTime = t - noteIdx * noteLen;
      const freq = notes[noteIdx];
      // Square wave with envelope
      const env = Math.max(0, 1 - noteTime / (noteIdx === notes.length - 1 ? 0.3 : noteLen));
      const wave = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.4 : -0.4;
      samples[i] = wave * env * 0.7;
    }
  } else if (theme === 'chime') {
    // Harmonic bell triad
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      let sum = 0;
      freqs.forEach((freq, idx) => {
        const decay = Math.exp(-t * (3 + idx * 0.5));
        sum += Math.sin(2 * Math.PI * freq * t) * decay * (0.3 / (idx + 1));
      });
      samples[i] = sum * 0.9;
    }
  } else if (theme === 'mechanical') {
    // Brass strike
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const freq = 880 * Math.exp(-t * 2);
      const env = Math.exp(-t * 6);
      const wave = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * freq * t));
      samples[i] = wave * env * 0.75;
    }
  } else {
    // Future synth chord
    const freqs = [440, 554.37, 659.25, 880];
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-t * 4);
      let sum = 0;
      freqs.forEach((f) => {
        // Sawtooth
        const phase = (t * f) % 1;
        sum += (2 * phase - 1) * 0.2;
      });
      samples[i] = sum * env * 0.8;
    }
  }

  return samples;
}

/**
 * Generate Defeat / Fail Sound (Theme-aware)
 */
export function generateFailSamples(theme: string = 'arcade'): Float32Array {
  const duration = 0.55;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  if (theme === 'arcade') {
    // 8-bit descending buzz (E4 -> Eb4 -> D4 -> A3)
    const freqs = [329.63, 311.13, 293.66, 220.00];
    const noteLen = 0.12;
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const noteIdx = Math.min(freqs.length - 1, Math.floor(t / noteLen));
      const noteTime = t - noteIdx * noteLen;
      const freq = freqs[noteIdx];
      const env = Math.max(0, 1 - noteTime / (noteIdx === freqs.length - 1 ? 0.25 : noteLen));
      // Sawtooth-like buzz
      const phase = (t * freq) % 1;
      const wave = 2 * phase - 1;
      samples[i] = wave * env * 0.55;
    }
  } else if (theme === 'chime') {
    // Low melancholic chime
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const freq = 240 * Math.exp(-t * 0.8);
      const env = Math.exp(-t * 4);
      samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
    }
  } else {
    // Deep thud
    for (let i = 0; i < numSamples; i++) {
      const t = i / SAMPLE_RATE;
      const freq = 180 * Math.exp(-t * 4);
      const env = Math.exp(-t * 6);
      samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.85;
    }
  }

  return samples;
}

/**
 * Generate Crisp Tick Sound (18ms impulse)
 */
export function generateTickSamples(): Float32Array {
  const duration = 0.025; // 25ms
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 1400 * Math.exp(-t * 120);
    const env = Math.exp(-t * 140);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.8;
  }

  return samples;
}

/**
 * Generate Countdown Beep (440Hz / 880Hz)
 */
export function generateBeepSamples(isGo = false): Float32Array {
  const duration = isGo ? 0.3 : 0.15;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);
  const freq = isGo ? 880 : 440;

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.max(0, 1 - t / duration);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
  }

  return samples;
}

/**
 * Generate Click Tap Sound
 */
export function generateClickSamples(): Float32Array {
  const duration = 0.03;
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const freq = 800 * Math.exp(-t * 80);
    const env = Math.exp(-t * 90);
    samples[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.7;
  }

  return samples;
}

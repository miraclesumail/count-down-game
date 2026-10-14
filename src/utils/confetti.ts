import confetti from 'canvas-confetti';

export function triggerWinConfetti() {
  try {
    // Left burst
    confetti({
      particleCount: 70,
      angle: 60,
      spread: 55,
      origin: { x: 0.1, y: 0.7 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
    });
    // Right burst
    confetti({
      particleCount: 70,
      angle: 120,
      spread: 55,
      origin: { x: 0.9, y: 0.7 },
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
    });
  } catch (e) {
    console.warn('Confetti error', e);
  }
}

export function triggerPerfectConfetti() {
  try {
    const end = Date.now() + 1000;
    const interval: number = window.setInterval(() => {
      if (Date.now() > end) {
        clearInterval(interval);
        return;
      }
      confetti({
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: { x: Math.random(), y: Math.random() - 0.2 },
      });
    }, 200);
  } catch (e) {
    console.warn('Perfect confetti error', e);
  }
}

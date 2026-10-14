/**
 * Time calculation and formatting utilities for 0.01s (centisecond) precision timer.
 * 1 second = 100 centiseconds.
 * Range: 00 to 99 centiseconds, carrying over to seconds automatically.
 */

export interface ParsedTime {
  minutes: number;
  seconds: number;
  centiseconds: number;
  totalCentiseconds: number;
  formattedMinutes: string;
  formattedSeconds: string;
  formattedCentiseconds: string;
  displayShort: string; // e.g. "05:30" (Seconds:Centiseconds)
  displayFull: string;  // e.g. "00:05.30" (Minutes:Seconds.Centiseconds)
}

/**
 * Convert centiseconds to parsed components with automatic carry-over
 */
export function parseCentiseconds(totalCs: number): ParsedTime {
  const safeCs = Math.max(0, Math.floor(totalCs));
  const centiseconds = safeCs % 100;
  const totalSeconds = Math.floor(safeCs / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const formattedCentiseconds = centiseconds.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');

  return {
    minutes,
    seconds,
    centiseconds,
    totalCentiseconds: safeCs,
    formattedMinutes,
    formattedSeconds,
    formattedCentiseconds,
    displayShort: `${formattedSeconds}:${formattedCentiseconds}`,
    displayFull: `${formattedMinutes}:${formattedSeconds}.${formattedCentiseconds}`,
  };
}

/**
 * Generate a random challenge target within given seconds range (e.g. 3.00s to 8.99s)
 */
export function generateRandomTarget(minSeconds = 3, maxSeconds = 8): { targetCs: number; display: string } {
  const randomSec = Math.floor(Math.random() * (maxSeconds - minSeconds + 1)) + minSeconds;
  const randomCs = Math.floor(Math.random() * 100);
  const totalCs = randomSec * 100 + randomCs;
  const secStr = randomSec.toString().padStart(2, '0');
  const csStr = randomCs.toString().padStart(2, '0');
  return {
    targetCs: totalCs,
    display: `${secStr}:${csStr}`,
  };
}

export interface ChallengeResult {
  isWin: boolean;
  deltaCentiseconds: number;
  deltaSeconds: number;
  tolerance: number;
  targetCs: number;
  actualCs: number;
  targetDisplay: string;
  actualDisplay: string;
  accuracyPercent: number;
  score: number;
  verdictText: string;
  feedbackDetail: string;
  isExact: boolean;
}

/**
 * Evaluate if the user's stopped time is within target ± tolerance
 */
export function evaluateChallenge(
  actualCs: number,
  targetCs: number,
  tolerance = 20
): ChallengeResult {
  const delta = actualCs - targetCs;
  const absDelta = Math.abs(delta);
  const isWin = absDelta <= tolerance;
  const isExact = delta === 0;

  const actualParsed = parseCentiseconds(actualCs);
  const targetParsed = parseCentiseconds(targetCs);

  // Score calculation: 1000 base - penalty per centisecond error
  let score = 0;
  if (isWin) {
    score = Math.max(100, Math.round(1000 - (absDelta / tolerance) * 500));
    if (isExact) score += 500; // Exact match bonus
  }

  // Accuracy calculation based on target time
  const accuracyPercent = Math.max(0, Math.min(100, 100 - (absDelta / targetCs) * 100));

  let verdictText = '';
  let feedbackDetail = '';

  if (isExact) {
    verdictText = '神级命中！精准到0.00秒！';
    feedbackDetail = '你拥有超越常人的时间感！完美的毫秒级定格！';
  } else if (isWin) {
    if (absDelta <= 5) {
      verdictText = '极度惊险！绝佳直觉！';
    } else if (absDelta <= 10) {
      verdictText = '挑战成功！控制力惊人！';
    } else {
      verdictText = '挑战成功！压线过关！';
    }
    const diffSec = (absDelta / 100).toFixed(2);
    feedbackDetail = delta < 0
      ? `提前了 ${absDelta} 百分秒 (-${diffSec}s)，成功处于 ±${tolerance} 容差窗口内！`
      : `延后了 ${absDelta} 百分秒 (+${diffSec}s)，成功处于 ±${tolerance} 容差窗口内！`;
  } else {
    const diffSec = (absDelta / 100).toFixed(2);
    if (delta < 0) {
      verdictText = '按早啦！提前停止';
      feedbackDetail = `提前了 ${absDelta} 百分秒 (-${diffSec}s)，超出允许容差 (±${tolerance} 百分秒)。`;
    } else {
      verdictText = '慢了半拍！超时停止';
      feedbackDetail = `延后了 ${absDelta} 百分秒 (+${diffSec}s)，超出允许容差 (±${tolerance} 百分秒)。`;
    }
  }

  return {
    isWin,
    deltaCentiseconds: delta,
    deltaSeconds: Number((delta / 100).toFixed(2)),
    tolerance,
    targetCs,
    actualCs,
    targetDisplay: targetParsed.displayShort,
    actualDisplay: actualParsed.displayShort,
    accuracyPercent: Number(accuracyPercent.toFixed(1)),
    score,
    verdictText,
    feedbackDetail,
    isExact,
  };
}

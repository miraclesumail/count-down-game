import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, RotateCcw, Sliders, Trophy, Flame, 
  HelpCircle, Eye, EyeOff, Volume2, Settings2, ArrowRight, CheckCircle2, XCircle
} from 'lucide-react';
import { 
  parseCentiseconds, 
  generateRandomTarget, 
  evaluateChallenge, 
  ChallengeResult 
} from '../utils/time';
import { soundManager } from '../utils/audio';
import { triggerWinConfetti, triggerPerfectConfetti } from '../utils/confetti';

interface ChallengeHistoryItem {
  id: string;
  round: number;
  targetDisplay: string;
  actualDisplay: string;
  deltaCentiseconds: number;
  tolerance: number;
  isWin: boolean;
  score: number;
  timestamp: Date;
}

interface ChallengeViewProps {
  onOpenSoundSettings: () => void;
}

export const ChallengeView: React.FC<ChallengeViewProps> = ({ onOpenSoundSettings }) => {
  // Target time in centiseconds (e.g. 530 = 05:30 = 5 seconds 30 centiseconds)
  const [targetCs, setTargetCs] = useState<number>(530);
  const [targetDisplay, setTargetDisplay] = useState<string>('05:30');

  // Tolerance in centiseconds (Prompt specifies default ±20)
  const [tolerance, setTolerance] = useState<number>(20);

  // Timer running state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedCs, setElapsedCs] = useState<number>(0);

  // Result of current round
  const [lastResult, setLastResult] = useState<ChallengeResult | null>(null);

  // Game stats
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [bestStreak, setBestStreak] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('chrono_best_streak') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [totalWins, setTotalWins] = useState<number>(0);
  const [totalRounds, setTotalRounds] = useState<number>(0);
  const [totalScore, setTotalScore] = useState<number>(0);

  // Control options
  const [stopMode, setStopMode] = useState<'tap' | 'hold'>('tap');
  const [isBlindfold, setIsBlindfold] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);

  // Target Range Config
  const [minTargetSec, setMinTargetSec] = useState<number>(3);
  const [maxTargetSec, setMaxTargetSec] = useState<number>(8);

  // History
  const [history, setHistory] = useState<ChallengeHistoryItem[]>([]);

  // Refs for high performance loop
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(-1);
  const isHoldingRef = useRef<boolean>(false);

  // Generate new random target
  const rollNewTarget = useCallback(() => {
    const { targetCs: newTarget, display } = generateRandomTarget(minTargetSec, maxTargetSec);
    setTargetCs(newTarget);
    setTargetDisplay(display);
    setLastResult(null);
    setElapsedCs(0);
  }, [minTargetSec, maxTargetSec]);

  // Start the timer
  const startTimer = useCallback(() => {
    if (isRunning) return;
    setLastResult(null);
    setElapsedCs(0);
    lastTickSecRef.current = -1;
    startTimeRef.current = performance.now();
    setIsRunning(true);
    soundManager.playClick();

    const loop = (now: number) => {
      const elapsedMs = now - startTimeRef.current;
      const currentCs = Math.floor(elapsedMs / 10);
      setElapsedCs(currentCs);

      // Audio tick every whole second
      const currentSec = Math.floor(currentCs / 100);
      if (currentSec !== lastTickSecRef.current) {
        lastTickSecRef.current = currentSec;
        soundManager.playTick();
      }

      // Max timeout safeguard (e.g. 60 seconds)
      if (currentCs > 5999) {
        stopTimer(5999);
        return;
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [isRunning]);

  // Stop the timer and judge result
  const stopTimer = useCallback((forceCs?: number) => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsRunning(false);

    // Compute accurate final centiseconds
    const finalCs = forceCs !== undefined ? forceCs : Math.floor((performance.now() - startTimeRef.current) / 10);
    setElapsedCs(finalCs);

    // Evaluate win/loss
    const result = evaluateChallenge(finalCs, targetCs, tolerance);
    setLastResult(result);

    // Update stats
    setTotalRounds((prev) => prev + 1);
    if (result.isWin) {
      soundManager.playWin();
      if (result.isExact) {
        triggerPerfectConfetti();
      } else {
        triggerWinConfetti();
      }
      setCurrentStreak((prev) => {
        const next = prev + 1;
        if (next > bestStreak) {
          setBestStreak(next);
          try {
            localStorage.setItem('chrono_best_streak', next.toString());
          } catch {
            // ignore
          }
        }
        return next;
      });
      setTotalWins((prev) => prev + 1);
      setTotalScore((prev) => prev + result.score);
    } else {
      soundManager.playFail();
      setCurrentStreak(0);
    }

    // Add to history
    setHistory((prev) => [
      {
        id: Math.random().toString(36).substring(2, 9),
        round: totalRounds + 1,
        targetDisplay,
        actualDisplay: result.actualDisplay,
        deltaCentiseconds: result.deltaCentiseconds,
        tolerance,
        isWin: result.isWin,
        score: result.score,
        timestamp: new Date(),
      },
      ...prev.slice(0, 19), // keep last 20 rounds
    ]);
  }, [targetCs, tolerance, targetDisplay, totalRounds, bestStreak]);

  // Handle Spacebar keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (stopMode === 'hold') {
          if (!isRunning && !isHoldingRef.current) {
            isHoldingRef.current = true;
            startTimer();
          }
        } else {
          // Tap mode
          if (isRunning) {
            stopTimer();
          } else {
            startTimer();
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (stopMode === 'hold' && isHoldingRef.current) {
          isHoldingRef.current = false;
          if (isRunning) {
            stopTimer();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRunning, stopMode, startTimer, stopTimer]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const parsedCurrent = parseCentiseconds(elapsedCs);
  const parsedTarget = parseCentiseconds(targetCs);

  // Compute tolerance window bounds
  const minValidCs = Math.max(0, targetCs - tolerance);
  const maxValidCs = targetCs + tolerance;
  const parsedMinValid = parseCentiseconds(minValidCs);
  const parsedMaxValid = parseCentiseconds(maxValidCs);

  // Blindfold display logic: hide digits if running > 1.5s in blindfold mode
  const shouldMaskTimer = isBlindfold && isRunning && elapsedCs > 150;

  // Preset tolerances
  const tolerancePresets = [
    { value: 5, label: '±5 (极难 0.05s)', desc: '职业级毫秒直觉' },
    { value: 10, label: '±10 (进阶 0.10s)', desc: '高难度心跳考验' },
    { value: 20, label: '±20 (推荐 0.20s)', desc: '最佳平衡度(默认)' },
    { value: 35, label: '±35 (宽松 0.35s)', desc: '适合派对娱乐' },
    { value: 50, label: '±50 (入门 0.50s)', desc: '宽裕练习窗口' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Top HUD: Score & Streaks */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">当前连胜</div>
              <div className="text-xl font-bold font-mono-numbers text-white flex items-center gap-1.5">
                {currentStreak}
                {currentStreak > 2 && <span className="text-xs text-amber-400 font-sans">🔥连胜中</span>}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 border-l border-slate-800 pl-6">
            <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">历史最高连胜</div>
              <div className="text-xl font-bold font-mono-numbers text-slate-200">
                {bestStreak}
              </div>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2.5 border-l border-slate-800 pl-6">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">总胜率 / 场次</div>
              <div className="text-sm font-semibold text-slate-300 font-mono-numbers">
                {totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0}% 
                <span className="text-xs text-slate-500 font-normal ml-1.5">({totalWins}/{totalRounds})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsBlindfold(!isBlindfold)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isBlindfold 
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800/60 border-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="蒙眼模式：计时超过1.5秒后隐藏时间，凭直觉停秒"
          >
            {isBlindfold ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {isBlindfold ? '蒙眼已开启' : '蒙眼模式'}
          </button>

          <button
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-750 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            容差设置 (±{tolerance})
          </button>

          <button
            onClick={onOpenSoundSettings}
            className="p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-750 transition-colors"
            title="自定义音效设置"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Tolerance & Rule Drawer */}
      {showSettingsDrawer && (
        <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">停秒挑战容差调节 (Tolerance Window)</h3>
            </div>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              收起
            </button>
          </div>

          <p className="text-xs text-slate-400">
            当停止的时间落在 <span className="text-blue-400 font-mono font-medium">目标值 ± 容差</span> 的区间内时判定为挑战成功。默认值为 <span className="text-emerald-400 font-semibold font-mono">±20</span> (即允许误差 0.20 秒)。
          </p>

          {/* Quick presets */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {tolerancePresets.map((preset) => {
              const active = tolerance === preset.value;
              return (
                <button
                  key={preset.value}
                  onClick={() => {
                    setTolerance(preset.value);
                    soundManager.playClick();
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all ${
                    active
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                      : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{preset.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Slider for precision custom adjustment */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span>微调容差值: <strong className="text-blue-400 font-mono">±{tolerance} 百分秒 (±{(tolerance / 100).toFixed(2)}s)</strong></span>
                <span className="text-slate-500">1 ~ 99 百分秒</span>
              </div>
              <input
                type="range"
                min="1"
                max="99"
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Target seconds range */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-slate-400">目标范围:</span>
              <select
                value={`${minTargetSec}-${maxTargetSec}`}
                onChange={(e) => {
                  const [min, max] = e.target.value.split('-').map(Number);
                  setMinTargetSec(min);
                  setMaxTargetSec(max);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2.5 py-1.5 focus:outline-none"
              >
                <option value="3-8">3秒 ~ 8秒 (经典推荐)</option>
                <option value="5-10">5秒 ~ 10秒 (沉着心跳)</option>
                <option value="2-5">2秒 ~ 5秒 (快节奏)</option>
                <option value="8-15">8秒 ~ 15秒 (马拉松耐力)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Challenge Arena */}
      <div className={`relative p-6 sm:p-10 rounded-3xl border transition-all duration-300 backdrop-blur-xl ${
        lastResult?.isWin 
          ? 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.15)]'
          : lastResult && !lastResult.isWin
          ? 'bg-slate-900/90 border-rose-500/50 shadow-[0_0_50px_rgba(239,68,68,0.15)]'
          : isRunning
          ? 'bg-slate-900/90 border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.1)]'
          : 'bg-slate-900/70 border-slate-800 shadow-2xl'
      }`}>
        {/* Target Header Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">本轮挑战目标 (Target Time)</div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono-numbers tracking-tight text-white flex items-center gap-2">
                <span>{targetDisplay}</span>
                <span className="text-xs font-sans text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 font-medium">
                  {parsedTarget.seconds}秒{parsedTarget.formattedCentiseconds} (0.01s精度)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Target Win Window */}
            <div className="text-right">
              <div className="text-[11px] text-slate-400 font-medium">过关有效窗口 (±{tolerance})</div>
              <div className="text-sm font-semibold font-mono-numbers text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl border border-emerald-500/20">
                {parsedMinValid.displayShort} ~ {parsedMaxValid.displayShort}
              </div>
            </div>

            <button
              onClick={rollNewTarget}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors disabled:opacity-40"
              title="重新随机生成一个目标时间"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              换个目标
            </button>
          </div>
        </div>

        {/* Giant Chronometer Display */}
        <div className="py-10 sm:py-14 flex flex-col items-center justify-center relative">
          {/* Subtle Circular Progress Indicator / Glow Aura */}
          <div className={`text-6xl sm:text-8xl md:text-9xl font-extrabold font-mono-numbers tracking-tight transition-all select-none ${
            lastResult?.isWin 
              ? 'text-emerald-400 glow-success'
              : lastResult && !lastResult.isWin
              ? 'text-rose-400 glow-fail'
              : isRunning
              ? 'text-white glow-accent'
              : 'text-slate-100'
          }`}>
            {shouldMaskTimer ? (
              <span className="opacity-60 tracking-widest text-indigo-300 animate-pulse">
                ?? : ??
              </span>
            ) : (
              <div className="flex items-baseline justify-center">
                {/* Seconds */}
                <span>{parsedCurrent.formattedSeconds}</span>
                <span className="text-blue-500 px-1 text-4xl sm:text-7xl font-normal">:</span>
                {/* Centiseconds (00-99 with carry-over) */}
                <span className="text-blue-400">{parsedCurrent.formattedCentiseconds}</span>
              </div>
            )}
          </div>

          {/* Precision Label & Carry-Over Indicator */}
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-400 font-mono-numbers">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-600" />
              秒 (00-59)
            </span>
            <span className="text-slate-600">/</span>
            <span className="flex items-center gap-1 text-blue-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              百分秒 (00-99 满百自动进位)
            </span>
          </div>

          {isBlindfold && isRunning && (
            <div className="mt-2 text-xs font-medium text-indigo-400 flex items-center gap-1.5 animate-pulse">
              <EyeOff className="w-3.5 h-3.5" />
              蒙眼挑战中：凭心跳节拍直觉停秒！
            </div>
          )}

          {/* Real-time Verdict Banner (When stopped) */}
          {lastResult && (
            <div className={`mt-6 w-full max-w-xl p-4 sm:p-5 rounded-2xl border text-center transition-all animate-in zoom-in-95 duration-200 ${
              lastResult.isWin
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center justify-center gap-2 text-lg sm:text-xl font-bold">
                {lastResult.isWin ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                    <span>{lastResult.verdictText}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6 text-rose-400 shrink-0" />
                    <span>{lastResult.verdictText}</span>
                  </>
                )}
              </div>

              <div className="mt-2 text-sm text-slate-300">
                {lastResult.feedbackDetail}
              </div>

              {/* Numerical breakdown pills */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-4 text-xs font-mono-numbers">
                <div>
                  <span className="text-slate-400">停秒时间: </span>
                  <span className="text-white font-bold">{lastResult.actualDisplay}</span>
                </div>
                <div>
                  <span className="text-slate-400">目标时间: </span>
                  <span className="text-white font-bold">{lastResult.targetDisplay}</span>
                </div>
                <div>
                  <span className="text-slate-400">时间差: </span>
                  <span className={lastResult.deltaCentiseconds === 0 ? 'text-amber-400 font-bold' : lastResult.isWin ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {lastResult.deltaCentiseconds > 0 ? `+${lastResult.deltaCentiseconds}cs` : `${lastResult.deltaCentiseconds}cs`}
                    {' '}({(lastResult.deltaSeconds > 0 ? `+${lastResult.deltaSeconds}` : lastResult.deltaSeconds)}s)
                  </span>
                </div>
                {lastResult.isWin && (
                  <div>
                    <span className="text-slate-400">得分: </span>
                    <span className="text-amber-400 font-bold">+{lastResult.score}分</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Button Bar */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Operation mode switch */}
          <div className="flex items-center gap-2 p-1 bg-slate-800/80 rounded-xl border border-slate-750 text-xs">
            <button
              onClick={() => setStopMode('tap')}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                stopMode === 'tap'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              点击启停 (Tap)
            </button>
            <button
              onClick={() => setStopMode('hold')}
              disabled={isRunning}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                stopMode === 'hold'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              按住松开即停 (Hold)
            </button>
          </div>

          {/* Big Action Button */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {stopMode === 'hold' ? (
              // Hold mode: PointerDown to start, PointerUp to stop
              <button
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  isHoldingRef.current = true;
                  startTimer();
                }}
                onPointerUp={(e) => {
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    // ignore
                  }
                  if (isHoldingRef.current) {
                    isHoldingRef.current = false;
                    stopTimer();
                  }
                }}
                onPointerCancel={() => {
                  if (isHoldingRef.current) {
                    isHoldingRef.current = false;
                    stopTimer();
                  }
                }}
                className={`w-full sm:w-72 py-4 px-6 rounded-2xl font-bold text-base transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-2.5 ${
                  isRunning
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-red-500/25 animate-pulse'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                }`}
              >
                {isRunning ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    <span>松开按键立即判定！</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>按住开始 (松开即停)</span>
                  </>
                )}
              </button>
            ) : (
              // Tap mode: Click to start, click to stop
              <button
                onClick={() => {
                  if (isRunning) {
                    stopTimer();
                  } else {
                    startTimer();
                  }
                }}
                className={`w-full sm:w-72 py-4 px-6 rounded-2xl font-bold text-base transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-2.5 ${
                  isRunning
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-red-500/25 ring-2 ring-red-400/50'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                }`}
              >
                {isRunning ? (
                  <>
                    <Square className="w-5 h-5 fill-current" />
                    <span>立即停止！(定格判分)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 fill-current" />
                    <span>{lastResult ? '再来一局 (按空格)' : '开始计时 (按空格)'}</span>
                  </>
                )}
              </button>
            )}

            {lastResult && (
              <button
                onClick={rollNewTarget}
                className="py-4 px-4 bg-slate-800 hover:bg-slate-750 text-white rounded-2xl border border-slate-700 font-semibold text-sm transition-colors flex items-center gap-2 shrink-0"
                title="下一关随机新目标"
              >
                <span>下一关</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-3 text-center text-xs text-slate-500">
          支持使用键盘 <kbd className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[11px]">Space (空格键)</kbd> 快捷操作
        </div>
      </div>

      {/* Round History Table */}
      {history.length > 0 && (
        <div className="p-5 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-200">最近挑战战绩记录</h3>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              清空记录
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">回合</th>
                  <th className="py-2.5 px-3">目标时间</th>
                  <th className="py-2.5 px-3">实际停秒</th>
                  <th className="py-2.5 px-3">误差</th>
                  <th className="py-2.5 px-3">容差</th>
                  <th className="py-2.5 px-3">结果</th>
                  <th className="py-2.5 px-3 text-right">得分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-400">#{item.round}</td>
                    <td className="py-2.5 px-3 font-semibold text-white">{item.targetDisplay}</td>
                    <td className="py-2.5 px-3 text-slate-200">{item.actualDisplay}</td>
                    <td className="py-2.5 px-3">
                      <span className={item.deltaCentiseconds === 0 ? 'text-amber-400 font-bold' : item.isWin ? 'text-emerald-400' : 'text-rose-400'}>
                        {item.deltaCentiseconds > 0 ? `+${item.deltaCentiseconds}cs` : `${item.deltaCentiseconds}cs`}
                        {' '}({(item.deltaCentiseconds / 100 > 0 ? `+${(item.deltaCentiseconds / 100).toFixed(2)}` : (item.deltaCentiseconds / 100).toFixed(2))}s)
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">±{item.tolerance}</td>
                    <td className="py-2.5 px-3">
                      {item.isWin ? (
                        <span className="text-emerald-400 font-sans font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          成功
                        </span>
                      ) : (
                        <span className="text-rose-400 font-sans font-semibold flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          失败
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-400 font-bold">
                      {item.score > 0 ? `+${item.score}` : '0'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

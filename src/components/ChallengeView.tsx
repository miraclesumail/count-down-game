import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, Square, RotateCcw, Sliders, Trophy, Flame, 
  Eye, EyeOff, Volume2, ArrowRight, CheckCircle2, XCircle,
  History, X, Award
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

  // Mobile History Modal state
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);

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
    soundManager.unlock();
    const { targetCs: newTarget, display } = generateRandomTarget(minTargetSec, maxTargetSec);
    setTargetCs(newTarget);
    setTargetDisplay(display);
    setLastResult(null);
    setElapsedCs(0);
    soundManager.playClick();
  }, [minTargetSec, maxTargetSec]);

  // Start the timer
  const startTimer = useCallback(() => {
    if (isRunning) return;
    soundManager.unlock();
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

      // Max timeout safeguard (60 seconds)
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
    soundManager.unlock();
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
      ...prev.slice(0, 29), // keep last 30 rounds
    ]);
  }, [targetCs, tolerance, targetDisplay, totalRounds, bestStreak]);

  // Handle Spacebar keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        soundManager.unlock();
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
        soundManager.unlock();
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
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Top HUD: Score, Streaks & Quick Controls */}
      <div className="p-3 sm:p-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 backdrop-blur-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full">
        {/* Metric Badges */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2.5 sm:gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 sm:p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">当前连胜</div>
              <div className="text-base sm:text-xl font-bold font-mono-numbers text-white flex items-center gap-1">
                {currentStreak}
                {currentStreak > 2 && <span className="text-[10px] text-amber-400 font-sans">🔥连胜</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:border-l sm:border-slate-800 sm:pl-6">
            <div className="p-1.5 sm:p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl shrink-0">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">最高连胜</div>
              <div className="text-base sm:text-xl font-bold font-mono-numbers text-slate-200">
                {bestStreak}
              </div>
            </div>
          </div>

          <div className="col-span-2 hidden sm:flex items-center gap-2.5 border-l border-slate-800 pl-6">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">胜率 / 场次</div>
              <div className="text-sm font-semibold text-slate-300 font-mono-numbers">
                {totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0}% 
                <span className="text-xs text-slate-500 font-normal ml-1.5">({totalWins}/{totalRounds})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick action buttons on HUD */}
        <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/80">
          <button
            onClick={() => {
              soundManager.unlock();
              setIsBlindfold(!isBlindfold);
            }}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isBlindfold 
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300'
                : 'bg-slate-800/60 border-slate-750 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
            title="蒙眼模式：计时超过1.5秒后隐藏时间，凭直觉停秒"
          >
            {isBlindfold ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
            <span>{isBlindfold ? '蒙眼开启' : '蒙眼模式'}</span>
          </button>

          <button
            onClick={() => {
              soundManager.unlock();
              setShowSettingsDrawer(!showSettingsDrawer);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-750 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>容差 (±{tolerance})</span>
          </button>

          <button
            onClick={() => {
              soundManager.unlock();
              onOpenSoundSettings();
            }}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-750 transition-colors shrink-0"
            title="自定义音效设置"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
          </button>
        </div>
      </div>

      {/* Tolerance & Rule Drawer */}
      {showSettingsDrawer && (
        <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-3 sm:space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">停秒挑战容差调节 (Tolerance Window)</h3>
            </div>
            <button
              onClick={() => setShowSettingsDrawer(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded"
            >
              收起
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
            当停止时间落在 <span className="text-blue-400 font-mono font-medium">目标值 ± 容差</span> 区间内即为挑战成功。默认值为 <span className="text-emerald-400 font-semibold font-mono">±20</span> (允许误差 0.20 秒)。
          </p>

          {/* Quick presets */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {tolerancePresets.map((preset) => {
              const active = tolerance === preset.value;
              return (
                <button
                  key={preset.value}
                  onClick={() => {
                    soundManager.unlock();
                    setTolerance(preset.value);
                    soundManager.playClick();
                  }}
                  className={`p-2 sm:p-2.5 rounded-xl text-left border transition-all ${
                    active
                      ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                      : 'bg-slate-800/50 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="text-[11px] sm:text-xs font-bold font-mono truncate">{preset.label}</div>
                  <div className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 truncate">{preset.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Slider for precision custom adjustment */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full">
            <div className="flex-1 space-y-1">
              <div className="flex justify-between text-[11px] sm:text-xs text-slate-300">
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
              <span className="text-[11px] sm:text-xs text-slate-400">目标范围:</span>
              <select
                value={`${minTargetSec}-${maxTargetSec}`}
                onChange={(e) => {
                  const [min, max] = e.target.value.split('-').map(Number);
                  setMinTargetSec(min);
                  setMaxTargetSec(max);
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 px-2 py-1.5 focus:outline-none"
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
      <div className={`relative p-4 sm:p-8 md:p-10 rounded-2xl sm:rounded-3xl border transition-all duration-300 backdrop-blur-xl w-full max-w-full overflow-hidden ${
        lastResult?.isWin 
          ? 'bg-slate-900/90 border-emerald-500/50 shadow-[0_0_50px_rgba(16,185,129,0.15)]'
          : lastResult && !lastResult.isWin
          ? 'bg-slate-900/90 border-rose-500/50 shadow-[0_0_50px_rgba(239,68,68,0.15)]'
          : isRunning
          ? 'bg-slate-900/90 border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.1)]'
          : 'bg-slate-900/70 border-slate-800 shadow-2xl'
      }`}>
        {/* Target Header Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <div>
              <div className="text-[10px] sm:text-xs text-slate-400 font-medium uppercase tracking-wider">本轮挑战目标 (Target)</div>
              <div className="text-2xl sm:text-4xl font-extrabold font-mono-numbers tracking-tight text-white flex items-center gap-2">
                <span>{targetDisplay}</span>
                <span className="text-[10px] sm:text-xs font-sans text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 font-medium">
                  {parsedTarget.seconds}秒{parsedTarget.formattedCentiseconds} (0.01s精度)
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            {/* Target Win Window */}
            <div className="text-left sm:text-right">
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">过关有效窗口 (±{tolerance})</div>
              <div className="text-xs sm:text-sm font-semibold font-mono-numbers text-emerald-400 bg-emerald-500/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-emerald-500/20">
                {parsedMinValid.displayShort} ~ {parsedMaxValid.displayShort}
              </div>
            </div>

            <button
              onClick={rollNewTarget}
              disabled={isRunning}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition-colors disabled:opacity-40 shrink-0"
              title="重新随机生成一个目标时间"
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>换目标</span>
            </button>
          </div>
        </div>

        {/* Giant Chronometer Display */}
        <div className="py-6 sm:py-12 flex flex-col items-center justify-center relative w-full">
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
                <span className="text-blue-500 px-0.5 sm:px-1 text-3xl sm:text-7xl font-normal">:</span>
                {/* Centiseconds (00-99 with carry-over) */}
                <span className="text-blue-400">{parsedCurrent.formattedCentiseconds}</span>
              </div>
            )}
          </div>

          {/* Precision Label & Carry-Over Indicator */}
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-slate-400 font-mono-numbers text-center">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              秒 (00-59)
            </span>
            <span className="text-slate-600">/</span>
            <span className="flex items-center gap-1 text-blue-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              百分秒 (00-99 满百进位)
            </span>
          </div>

          {isBlindfold && isRunning && (
            <div className="mt-2 text-xs font-medium text-indigo-400 flex items-center gap-1.5 animate-pulse">
              <EyeOff className="w-3.5 h-3.5" />
              <span>蒙眼挑战中：凭心跳节拍直觉停秒！</span>
            </div>
          )}

          {/* Real-time Verdict Banner (When stopped) */}
          {lastResult && (
            <div className={`mt-5 sm:mt-6 w-full max-w-xl p-3 sm:p-5 rounded-2xl border text-center transition-all animate-in zoom-in-95 duration-200 ${
              lastResult.isWin
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-base sm:text-xl font-bold">
                {lastResult.isWin ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
                    <span>{lastResult.verdictText}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 shrink-0" />
                    <span>{lastResult.verdictText}</span>
                  </>
                )}
              </div>

              <div className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-300">
                {lastResult.feedbackDetail}
              </div>

              {/* Numerical breakdown pills */}
              <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-mono-numbers">
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
        <div className="pt-3 sm:pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 w-full">
          {/* Operation mode switch */}
          <div className="flex items-center gap-1 p-1 bg-slate-800/80 rounded-xl border border-slate-750 text-xs w-full sm:w-auto">
            <button
              onClick={() => {
                soundManager.unlock();
                setStopMode('tap');
              }}
              disabled={isRunning}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium transition-colors text-center ${
                stopMode === 'tap'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              点击启停 (Tap)
            </button>
            <button
              onClick={() => {
                soundManager.unlock();
                setStopMode('hold');
              }}
              disabled={isRunning}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-medium transition-colors text-center ${
                stopMode === 'hold'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              按住松开即停 (Hold)
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {stopMode === 'hold' ? (
              // Hold mode: PointerDown to start, PointerUp to stop
              <button
                onPointerDown={(e) => {
                  soundManager.unlock();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  isHoldingRef.current = true;
                  startTimer();
                }}
                onPointerUp={(e) => {
                  soundManager.unlock();
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
                className={`flex-1 sm:w-72 py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl font-bold text-sm sm:text-base transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-2 select-none ${
                  isRunning
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-red-500/25 animate-pulse'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                }`}
              >
                {isRunning ? (
                  <>
                    <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
                    <span>松开按键立即判定！</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
                    <span>按住开始 (松开即停)</span>
                  </>
                )}
              </button>
            ) : (
              // Tap mode: Click to start, click to stop
              <button
                onClick={() => {
                  soundManager.unlock();
                  if (isRunning) {
                    stopTimer();
                  } else {
                    startTimer();
                  }
                }}
                className={`flex-1 sm:w-72 py-3.5 sm:py-4 px-4 sm:px-6 rounded-2xl font-bold text-sm sm:text-base transition-all transform active:scale-95 shadow-xl flex items-center justify-center gap-2 select-none ${
                  isRunning
                    ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-red-500/25 ring-2 ring-red-400/50'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/25'
                }`}
              >
                {isRunning ? (
                  <>
                    <Square className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
                    <span>立即停止！(定格判分)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current shrink-0" />
                    <span>{lastResult ? '再来一局 (按空格)' : '开始计时 (按空格)'}</span>
                  </>
                )}
              </button>
            )}

            {lastResult && (
              <button
                onClick={rollNewTarget}
                className="py-3.5 sm:py-4 px-3.5 sm:px-4 bg-slate-800 hover:bg-slate-750 text-white rounded-2xl border border-slate-700 font-semibold text-xs sm:text-sm transition-colors flex items-center gap-1.5 shrink-0"
                title="下一关随机新目标"
              >
                <span>下一关</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="mt-3 text-center text-[11px] sm:text-xs text-slate-500">
          支持使用键盘 <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px] sm:text-[11px]">Space (空格键)</kbd> 快捷操作
        </div>
      </div>

      {/* Item 3 Requirement: Mobile (H5) History trigger card */}
      {history.length > 0 && (
        <div className="block md:hidden p-3.5 bg-slate-900/80 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white flex items-center gap-1.5 truncate">
                <span>最近战绩</span>
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.2 rounded font-mono font-normal">
                  {history.length} 局
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                胜率 {totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0}% · 连胜 {currentStreak}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              soundManager.unlock();
              setIsHistoryModalOpen(true);
            }}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shrink-0 shadow-sm shadow-blue-600/30 active:scale-95 transition-transform"
          >
            <span>查看战绩</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Item 3 Requirement: PC Inline Table (Desktop unchanged) */}
      {history.length > 0 && (
        <div className="hidden md:block p-5 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <span>最近挑战战绩记录</span>
            </h3>
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

      {/* Item 3 Requirement: Mobile H5 History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full sm:max-w-xl bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">挑战战绩明细</h3>
                  <p className="text-[10px] text-slate-400">共进行 {history.length} 轮挑战</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setHistory([])}
                  className="px-2.5 py-1 text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg transition-colors"
                >
                  清空
                </button>
                <button
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Quick summary strip */}
            <div className="p-3 bg-slate-800/40 border-b border-slate-800 grid grid-cols-3 text-center text-xs font-mono-numbers">
              <div>
                <span className="text-slate-400 text-[10px] block">总胜率</span>
                <span className="text-white font-bold">
                  {totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0}%
                </span>
              </div>
              <div className="border-x border-slate-700/50">
                <span className="text-slate-400 text-[10px] block">当前连胜</span>
                <span className="text-amber-400 font-bold">{currentStreak}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">最高连胜</span>
                <span className="text-purple-400 font-bold">{bestStreak}</span>
              </div>
            </div>

            {/* Scrollable List of Rounds */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-800/40">
              {history.map((item) => (
                <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-mono shrink-0">
                      #{item.round}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-mono-numbers">
                        <span className="font-semibold text-white">{item.actualDisplay}</span>
                        <span className="text-[10px] text-slate-500">/ 目标 {item.targetDisplay}</span>
                      </div>
                      <div className="text-[10px] font-mono-numbers flex items-center gap-1.5 mt-0.5">
                        <span className={item.deltaCentiseconds === 0 ? 'text-amber-400 font-bold' : item.isWin ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                          {item.deltaCentiseconds > 0 ? `+${item.deltaCentiseconds}cs` : `${item.deltaCentiseconds}cs`}
                          {' '}({(item.deltaCentiseconds / 100 > 0 ? `+${(item.deltaCentiseconds / 100).toFixed(2)}` : (item.deltaCentiseconds / 100).toFixed(2))}s)
                        </span>
                        <span className="text-slate-500">容差 ±{item.tolerance}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {item.isWin ? (
                      <div className="text-emerald-400 font-sans font-semibold text-xs flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>成功</span>
                      </div>
                    ) : (
                      <div className="text-rose-400 font-sans font-semibold text-xs flex items-center justify-end gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>失败</span>
                      </div>
                    )}
                    {item.score > 0 && (
                      <div className="text-[10px] text-amber-400 font-mono-numbers font-medium mt-0.5">
                        +{item.score}分
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-xs transition-colors shadow-sm"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

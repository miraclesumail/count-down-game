import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Bell, Hourglass, CheckCircle2 } from 'lucide-react';
import { parseCentiseconds } from '../utils/time';
import { soundManager } from '../utils/audio';

export const CountdownView: React.FC = () => {
  // Configured duration in seconds
  const [durationSec, setDurationSec] = useState<number>(10);
  const [remainingCs, setRemainingCs] = useState<number>(10 * 100);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  const animFrameRef = useRef<number | null>(null);
  const endTimestampRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(-1);
  const alarmIntervalRef = useRef<number | null>(null);

  // Sync remaining when duration changes and not running
  const applyDuration = (sec: number) => {
    if (isRunning) return;
    setDurationSec(sec);
    setRemainingCs(sec * 100);
    setIsFinished(false);
  };

  const start = useCallback(() => {
    if (isRunning) return;
    soundManager.unlock();
    if (remainingCs <= 0) {
      setRemainingCs(durationSec * 100);
    }
    setIsFinished(false);
    setIsRunning(true);
    soundManager.playClick();

    endTimestampRef.current = performance.now() + remainingCs * 10;
    lastTickSecRef.current = -1;

    const loop = (now: number) => {
      const leftMs = endTimestampRef.current - now;
      if (leftMs <= 0) {
        setRemainingCs(0);
        setIsRunning(false);
        setIsFinished(true);

        // Play alarm sound
        soundManager.playWin();
        // Beep alarm recurring
        let count = 0;
        alarmIntervalRef.current = window.setInterval(() => {
          count++;
          soundManager.playWin();
          if (count >= 5 && alarmIntervalRef.current) {
            clearInterval(alarmIntervalRef.current);
          }
        }, 1200);

        return;
      }

      const leftCs = Math.ceil(leftMs / 10);
      setRemainingCs(leftCs);

      const sec = Math.ceil(leftCs / 100);
      if (sec !== lastTickSecRef.current) {
        lastTickSecRef.current = sec;
        if (sec <= 3) {
          soundManager.playCountdown(false);
        } else {
          soundManager.playTick();
        }
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [isRunning, remainingCs, durationSec]);

  const pause = useCallback(() => {
    if (!isRunning) return;
    soundManager.unlock();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsRunning(false);
    soundManager.playClick();
  }, [isRunning]);

  const reset = useCallback(() => {
    soundManager.unlock();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    setIsRunning(false);
    setIsFinished(false);
    setRemainingCs(durationSec * 100);
    soundManager.playClick();
  }, [durationSec]);

  const stopAlarm = () => {
    soundManager.unlock();
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    setIsFinished(false);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    };
  }, []);

  const parsed = parseCentiseconds(remainingCs);
  const totalCs = durationSec * 100;
  const progressPercent = totalCs > 0 ? Math.max(0, Math.min(100, (remainingCs / totalCs) * 100)) : 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 overflow-x-hidden">
      <div className={`p-5 sm:p-12 rounded-3xl border shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center transition-all w-full ${
        isFinished 
          ? 'bg-emerald-950/40 border-emerald-500/60 shadow-emerald-500/20'
          : 'bg-slate-900/80 border-slate-800'
      }`}>
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 sm:mb-4">
          <Hourglass className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          <span>高精度倒计时提醒 (0.01秒分辨率)</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-md h-2 bg-slate-800 rounded-full overflow-hidden mb-4 sm:mb-6">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-amber-400 transition-all duration-100 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Digits */}
        <div className={`text-5xl sm:text-8xl md:text-9xl font-extrabold font-mono-numbers tracking-tight flex items-baseline justify-center select-none py-2 sm:py-4 ${
          isFinished ? 'text-emerald-400 glow-success animate-bounce' : 'text-white'
        }`}>
          {parsed.minutes > 0 && (
            <>
              <span>{parsed.formattedMinutes}</span>
              <span className="text-amber-500 px-0.5 sm:px-1 text-3xl sm:text-7xl font-normal">:</span>
            </>
          )}
          <span>{parsed.formattedSeconds}</span>
          <span className="text-amber-500 px-0.5 sm:px-1 text-3xl sm:text-7xl font-normal">.</span>
          <span className="text-amber-400">{parsed.formattedCentiseconds}</span>
        </div>

        <div className="text-[11px] sm:text-xs text-slate-400 font-mono-numbers mt-1">
          {parsed.minutes > 0 && <span>分 (00-59) · </span>}
          <span>秒 (00-59) · </span>
          <span className="text-amber-400 font-medium">百分秒 (00-99 倒计至零)</span>
        </div>

        {/* Finished notification banner */}
        {isFinished && (
          <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 px-4 sm:px-5 py-2.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
              <span className="text-xs sm:text-sm font-bold">倒计时完成！提示音已响铃</span>
            </div>
            <button
              onClick={stopAlarm}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              关闭提醒
            </button>
          </div>
        )}

        {/* Quick Presets */}
        <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 w-full">
          {[
            { sec: 5, label: '5秒' },
            { sec: 10, label: '10秒' },
            { sec: 30, label: '30秒' },
            { sec: 60, label: '1分钟' },
            { sec: 180, label: '3分钟' },
            { sec: 300, label: '5分钟' },
          ].map((preset) => (
            <button
              key={preset.sec}
              onClick={() => {
                soundManager.unlock();
                applyDuration(preset.sec);
              }}
              disabled={isRunning}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                durationSec === preset.sec && !isRunning
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/40'
                  : 'bg-slate-800/60 border-slate-750 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mt-6 sm:mt-8 w-full">
          {!isRunning ? (
            <button
              onClick={start}
              className="flex-1 sm:flex-initial py-3 sm:py-3.5 px-6 sm:px-8 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span>启动倒计时</span>
            </button>
          ) : (
            <button
              onClick={pause}
              className="flex-1 sm:flex-initial py-3 sm:py-3.5 px-6 sm:px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span>暂停</span>
            </button>
          )}

          <button
            onClick={reset}
            className="flex-1 sm:flex-initial py-3 sm:py-3.5 px-4 sm:px-6 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl font-semibold text-xs sm:text-sm border border-slate-700 flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>重置</span>
          </button>
        </div>
      </div>
    </div>
  );
};

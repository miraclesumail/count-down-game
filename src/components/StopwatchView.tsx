import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Flag, Clock } from 'lucide-react';
import { parseCentiseconds } from '../utils/time';
import { soundManager } from '../utils/audio';

interface LapRecord {
  lapNumber: number;
  overallCs: number;
  lapCs: number;
  formattedOverall: string;
  formattedLap: string;
}

export const StopwatchView: React.FC = () => {
  const [elapsedCs, setElapsedCs] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [laps, setLaps] = useState<LapRecord[]>([]);

  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const accumulatedCsRef = useRef<number>(0);
  const lastLapCsRef = useRef<number>(0);
  const lastTickSecRef = useRef<number>(-1);

  const start = useCallback(() => {
    if (isRunning) return;
    soundManager.unlock();
    setIsRunning(true);
    soundManager.playClick();
    startTimeRef.current = performance.now();

    const loop = (now: number) => {
      const currentDeltaMs = now - startTimeRef.current;
      const totalCs = accumulatedCsRef.current + Math.floor(currentDeltaMs / 10);
      setElapsedCs(totalCs);

      const sec = Math.floor(totalCs / 100);
      if (sec !== lastTickSecRef.current) {
        lastTickSecRef.current = sec;
        soundManager.playTick();
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
  }, [isRunning]);

  const pause = useCallback(() => {
    if (!isRunning) return;
    soundManager.unlock();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    accumulatedCsRef.current = elapsedCs;
    setIsRunning(false);
    soundManager.playClick();
  }, [isRunning, elapsedCs]);

  const reset = useCallback(() => {
    soundManager.unlock();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsRunning(false);
    accumulatedCsRef.current = 0;
    lastLapCsRef.current = 0;
    lastTickSecRef.current = -1;
    setElapsedCs(0);
    setLaps([]);
    soundManager.playClick();
  }, []);

  const addLap = useCallback(() => {
    if (!isRunning && elapsedCs === 0) return;
    soundManager.unlock();
    const currentTotal = elapsedCs;
    const lapDelta = currentTotal - lastLapCsRef.current;
    lastLapCsRef.current = currentTotal;

    const parsedOverall = parseCentiseconds(currentTotal);
    const parsedLap = parseCentiseconds(lapDelta);

    setLaps((prev) => [
      {
        lapNumber: prev.length + 1,
        overallCs: currentTotal,
        lapCs: lapDelta,
        formattedOverall: parsedOverall.displayFull,
        formattedLap: parsedLap.displayFull,
      },
      ...prev,
    ]);
    soundManager.playClick();
  }, [isRunning, elapsedCs]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const parsed = parseCentiseconds(elapsedCs);

  // Determine fastest and slowest laps
  let minLap = Infinity;
  let maxLap = -1;
  if (laps.length > 1) {
    laps.forEach((l) => {
      if (l.lapCs < minLap) minLap = l.lapCs;
      if (l.lapCs > maxLap) maxLap = l.lapCs;
    });
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6 overflow-x-hidden">
      {/* Stopwatch Main Display */}
      <div className="p-5 sm:p-12 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center w-full">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 sm:mb-4">
          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
          <span>专业0.01秒高精度秒表 (自动进位)</span>
        </div>

        {/* Large Digits */}
        <div className="text-5xl sm:text-8xl md:text-9xl font-extrabold font-mono-numbers text-white tracking-tight flex items-baseline justify-center select-none py-2 sm:py-4">
          {parsed.minutes > 0 && (
            <>
              <span>{parsed.formattedMinutes}</span>
              <span className="text-blue-500 px-0.5 sm:px-1 text-3xl sm:text-7xl font-normal">:</span>
            </>
          )}
          <span>{parsed.formattedSeconds}</span>
          <span className="text-blue-500 px-0.5 sm:px-1 text-3xl sm:text-7xl font-normal">.</span>
          <span className="text-blue-400">{parsed.formattedCentiseconds}</span>
        </div>

        <div className="text-[11px] sm:text-xs text-slate-400 font-mono-numbers flex items-center gap-1.5 sm:gap-2 mt-1">
          {parsed.minutes > 0 && <span>分 (00-59) ·</span>}
          <span>秒 (00-59) ·</span>
          <span className="text-blue-400 font-medium">百分之一秒 (00-99 进位)</span>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mt-6 sm:mt-10 w-full">
          {!isRunning ? (
            <button
              onClick={start}
              className="flex-1 sm:flex-initial py-3 sm:py-3.5 px-6 sm:px-8 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span>启动</span>
            </button>
          ) : (
            <button
              onClick={pause}
              className="flex-1 sm:flex-initial py-3 sm:py-3.5 px-6 sm:px-8 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
            >
              <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span>暂停</span>
            </button>
          )}

          <button
            onClick={addLap}
            disabled={!isRunning}
            className="flex-1 sm:flex-initial py-3 sm:py-3.5 px-4 sm:px-6 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl font-semibold text-xs sm:text-sm border border-slate-700 flex items-center justify-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-40"
          >
            <Flag className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            <span>计次 (Lap)</span>
          </button>

          <button
            onClick={reset}
            disabled={elapsedCs === 0 && laps.length === 0}
            className="flex-1 sm:flex-initial py-3 sm:py-3.5 px-4 sm:px-6 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-2xl font-semibold text-xs sm:text-sm border border-slate-700 flex items-center justify-center gap-1.5 sm:gap-2 transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>复位</span>
          </button>
        </div>
      </div>

      {/* Lap Table */}
      {laps.length > 0 && (
        <div className="p-6 bg-slate-900/60 rounded-2xl border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Flag className="w-4 h-4 text-emerald-400" />
              <span>计次分段明细 ({laps.length} 次)</span>
            </h3>
            <button
              onClick={() => setLaps([])}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              清除计次
            </button>
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs font-mono-numbers">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">序号</th>
                  <th className="py-2.5 px-3">圈速 (分段用时)</th>
                  <th className="py-2.5 px-3 text-right">总累计时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {laps.map((lap) => {
                  const isFastest = laps.length > 1 && lap.lapCs === minLap;
                  const isSlowest = laps.length > 1 && lap.lapCs === maxLap;

                  return (
                    <tr key={lap.lapNumber} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-400">
                        Lap {lap.lapNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold flex items-center gap-2">
                        <span className={isFastest ? 'text-emerald-400' : isSlowest ? 'text-rose-400' : 'text-slate-200'}>
                          {lap.formattedLap}
                        </span>
                        {isFastest && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 font-sans">最快</span>}
                        {isSlowest && <span className="text-[10px] bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 font-sans">最慢</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-300">
                        {lap.formattedOverall}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

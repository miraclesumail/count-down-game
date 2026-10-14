/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Target, Clock, Hourglass, Volume2, 
  HelpCircle, Sparkles, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { ChallengeView } from './components/ChallengeView';
import { StopwatchView } from './components/StopwatchView';
import { CountdownView } from './components/CountdownView';
import { SoundSettingsModal } from './components/SoundSettingsModal';

type ActiveTab = 'challenge' | 'stopwatch' | 'countdown' | 'rules';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('challenge');
  const [isSoundModalOpen, setIsSoundModalOpen] = useState<boolean>(false);
  const [, setSoundRevision] = useState<number>(0);

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Top Bar following 3-Zone Contract */}
      <header className="sticky top-0 z-40 bg-[#080b11]/85 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
        {/* Zone 1: Brand title, single line text */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap">
            ChronoPrecision
          </span>
        </div>

        {/* Zone 2: Navigation Links / Segmented Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('challenge')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'challenge'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>停秒挑战</span>
          </button>

          <button
            onClick={() => setActiveTab('stopwatch')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'stopwatch'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>高精秒表</span>
          </button>

          <button
            onClick={() => setActiveTab('countdown')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'countdown'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hourglass className="w-3.5 h-3.5" />
            <span>倒计时</span>
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`hidden sm:flex px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors items-center gap-1.5 ${
              activeTab === 'rules'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>规则指南</span>
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action (Sound / Audio Settings) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsSoundModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-750 hover:text-white border border-slate-700 rounded-xl transition-colors whitespace-nowrap shadow-sm"
          >
            <Volume2 className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">自定义音效</span>
            <span className="sm:hidden">音效</span>
          </button>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-start">
        {activeTab === 'challenge' && (
          <ChallengeView onOpenSoundSettings={() => setIsSoundModalOpen(true)} />
        )}

        {activeTab === 'stopwatch' && <StopwatchView />}

        {activeTab === 'countdown' && <CountdownView />}

        {activeTab === 'rules' && (
          <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-200">
            <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-xl space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">停秒挑战与0.01秒高精计时规则</h2>
                  <p className="text-xs text-slate-400">基于物理帧率与高精度计时标准构建的心跳直觉挑战系统</p>
                </div>
              </div>

              <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-750 space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    1. 双位精度与满百自动进位机制
                  </h3>
                  <p className="text-xs text-slate-400">
                    计时器精确显示到小数点后2位（即百分之一秒 / 10毫秒，记作 centiseconds）。小数点后从 <code className="text-blue-300 font-mono">00</code> 递增到 <code className="text-blue-300 font-mono">99</code>，当跨过 99 抵达第 100 个百分秒时，百分秒自动归零并向「秒」进位 +1；秒满 60 自动向「分」进位。
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-750 space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    2. 挑战胜负判定与可调节容差窗口 (±20)
                  </h3>
                  <p className="text-xs text-slate-400">
                    每回合系统会随机生成一个目标时间（如 <code className="text-emerald-300 font-mono">05:30</code>，代表 5秒30百分秒）。玩家看着计时器可以在任意时刻点击或松开按键停止计时。
                    因为绝对精准停在同一毫秒极其困难，系统提供了<strong className="text-emerald-400">容差窗口（默认 ±20 百分秒，即允许误差 ±0.20 秒）</strong>。只要停秒时间落在目标值 ± 容差范围内，即判定为<strong className="text-emerald-400">挑战成功</strong>！容差可在界面自由微调（从极限 ±5 到派对娱乐 ±35）。
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-750 space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    3. 自定义声音反馈与录音支持
                  </h3>
                  <p className="text-xs text-slate-400">
                    挑战成功与失败均具备独特的听觉反馈。系统内置 4 套合成器音效（复古街机、机械精工、纯净钟鸣、未来电音），并支持用户直接上传自己的音频文件或使用麦克风录制专属胜负提示音（例如胜利播放“太强了”，失败播放“再接再厉”）。
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-750 space-y-2">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    4. 操作模式与快捷键
                  </h3>
                  <p className="text-xs text-slate-400">
                    支持「点击启停」与街机经典的「按住松开即停」两种操作手感；全键盘友好，可使用 <kbd className="px-2 py-0.5 rounded bg-slate-700 text-white font-mono text-[11px]">Space (空格键)</kbd> 敏捷触发。
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setActiveTab('challenge')}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-blue-600/30"
                >
                  立即开始停秒挑战
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer following Anti-Slop Discipline (No fake telemetry, clean unboxed metadata) */}
      <footer className="py-6 px-4 border-t border-slate-800/60 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span>高精度 0.01s 进位计时器</span>
          <span aria-hidden="true">·</span>
          <span>心跳定格停秒挑战</span>
          <span aria-hidden="true">·</span>
          <span>Web Audio 原生音频引擎</span>
          <span aria-hidden="true">·</span>
          <span>支持自定义音效与麦克风录音</span>
        </div>
      </footer>

      {/* Sound Settings Modal */}
      <SoundSettingsModal
        isOpen={isSoundModalOpen}
        onClose={() => setIsSoundModalOpen(false)}
        onSettingsChange={() => setSoundRevision((r) => r + 1)}
      />
    </div>
  );
}

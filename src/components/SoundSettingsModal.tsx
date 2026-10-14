import React, { useState, useRef } from 'react';
import { 
  Volume2, VolumeX, Play, RotateCcw, 
  Mic, Square, Music, Bell, Sparkles, AlertCircle
} from 'lucide-react';
import { soundManager, AudioSettings, SoundTheme, CustomSounds } from '../utils/audio';

interface SoundSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: () => void;
}

export const SoundSettingsModal: React.FC<SoundSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<AudioSettings>(() => soundManager.getSettings());
  const [recordingTarget, setRecordingTarget] = useState<keyof CustomSounds | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  if (!isOpen) return null;

  const handleUpdate = (partial: Partial<AudioSettings>) => {
    soundManager.updateSettings(partial);
    setSettings(soundManager.getSettings());
    onSettingsChange();
  };

  const handleThemeChange = (theme: SoundTheme) => {
    handleUpdate({ theme });
    soundManager.playClick();
  };

  const handleFileUpload = (type: keyof CustomSounds, file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const updatedSounds = {
        ...settings.customSounds,
        [type]: dataUrl,
      };
      handleUpdate({ customSounds: updatedSounds });
    };
    reader.readAsDataURL(file);
  };

  const clearCustomSound = (type: keyof CustomSounds) => {
    const updatedSounds = { ...settings.customSounds };
    delete updatedSounds[type];
    handleUpdate({ customSounds: updatedSounds });
    soundManager.playClick();
  };

  const startRecording = async (type: keyof CustomSounds) => {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];
      setRecordingTarget(type);
      setRecordSeconds(0);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const updatedSounds = {
            ...settings.customSounds,
            [type]: dataUrl,
          };
          handleUpdate({ customSounds: updatedSounds });
        };
        reader.readAsDataURL(audioBlob);

        // Stop all audio tracks
        stream.getTracks().forEach((track) => track.stop());
        setRecordingTarget(null);
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      };

      mediaRecorder.start();

      let elapsed = 0;
      recordIntervalRef.current = window.setInterval(() => {
        elapsed += 1;
        setRecordSeconds(elapsed);
        if (elapsed >= 10) {
          // Auto stop after 10s
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      console.error(err);
      setRecordError('无法访问麦克风，请检查浏览器权限。');
      setRecordingTarget(null);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
  };

  const testSound = (type: keyof CustomSounds) => {
    if (type === 'win') soundManager.playWin();
    else if (type === 'fail') soundManager.playFail();
    else if (type === 'tick') soundManager.playTick();
  };

  const soundSlots: { key: keyof CustomSounds; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      key: 'win',
      label: '胜利音效 (Win Sound)',
      desc: '挑战时间落在目标允许容差窗口内时播放',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
    },
    {
      key: 'fail',
      label: '失败音效 (Defeat Sound)',
      desc: '挑战时间偏早或偏晚超出容差范围时播放',
      icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
    },
    {
      key: 'tick',
      label: '滴答脉冲音 (Tick Sound)',
      desc: '计时器秒表运行过程中的节奏滴答',
      icon: <Bell className="w-4 h-4 text-sky-400" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">自定义提醒音效与音频设置</h2>
              <p className="text-xs text-slate-400">内置多种音效主题，支持本地音频上传或麦克风录制</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            关闭
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1">
          {/* Master Volume & Mute */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-750 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">主音量控制</span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {settings.muted ? '已静音' : `${Math.round(settings.volume * 100)}%`}
                </span>
              </div>
              <button
                onClick={() => handleUpdate({ muted: !settings.muted })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  settings.muted 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-700/60 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {settings.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                {settings.muted ? '解除静音' : '快速静音'}
              </button>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.volume}
                disabled={settings.muted}
                onChange={(e) => handleUpdate({ volume: parseFloat(e.target.value) })}
                className="w-full accent-blue-500 h-2 bg-slate-700 rounded-lg cursor-pointer disabled:opacity-40"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={settings.tickEnabled}
                  onChange={(e) => handleUpdate({ tickEnabled: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
                />
                开启运行过程中的滴答脉冲音效 (Tick)
              </label>
            </div>
          </div>

          {/* Sound Theme Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
              内置合成音效风格 (Web Audio Synth Presets)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'arcade', label: '经典街机', sub: '8-Bit 复古晶片' },
                { id: 'mechanical', label: '机械精工', sub: '清脆金属秒表' },
                { id: 'synth', label: '未来电音', sub: '合成器脉冲' },
                { id: 'chime', label: '纯净钟鸣', sub: '空灵疗愈钟声' },
              ].map((themeItem) => {
                const isActive = settings.theme === themeItem.id;
                return (
                  <button
                    key={themeItem.id}
                    onClick={() => handleThemeChange(themeItem.id as SoundTheme)}
                    className={`p-3 rounded-xl text-left border transition-all ${
                      isActive
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm ring-1 ring-blue-500/50'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-sm font-semibold">{themeItem.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{themeItem.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Individual Custom Sounds */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              各节点自定义音效配置 (胜负及提示音)
            </label>

            {recordError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                {recordError}
              </div>
            )}

            <div className="space-y-3">
              {soundSlots.map(({ key, label, desc, icon }) => {
                const hasCustom = Boolean(settings.customSounds[key]);
                const isRecordingThis = recordingTarget === key;

                return (
                  <div
                    key={key}
                    className="p-3.5 bg-slate-800/40 rounded-xl border border-slate-800 hover:border-slate-750 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          {icon}
                          <span className="text-sm font-semibold text-white">{label}</span>
                          {hasCustom ? (
                            <span className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                              自定义音频
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              (使用内置主题)
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {/* Test button */}
                        <button
                          onClick={() => testSound(key)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                          title="试听当前音效"
                        >
                          <Play className="w-3.5 h-3.5" />
                          试听
                        </button>

                        {/* Upload Audio File */}
                        <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium cursor-pointer transition-colors">
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleFileUpload(key, f);
                            }}
                          />
                          上传音频
                        </label>

                        {/* Record via Mic */}
                        {isRecordingThis ? (
                          <button
                            onClick={stopRecording}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold animate-pulse transition-colors"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            停止 ({recordSeconds}s)
                          </button>
                        ) : (
                          <button
                            onClick={() => startRecording(key)}
                            disabled={Boolean(recordingTarget)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition-colors disabled:opacity-40"
                            title="录制自己的专属提示音"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            录制
                          </button>
                        )}

                        {/* Reset to default */}
                        {hasCustom && (
                          <button
                            onClick={() => clearCustomSound(key)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                            title="重置为默认音效"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-500">所有自定义设置已实时保存在本地</span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-md transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};

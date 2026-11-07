import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SceneStage } from '../../engine/render/scene';
import { applySettingsToStage } from '../../engine/render/applyUserSettings';
import { UserSettings, loadSettings, saveSettings, DEFAULT_SETTINGS } from '../../utils/settings';
import { Sliders, X, Grid, Camera, RotateCcw, Monitor, Keyboard } from 'lucide-react';
import { SNAPPY, PRESS_DOWN } from '../../utils/motion';

interface SettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  origin: { x: number; y: number } | null;
  stage: SceneStage | null;
  onSettingsChange?: (settings: UserSettings) => void;
}

const SHORTCUT_GROUPS: { title: string; items: [string, string[]][] }[] = [
  {
    title: 'Viewport',
    items: [
      ['Look around', ['LMB Drag']],
      ['Pan view', ['W', 'A', 'S', 'D']],
      ['Pan up / down', ['Space', 'Shift']],
      ['Next camera', ['C']],
      ['Save view as camera', ['V']],
    ],
  },
  {
    title: 'Transform',
    items: [
      ['Select limb / player', ['LMB']],
      ['Translate gizmo', ['G']],
      ['Rotate gizmo', ['R']],
      ['Grab with cursor', ['G', 'G']],
      ['Grab with cursor', ['R', 'R']],
      ['Lock axis', ['X', 'Y', 'Z']],
      ['Toggle world / local', ['Q']],
      ['Reset limb rotation', ['K']],
      ['Confirm grab', ['Enter']],
      ['Cancel grab / deselect', ['Esc']],
    ],
  },
  {
    title: 'Workspace',
    items: [
      ['Body / Pose / World tab', ['1', '2', '3']],
      ['Switch player', ['Alt', '1-8']],
      ['Canvas menu', ['RMB']],
      ['Toggle HUD', ['H']],
      ['Undo / Redo', ['Ctrl', 'Z']],
      ['Kill dev server', ['Shift', 'L']],
    ],
  },
];

export function SettingsModal({ onClose, origin, stage, onSettingsChange }: SettingsModalProps) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [tab, setTab] = useState<'general' | 'shortcuts'>('general');

  useEffect(() => {
    if (stage) {
      applySettingsToStage(stage, settings);
    }
  }, [stage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
    if (stage) applySettingsToStage(stage, updated);
    onSettingsChange?.(updated);
  };

  const handleReset = () => {
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    saveSettings(defaults);
    if (stage) applySettingsToStage(stage, defaults);
    onSettingsChange?.(defaults);
  };

  const renderToggle = (
    label: string,
    icon: React.ReactNode,
    key: 'showGrid' | 'showCameraGlyphs'
  ) => {
    const isChecked = settings[key];
    return (
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5 text-[#F5F5F5]/80 text-[10px] font-bold">
          {icon}
          <span>{label}</span>
        </div>
        <button
          type="button"
          onClick={() => updateSetting(key, !isChecked)}
          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center border-0 shadow-none ${
            isChecked ? 'bg-[#AE0D0A]' : 'bg-[#360403]'
          }`}
        >
          <motion.div
            animate={{ x: isChecked ? 16 : 0 }}
            transition={SNAPPY}
            className="w-4 h-4 rounded-full bg-white shadow-sm pointer-events-none"
          />
        </button>
      </div>
    );
  };

  // Calculate dynamic delta from button center to viewport center
  const deltaX = origin ? Math.round(origin.x - window.innerWidth / 2) : 0;
  const deltaY = origin ? Math.round(origin.y - window.innerHeight / 2) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center select-none font-['Rethink_Sans']">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-xs"
      />

      <motion.div
        initial={{
          x: deltaX,
          y: deltaY,
          scale: 0.15,
          opacity: 0,
        }}
        animate={{
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
        }}
        exit={{
          x: deltaX,
          y: deltaY,
          scale: 0.15,
          opacity: 0,
        }}
        transition={SNAPPY}
        className="relative z-10 w-[340px] bg-[#07050F] rounded-[16px] border border-[#730907]/60 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="w-full h-[32px] bg-[#730907] flex items-center justify-between px-3 border-0 shadow-none">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#F5F5F5] uppercase tracking-wider">
            <Sliders className="w-3.5 h-3.5 text-[#AE0D0A]" />
            <span>Settings</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            transition={PRESS_DOWN}
            onClick={onClose}
            className="text-[#F5F5F5]/60 hover:text-white transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        <div className="p-3.5 flex flex-col gap-3 text-[#F5F5F5]">
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['general', 'General'],
                ['shortcuts', 'Shortcuts'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`h-[22px] rounded-[15px] text-[9px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1 ${
                  tab === key
                    ? 'bg-[#730907] text-[#F5F5F5]'
                    : 'bg-[#360403] text-[#F5F5F5]/60 hover:bg-[#4a0505]'
                }`}
              >
                {key === 'shortcuts' && <Keyboard className="w-2.5 h-2.5" />}
                {label}
              </button>
            ))}
          </div>

          {tab === 'general' ? (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#F5F5F5]/80">
              <span className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-[#AE0D0A]" />
                UI Zoom Level
              </span>
              <span className="text-[#AE0D0A] font-extrabold">{settings.uiZoom}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="300"
              step="10"
              value={settings.uiZoom}
              onChange={(e) => updateSetting('uiZoom', parseInt(e.target.value, 10))}
              className="w-full h-1 bg-[#360403] rounded-lg appearance-none cursor-pointer accent-[#AE0D0A]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#F5F5F5]/80">
              <span className="flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5 text-[#AE0D0A]" />
                Camera Default FOV
              </span>
              <span className="text-[#AE0D0A] font-extrabold">{settings.perpetualFov}°</span>
            </div>
            <input
              type="range"
              min="15"
              max="90"
              step="1"
              value={settings.perpetualFov}
              onChange={(e) => updateSetting('perpetualFov', parseInt(e.target.value, 10))}
              className="w-full h-1 bg-[#360403] rounded-lg appearance-none cursor-pointer accent-[#AE0D0A]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#F5F5F5]/80">
              <span>Camera Control</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['look', 'FPS Look'],
                  ['orbit', 'Classic Orbit'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => updateSetting('cameraControlMode', mode)}
                  className={`h-[22px] rounded-[15px] text-[9px] font-bold uppercase tracking-wider transition ${
                    settings.cameraControlMode === mode
                      ? 'bg-[#730907] text-[#F5F5F5]'
                      : 'bg-[#360403] text-[#F5F5F5]/60 hover:bg-[#4a0505]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[8px] font-bold uppercase tracking-widest text-[#F5F5F5]/30 leading-none select-none">
              {settings.cameraControlMode === 'look' ? 'LMB drag to look' : 'LMB drag to orbit'}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#F5F5F5]/80">
              <span>{settings.cameraControlMode === 'look' ? 'Look Sensitivity' : 'Orbit Sensitivity'}</span>
              <span className="text-[#AE0D0A] font-extrabold">{settings.orbitSensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={settings.orbitSensitivity}
              onChange={(e) => updateSetting('orbitSensitivity', parseFloat(e.target.value))}
              className="w-full h-1 bg-[#360403] rounded-lg appearance-none cursor-pointer accent-[#AE0D0A]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#F5F5F5]/80">
              <span>WASD Pan Speed</span>
              <span className="text-[#AE0D0A] font-extrabold">{settings.panSpeed.toFixed(1)} u/s</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.5"
              value={settings.panSpeed}
              onChange={(e) => updateSetting('panSpeed', parseFloat(e.target.value))}
              className="w-full h-1 bg-[#360403] rounded-lg appearance-none cursor-pointer accent-[#AE0D0A]"
            />
            <p className="text-[8px] font-bold uppercase tracking-widest text-[#F5F5F5]/30 leading-none select-none">
              WASD pan · Space up · Shift down · RMB menu
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1 border-t border-[#730907]/40">
            {renderToggle('Ground Studio Grid', <Grid className="w-3.5 h-3.5 text-[#AE0D0A]" />, 'showGrid')}
            {renderToggle('Camera Wireframe Models', <Camera className="w-3.5 h-3.5 text-[#AE0D0A]" />, 'showCameraGlyphs')}
          </div>

          <div className="pt-2 border-t border-[#730907]/40 flex justify-center">
            <button
              type="button"
              onClick={handleReset}
              className="text-[9.5px] font-bold text-[#F5F5F5]/40 hover:text-[#AE0D0A] flex items-center gap-1 cursor-pointer transition uppercase tracking-wider"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Restore Defaults</span>
            </button>
          </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-0.5">
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} className="flex flex-col gap-1">
                  <div className="text-[8px] font-bold uppercase tracking-widest text-[#F5F5F5]/30 px-1">
                    {group.title}
                  </div>
                  {group.items.map(([label, keys]) => (
                    <div
                      key={`${group.title}-${label}`}
                      className="flex items-center justify-between gap-2 h-[18px] px-1 rounded-[4px] hover:bg-[#360403]/70"
                    >
                      <span className="text-[9.5px] font-bold text-[#F5F5F5]/80 truncate">{label}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {keys.map((k) => (
                          <span
                            key={k}
                            className="h-[16px] min-w-[16px] px-1.5 rounded-[4px] bg-[#360403] border border-white/10 text-[8.5px] font-bold text-[#F5F5F5]/90 flex items-center justify-center leading-none"
                          >
                            {k}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <p className="text-[8px] font-bold uppercase tracking-widest text-[#F5F5F5]/25 text-center leading-none pt-1">
                Double-tap G or R to grab with the cursor
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default SettingsModal;

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { SceneStage } from '../../engine/render/scene';
import { UserSettings, loadSettings, saveSettings, DEFAULT_SETTINGS } from '../../utils/settings';
import { Sliders, X, Grid, Camera, RotateCcw, Monitor } from 'lucide-react';
import { SNAPPY, PRESS_DOWN } from '../../utils/motion';

interface SettingsModalProps {
  isOpen?: boolean;
  onClose: () => void;
  origin: { x: number; y: number } | null;
  stage: SceneStage | null;
  onSettingsChange?: (settings: UserSettings) => void;
}

export function SettingsModal({ onClose, origin, stage, onSettingsChange }: SettingsModalProps) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  const applySettingsToStage = (newSettings: UserSettings) => {
    if (!stage) return;
    stage.controlsManager.setPerpetualFov(newSettings.perpetualFov);
    stage.controls.rotateSpeed = newSettings.orbitSensitivity;
    stage.controls.zoomSpeed = newSettings.orbitSensitivity;
    stage.grid.visible = newSettings.showGrid;
    stage.controlsManager.getCameraHelpers().forEach((h) => {
      h.visible = newSettings.showCameraGlyphs;
    });
  };

  useEffect(() => {
    if (stage) {
      applySettingsToStage(settings);
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
    applySettingsToStage(updated);
    onSettingsChange?.(updated);
  };

  const handleReset = () => {
    const defaults = { ...DEFAULT_SETTINGS };
    setSettings(defaults);
    saveSettings(defaults);
    applySettingsToStage(defaults);
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

        <div className="p-3.5 flex flex-col gap-3.5 text-[#F5F5F5]">
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
              <span>Orbit Sensitivity</span>
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
      </motion.div>
    </div>
  );
}

export default SettingsModal;

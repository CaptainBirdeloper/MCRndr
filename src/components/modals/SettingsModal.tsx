import { useState, useEffect, useRef } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { UserSettings, loadSettings, saveSettings, DEFAULT_SETTINGS } from '../../utils/settings';
import { Sliders, X, Grid, Camera, RotateCcw, Monitor } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  origin: { x: number; y: number } | null;
  stage: SceneStage | null;
  onSettingsChange?: (settings: UserSettings) => void;
}

export function SettingsModal({ isOpen, onClose, origin, stage, onSettingsChange }: SettingsModalProps) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [isRendered, setIsRendered] = useState(false);
  const [isAnimated, setIsAnimated] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const applySettingsToStage = (newSettings: UserSettings) => {
    if (!stage) return;
    stage.controlsManager.setPerpetualFov(newSettings.perpetualFov);
    stage.controls.rotateSpeed = newSettings.orbitSensitivity;
    stage.controls.zoomSpeed = newSettings.orbitSensitivity;
    stage.grid.visible = newSettings.showGrid;
    // EDGE CASE: helper array containing null or undefined elements will throw TypeError on h.visible
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
    if (isOpen) {
      setIsRendered(true);
    } else if (isRendered) {
      setIsAnimated(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isRendered) {
      if (modalRef.current) {
        void modalRef.current.offsetHeight;
      }
      let innerFrame = 0;
      const frame = requestAnimationFrame(() => {
        innerFrame = requestAnimationFrame(() => {
          setIsAnimated(true);
        });
      });
      return () => {
        cancelAnimationFrame(frame);
        cancelAnimationFrame(innerFrame);
      };
    }
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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

  const handleClose = () => {
    setIsAnimated(false);
    setTimeout(() => {
      onClose();
    }, 280);
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
          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-250 cursor-pointer flex items-center border-0 shadow-none ${
            isChecked ? 'bg-[#AE0D0A]' : 'bg-[#360403]'
          }`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white transition-transform duration-250 ease-spring ${
              isChecked ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    );
  };

  if (!isRendered) return null;

  // Calculate dynamic delta from button center to viewport center
  const deltaX = origin ? Math.round(origin.x - window.innerWidth / 2) : 0;
  const deltaY = origin ? Math.round(origin.y - window.innerHeight / 2) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center select-none font-['Rethink_Sans']">
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-280 ${
          isAnimated ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={modalRef}
        style={{
          transform: isAnimated
            ? 'translate(0px, 0px) scale(1)'
            : `translate(${deltaX}px, ${deltaY}px) scale(0.15)`,
          opacity: isAnimated ? 1 : 0,
          transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease-out',
        }}
        className="relative z-10 w-[340px] bg-[#07050F] rounded-[16px] border border-[#730907]/60 shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="w-full h-[32px] bg-[#730907] flex items-center justify-between px-3 border-0 shadow-none">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#F5F5F5] uppercase tracking-wider">
            <Sliders className="w-3.5 h-3.5 text-[#AE0D0A]" />
            <span>Settings</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-5 h-5 flex items-center justify-center text-[#F5F5F5]/60 hover:text-white cursor-pointer transition active:scale-90"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-3.5 flex flex-col gap-3.5 max-h-[80vh] overflow-y-auto custom-deck-scrollbar">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9.5px] font-bold text-[#F5F5F5]/60 uppercase tracking-wider flex items-center gap-1">
                <Monitor className="w-3 h-3 text-[#AE0D0A]" />
                <span>UI Zoom (Interface Scale)</span>
              </span>
              <span className="text-[11px] font-bold text-[#AE0D0A]">
                {settings.uiZoom}%
              </span>
            </div>

            <div className="w-full bg-[#360403] rounded-[12px] p-2.5 flex items-center">
              {/* EDGE CASE: invalid or non-numeric input converts to NaN, persisting corrupted uiZoom to localStorage */}
              <input
                type="range"
                min="50"
                max="300"
                step="5"
                value={settings.uiZoom}
                onChange={(e) => updateSetting('uiZoom', Number(e.target.value))}
                className="w-full h-1.5 bg-[#07050F] rounded-full appearance-none cursor-pointer accent-[#AE0D0A] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9.5px] font-bold text-[#F5F5F5]/60 uppercase tracking-wider">
                Default Workspace FOV
              </span>
              <span className="text-[11px] font-bold text-[#AE0D0A]">
                {settings.perpetualFov}°
              </span>
            </div>

            <div className="w-full bg-[#360403] rounded-[12px] p-2.5 flex flex-col gap-2">
              <input
                type="range"
                min="20"
                max="90"
                step="1"
                value={settings.perpetualFov}
                onChange={(e) => updateSetting('perpetualFov', Number(e.target.value))}
                className="w-full h-1.5 bg-[#07050F] rounded-full appearance-none cursor-pointer accent-[#AE0D0A] focus:outline-none"
              />
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: '25°', fov: 25 },
                  { label: '38°', fov: 38 },
                  { label: '60°', fov: 60 },
                  { label: '80°', fov: 80 },
                ].map((p) => (
                  <button
                    key={p.fov}
                    type="button"
                    onClick={() => updateSetting('perpetualFov', p.fov)}
                    className={`h-[18px] rounded-[6px] text-[8.5px] font-bold transition flex items-center justify-center cursor-pointer border-0 shadow-none active:scale-95 ${
                      settings.perpetualFov === p.fov
                        ? 'bg-[#AE0D0A] text-white'
                        : 'bg-[#07050F] text-[#F5F5F5]/70 hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[9.5px] font-bold text-[#F5F5F5]/60 uppercase tracking-wider">
                Orbit & Zoom Sensitivity
              </span>
              {/* EDGE CASE: orbitSensitivity being NaN or undefined will throw TypeError on .toFixed() or display NaN */}
              <span className="text-[11px] font-bold text-[#AE0D0A]">
                {settings.orbitSensitivity.toFixed(1)}x
              </span>
            </div>

            <div className="w-full bg-[#360403] rounded-[12px] p-2.5 flex items-center gap-3">
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={settings.orbitSensitivity}
                onChange={(e) => updateSetting('orbitSensitivity', Number(e.target.value))}
                className="w-full h-1.5 bg-[#07050F] rounded-full appearance-none cursor-pointer accent-[#AE0D0A] focus:outline-none"
              />
            </div>
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
      </div>
    </div>
  );
}

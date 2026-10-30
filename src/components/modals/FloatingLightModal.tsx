import { LightItem } from '../../types';
import { Sun, X } from 'lucide-react';

interface FloatingLightModalProps {
  light: LightItem | null;
  position: { x: number; y: number } | null;
  onIntensityChange: (id: string, intensity: number) => void;
  onColorChange?: (id: string, color: string) => void;
  onToggleShadow?: (id: string) => void;
  onClose: () => void;
}

export function FloatingLightModal({
  light,
  position,
  onIntensityChange,
  onColorChange,
  onToggleShadow,
  onClose,
}: FloatingLightModalProps) {
  if (!light || !position) return null;

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 w-[210px] bg-[#120D1B]/95 backdrop-blur-md rounded-[14px] border border-[#730907]/60 shadow-2xl p-2.5 flex flex-col gap-2 font-['Rethink_Sans'] text-white select-none pointer-events-auto"
    >
      <div className="flex items-center justify-between border-b border-[#730907]/30 pb-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#AE0D0A] uppercase tracking-wider">
          <Sun className="w-3 h-3 shrink-0" />
          <span className="truncate">{light.name}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-4 h-4 rounded-full flex items-center justify-center text-[#F5F5F5]/60 hover:text-white cursor-pointer active:scale-90"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Intensity Slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[9px] font-bold text-[#F5F5F5]/60">
          <span>INTENSITY</span>
          <span className="text-[#AE0D0A]">{light.intensity.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="5"
          step="0.1"
          value={light.intensity}
          onChange={(e) => onIntensityChange(light.id, parseFloat(e.target.value))}
          className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#360403] rounded-lg appearance-none"
        />
      </div>

      {/* Quick Color Swatches */}
      {onColorChange && (
        <div className="flex items-center justify-between pt-1 border-t border-[#730907]/30">
          <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">COLOR</span>
          <div className="flex items-center gap-1.5">
            {['#FFF3E0', '#CFD8DC', '#80D8FF', '#FFA726'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(light.id, c)}
                style={{ backgroundColor: c }}
                className={`w-3.5 h-3.5 rounded-full border cursor-pointer active:scale-90 transition ${
                  light.color.toLowerCase() === c.toLowerCase()
                    ? 'border-[#AE0D0A] scale-110'
                    : 'border-white/20'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Cast Shadow Toggle for Directional Lights */}
      {light.type === 'directional' && onToggleShadow && (
        <div className="flex items-center justify-between pt-1 border-t border-[#730907]/30">
          <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">SHADOW</span>
          <button
            type="button"
            onClick={() => onToggleShadow(light.id)}
            className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider transition ${
              light.castShadow ? 'bg-[#AE0D0A] text-white' : 'bg-[#07050F] text-[#F5F5F5]/60 hover:text-white'
            }`}
          >
            {light.castShadow ? 'On' : 'Off'}
          </button>
        </div>
      )}
    </div>
  );
}

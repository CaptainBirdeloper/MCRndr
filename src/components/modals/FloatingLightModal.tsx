import { LightSpec } from '../../types';
import { Sun, X } from 'lucide-react';

const SWATCHES = ['#FFF3E0', '#CFD8DC', '#80D8FF', '#FFA726'];
const MAP_SIZES: Array<512 | 1024 | 2048> = [512, 1024, 2048];
const MAP_LABELS: Record<number, string> = { 512: '512', 1024: '1K', 2048: '2K' };

interface FloatingLightModalProps {
  light: LightSpec | null;
  position: { x: number; y: number } | null;
  onUpdate: (id: string, patch: Partial<LightSpec>) => void;
  onClose: () => void;
}

export function FloatingLightModal({ light, position, onUpdate, onClose }: FloatingLightModalProps) {
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

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[9px] font-bold text-[#F5F5F5]/60">
          <span>INTENSITY</span>
          <span className="text-[#AE0D0A]">{light.intensity.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={light.intensity}
          onChange={(e) => onUpdate(light.id, { intensity: parseFloat(e.target.value) })}
          className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold text-[#F5F5F5]/60">COLOR</span>
        <div className="flex items-center gap-1.5">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdate(light.id, { color: c.toLowerCase() })}
              style={{ backgroundColor: c }}
              className={`w-3.5 h-3.5 rounded-full border cursor-pointer active:scale-90 transition ${
                light.color.toLowerCase() === c.toLowerCase()
                  ? 'border-[#AE0D0A] scale-110'
                  : 'border-white/20'
              }`}
            />
          ))}
          <input
            type="color"
            value={light.color}
            onChange={(e) => onUpdate(light.id, { color: e.target.value })}
            className="w-4 h-4 rounded-full bg-transparent border border-white/20 cursor-pointer p-0"
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-[9px] font-bold text-[#F5F5F5]/60">
        <span>POSITION</span>
        <span className="text-[#F5F5F5]/70 tabular-nums">
          {light.position.map((v) => v.toFixed(1)).join('  ')}
        </span>
      </div>

      <div className="flex flex-col gap-1 pt-1 border-t border-[#730907]/30">
        <div className="flex items-center justify-between">
          <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">SHADOW</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onUpdate(light.id, { shadow: { ...light.shadow, enabled: !light.shadow.enabled } })
              }
              className={`px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider transition cursor-pointer ${
                light.shadow.enabled
                  ? 'bg-[#AE0D0A] text-white'
                  : 'bg-[#07050F] text-[#F5F5F5]/60 hover:text-white'
              }`}
            >
              {light.shadow.enabled ? 'On' : 'Off'}
            </button>
            {MAP_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onUpdate(light.id, { shadow: { ...light.shadow, mapSize: size } })}
                className={`h-[16px] px-1 rounded-[4px] text-[8px] font-bold cursor-pointer ${
                  light.shadow.mapSize === size
                    ? 'bg-[#AE0D0A] text-white'
                    : 'bg-[#07050F] text-[#F5F5F5]/60 hover:text-white'
                }`}
              >
                {MAP_LABELS[size]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
          <span>SOFTNESS</span>
          <span className="text-[#AE0D0A]">{light.shadow.radius.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="12"
          step="0.5"
          value={light.shadow.radius}
          onChange={(e) =>
            onUpdate(light.id, { shadow: { ...light.shadow, radius: parseFloat(e.target.value) } })
          }
          className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
        />
      </div>

      {light.type === 'spot' && (
        <div className="flex flex-col gap-1 pt-1 border-t border-[#730907]/30">
          <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
            <span>ANGLE</span>
            <span className="text-[#AE0D0A]">{Math.round((light.angle * 180) / Math.PI)}°</span>
          </div>
          <input
            type="range"
            min="5"
            max="80"
            step="1"
            value={Math.round((light.angle * 180) / Math.PI)}
            onChange={(e) =>
              onUpdate(light.id, { angle: (parseFloat(e.target.value) * Math.PI) / 180 })
            }
            className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
          />
          <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
            <span>PENUMBRA</span>
            <span className="text-[#AE0D0A]">{light.penumbra.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={light.penumbra}
            onChange={(e) => onUpdate(light.id, { penumbra: parseFloat(e.target.value) })}
            className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
          />
        </div>
      )}
    </div>
  );
}

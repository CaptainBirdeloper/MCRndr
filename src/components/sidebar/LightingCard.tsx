import { useState, useEffect } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { LightItem, LightingStyle } from '../../types';
import { Sun, Eye, EyeOff } from 'lucide-react';

interface LightingCardProps {
  stage: SceneStage | null;
}

export function LightingCard({ stage }: LightingCardProps) {
  const [lights, setLights] = useState<LightItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [style, setStyle] = useState<LightingStyle>('realistic');

  useEffect(() => {
    if (!stage?.lightingManager) return;
    const lm = stage.lightingManager;
    setLights(lm.getLights());
    setActiveId(lm.getActiveLightId());
    setStyle(lm.getStyle());

    lm.setChangeListener((updatedLights, active) => {
      setLights([...updatedLights]);
      setActiveId(active);
      setStyle(lm.getStyle());
    });
  }, [stage]);

  const activeLight = lights.find((l) => l.id === activeId);

  return (
    <div className="w-full flex flex-col gap-2 font-['Rethink_Sans'] select-none">
      {/* Card Container */}
      <div className="mx-auto w-[calc(100%-16px)] bg-[#730907]/40 rounded-[14px] p-2 flex flex-col gap-2">
        {/* Header */}
        <div className="w-full flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#F5F5F5] uppercase tracking-wider">
            <Sun className="w-3.5 h-3.5 text-[#AE0D0A]" />
            <span>Lighting</span>
          </div>
        </div>

        {/* Style Switcher Pill */}
        <div className="w-full h-[22px] bg-[#07050F] p-[2px] rounded-full flex items-center">
          <button
            type="button"
            onClick={() => stage?.lightingManager.setStyle('realistic')}
            className={`flex-1 h-full rounded-full text-[8.5px] font-bold uppercase tracking-wider transition ${
              style === 'realistic' ? 'bg-[#AE0D0A] text-white' : 'text-[#F5F5F5]/60 hover:text-white'
            }`}
          >
            Realistic
          </button>
          <button
            type="button"
            onClick={() => stage?.lightingManager.setStyle('minecrafty')}
            className={`flex-1 h-full rounded-full text-[8.5px] font-bold uppercase tracking-wider transition ${
              style === 'minecrafty' ? 'bg-[#AE0D0A] text-white' : 'text-[#F5F5F5]/60 hover:text-white'
            }`}
          >
            Minecrafty
          </button>
        </div>

        {/* Lights List */}
        <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto custom-deck-scrollbar">
          {lights.map((l) => (
            <div
              key={l.id}
              onClick={() => stage?.lightingManager.selectLight(l.id)}
              className={`w-full h-[24px] px-2 rounded-[8px] flex items-center justify-between cursor-pointer transition ${
                l.id === activeId
                  ? 'bg-[#AE0D0A] text-white font-bold'
                  : 'bg-[#07050F]/60 text-[#F5F5F5]/80 hover:bg-[#07050F]'
              }`}
            >
              <span className="text-[9.5px] truncate">{l.name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stage?.lightingManager.toggleLightVisibility(l.id);
                }}
                className="w-4 h-4 flex items-center justify-center text-[#F5F5F5]/60 hover:text-white"
              >
                {l.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
          ))}
        </div>

        {/* Active Light Intensity */}
        {activeLight && (
          <div className="flex flex-col gap-1 pt-1 border-t border-[#730907]/40">
            <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
              <span>{activeLight.name.toUpperCase()} INTENSITY</span>
              <span className="text-[#AE0D0A]">{activeLight.intensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={activeLight.intensity}
              onChange={(e) =>
                stage?.lightingManager.setLightIntensity(activeLight.id, parseFloat(e.target.value))
              }
              className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}

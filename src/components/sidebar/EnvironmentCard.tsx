import { useEffect, useState } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { EnvironmentState, SKYBOX_PRESETS } from '../../engine/render/environmentManager';
import { GroundMode } from '../../utils/settings';

const GROUND_OPTIONS: Array<{ id: GroundMode; label: string }> = [
  { id: 'shadow', label: 'SHADOW' },
  { id: 'grass', label: 'GRASS' },
  { id: 'off', label: 'OFF' },
];

interface EnvironmentCardProps {
  stage: SceneStage | null;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-7 h-3.5 rounded-full p-0.5 flex items-center transition-colors cursor-pointer ${
        on ? 'bg-[#AE0D0A]' : 'bg-[#07050F]/80'
      }`}
    >
      <span
        className={`w-2.5 h-2.5 rounded-full bg-[#F5F5F5] transition-transform ${
          on ? 'translate-x-3.5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onInput,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onInput: (value: number) => void;
  onCommit: () => void;
}) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onInput(Number(e.target.value))}
      onPointerUp={onCommit}
      className="w-full h-1 accent-[#AE0D0A] cursor-pointer"
    />
  );
}

export function EnvironmentCard({ stage }: EnvironmentCardProps) {
  const [state, setState] = useState<EnvironmentState | null>(null);

  useEffect(() => {
    if (!stage?.environmentManager) return;
    const em = stage.environmentManager;
    setState(em.getState());
    em.setChangeListener((updated) => setState({ ...updated }));
    return () => em.setChangeListener(null);
  }, [stage]);

  const em = stage?.environmentManager;
  if (!em || !state) return null;

  return (
    <div className="w-full bg-[#730907]/40 rounded-[9px] overflow-hidden flex flex-col font-['Rethink_Sans'] select-none">
      <div className="w-full h-[19px] bg-[#730907] flex items-center justify-center px-2">
        <span className="text-[11px] font-bold text-[#AD0D0A] uppercase tracking-wider truncate">
          ENVIRONMENT
        </span>
      </div>
      <div className="p-2 flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">SKYBOX</span>
          <div className="flex items-center gap-1">
            {SKYBOX_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => em.setSkybox(preset.id)}
                className={`flex-1 h-[16px] rounded-[4px] text-[8px] font-bold uppercase tracking-wider cursor-pointer transition ${
                  state.skyboxId === preset.id
                    ? 'bg-[#AE0D0A] text-white'
                    : 'bg-[#07050F]/60 text-[#F5F5F5]/60 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">GROUND</span>
          <div className="flex items-center gap-1">
            {GROUND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => em.setGroundMode(option.id)}
                className={`flex-1 h-[16px] rounded-[4px] text-[8px] font-bold uppercase tracking-wider cursor-pointer transition ${
                  state.groundMode === option.id
                    ? 'bg-[#AE0D0A] text-white'
                    : 'bg-[#07050F]/60 text-[#F5F5F5]/60 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 pt-1 border-t border-[#730907]/30">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">FOG</span>
            <Toggle on={state.fogEnabled} onClick={() => em.setFogEnabled(!state.fogEnabled)} />
          </div>
          {state.fogEnabled && state.groundMode === 'grass' && (
            <div className="flex items-center gap-2">
              <Slider
                value={state.fogFar}
                min={20}
                max={120}
                step={2}
                onInput={(value) => em.setFogFar(value)}
                onCommit={() => undefined}
              />
              <span className="w-6 text-right text-[8px] font-bold text-[#F5F5F5]/60">{Math.round(state.fogFar)}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 pt-1 border-t border-[#730907]/30">
          <div className="flex items-center justify-between">
            <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">GI</span>
            <Toggle on={state.giEnabled} onClick={() => em.setGiEnabled(!state.giEnabled)} />
          </div>
          {state.giEnabled && (
            <div className="flex items-center gap-2">
              <Slider
                value={state.giIntensity}
                min={0}
                max={2}
                step={0.05}
                onInput={(value) => em.setGiIntensity(value)}
                onCommit={() => undefined}
              />
              <span className="w-6 text-right text-[8px] font-bold text-[#F5F5F5]/60">{state.giIntensity.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

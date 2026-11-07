import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { SceneStage } from '../../engine/render/scene';
import { EnvironmentState, SKYBOX_PRESETS } from '../../engine/render/environmentManager';
import { GroundMode } from '../../utils/settings';
import { SNAPPY } from '../../utils/motion';
import { useSlidingPill } from '../../utils/useSlidingPill';

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
      className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
    />
  );
}

export function EnvironmentCard({ stage }: EnvironmentCardProps) {
  const [state, setState] = useState<EnvironmentState | null>(null);
  const skyPill = useSlidingPill(state?.skyboxId ?? null);
  const groundPill = useSlidingPill(state?.groundMode ?? null);

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
          <div ref={skyPill.containerRef} className="relative grid grid-cols-2 gap-1">
            {skyPill.pill && (
              <motion.span
                initial={false}
                animate={{
                  x: skyPill.pill.x,
                  y: skyPill.pill.y,
                  width: skyPill.pill.width,
                  height: skyPill.pill.height,
                }}
                transition={SNAPPY}
                className="absolute left-0 top-0 rounded-[5px] bg-[#AE0D0A] pointer-events-none"
              />
            )}
            {SKYBOX_PRESETS.map((preset) => (
              <button
                key={preset.id}
                ref={skyPill.register(preset.id)}
                type="button"
                onClick={() => em.setSkybox(preset.id)}
                className={`relative z-10 h-[19px] rounded-[5px] text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                  state.skyboxId === preset.id
                    ? 'text-white'
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
          <div ref={groundPill.containerRef} className="relative flex items-center gap-1">
            {groundPill.pill && (
              <motion.span
                initial={false}
                animate={{
                  x: groundPill.pill.x,
                  y: groundPill.pill.y,
                  width: groundPill.pill.width,
                  height: groundPill.pill.height,
                }}
                transition={SNAPPY}
                className="absolute left-0 top-0 rounded-[5px] bg-[#AE0D0A] pointer-events-none"
              />
            )}
            {GROUND_OPTIONS.map((option) => (
              <button
                key={option.id}
                ref={groundPill.register(option.id)}
                type="button"
                onClick={() => em.setGroundMode(option.id)}
                className={`relative z-10 flex-1 h-[19px] rounded-[5px] text-[8px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                  state.groundMode === option.id
                    ? 'text-white'
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
              <span className="w-7 text-right text-[8.5px] font-bold text-[#AE0D0A]">{Math.round(state.fogFar)}</span>
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
              <span className="w-7 text-right text-[8.5px] font-bold text-[#AE0D0A]">{state.giIntensity.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

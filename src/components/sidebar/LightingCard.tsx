import { useState, useEffect, useRef } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { LightSpec, LightType } from '../../types';
import { Eye, EyeOff, Plus, Trash2, Copy } from 'lucide-react';

const PRESET_SWATCHES = ['#FFF3E0', '#CFD8DC', '#80D8FF', '#FFA726'];
const MAP_SIZES: Array<512 | 1024 | 2048> = [512, 1024, 2048];
const MAP_LABELS: Record<number, string> = { 512: '512', 1024: '1K', 2048: '2K' };
const ADD_TYPES: Array<{ type: LightType; label: string }> = [
  { type: 'directional', label: 'Directional' },
  { type: 'point', label: 'Point' },
  { type: 'spot', label: 'Spot' },
];

interface LightingCardProps {
  stage: SceneStage | null;
}

export function LightingCard({ stage }: LightingCardProps) {
  const [lights, setLights] = useState<LightSpec[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const dragRef = useRef<{ specs: LightSpec[]; exposure: number } | null>(null);

  useEffect(() => {
    if (!stage?.lightingManager) return;
    const lm = stage.lightingManager;
    setLights(lm.getSpecs());
    setActiveId(lm.getActiveLightId());
    setPresetId(lm.getActivePresetId());

    lm.setChangeListener((updatedLights, active) => {
      setLights([...updatedLights]);
      setActiveId(active);
      setPresetId(lm.getActivePresetId());
    });
  }, [stage]);

  const lm = stage?.lightingManager;
  const spatial = lights.filter((l) => l.type !== 'ambient');
  const ambient = lights.find((l) => l.type === 'ambient') ?? null;
  const activeLight = spatial.find((l) => l.id === activeId) ?? null;
  const presets = lm?.getPresets() ?? [];

  const pushHistory = (prev: LightSpec[], prevExposure: number) => {
    if (!stage || !lm) return;
    stage.controlsManager.commitLightHistory(prev, lm.getSpecs(), prevExposure, lm.getExposure());
  };

  const mutate = (fn: () => void) => {
    if (!lm) return;
    const prev = lm.getSpecs();
    const prevExposure = lm.getExposure();
    fn();
    pushHistory(prev, prevExposure);
  };

  const beginDrag = () => {
    if (!lm) return;
    dragRef.current = { specs: lm.getSpecs(), exposure: lm.getExposure() };
  };

  const commitDrag = () => {
    if (!dragRef.current) return;
    pushHistory(dragRef.current.specs, dragRef.current.exposure);
    dragRef.current = null;
  };

  const update = (id: string, patch: Partial<LightSpec>) => lm?.updateLight(id, patch);

  return (
    <div className="w-full flex flex-col gap-2 font-['Rethink_Sans'] select-none">
      <div className="w-full bg-[#730907]/40 rounded-[9px] overflow-hidden flex flex-col font-['Rethink_Sans'] select-none">
        <div className="w-full h-[19px] bg-[#730907] flex items-center justify-center px-2">
          <span className="text-[11px] font-bold text-[#AD0D0A] uppercase tracking-wider truncate">
            LIGHTING
          </span>
        </div>
        <div className="p-2 flex flex-col gap-2">
        <div className="w-full flex items-center justify-end px-1">
          <div className="relative">
            <button
              type="button"
              title="Add light"
              onClick={() => setAddOpen((v) => !v)}
              className="w-4 h-4 rounded-full flex items-center justify-center text-[#F5F5F5]/60 hover:text-white cursor-pointer active:scale-90"
            >
              <Plus className="w-3 h-3" />
            </button>
            {addOpen && (
              <div className="absolute right-0 top-5 z-30 w-[104px] p-1 rounded-[8px] bg-[#120D1B] border border-[#730907]/60 shadow-xl flex flex-col gap-0.5">
                {ADD_TYPES.map((entry) => (
                  <button
                    key={entry.type}
                    type="button"
                    onClick={() => {
                      mutate(() => lm?.addLight(entry.type));
                      setAddOpen(false);
                    }}
                    className="h-[20px] px-1.5 rounded-[5px] text-[8.5px] font-bold uppercase tracking-wider text-left text-[#F5F5F5]/80 hover:bg-[#730907] hover:text-white cursor-pointer"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto custom-deck-scrollbar pb-0.5">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => mutate(() => lm?.applyPreset(p.id))}
              className={`h-[16px] px-1.5 rounded-[4px] text-[8px] font-bold uppercase tracking-wider shrink-0 cursor-pointer transition ${
                presetId === p.id
                  ? 'bg-[#AE0D0A] text-white'
                  : 'bg-[#07050F]/60 text-[#F5F5F5]/60 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1 max-h-[132px] overflow-y-auto custom-deck-scrollbar">
          {spatial.map((l) => (
            <div
              key={l.id}
              onClick={() => lm?.selectLight(l.id)}
              className={`w-full h-[24px] px-2 rounded-[8px] flex items-center justify-between cursor-pointer transition ${
                l.id === activeId
                  ? 'bg-[#AE0D0A] text-white font-bold'
                  : 'bg-[#07050F]/60 text-[#F5F5F5]/80 hover:bg-[#07050F]'
              }`}
            >
              <span className="text-[9.5px] truncate">{l.name}</span>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  title={l.visible ? 'Hide light' : 'Show light'}
                  onClick={(e) => {
                    e.stopPropagation();
                    mutate(() => update(l.id, { visible: !l.visible }));
                  }}
                  className="w-4 h-4 flex items-center justify-center text-[#F5F5F5]/60 hover:text-white cursor-pointer"
                >
                  {l.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  title="Delete light"
                  onClick={(e) => {
                    e.stopPropagation();
                    mutate(() => lm?.removeLight(l.id));
                  }}
                  className="w-4 h-4 flex items-center justify-center text-[#F5F5F5]/40 hover:text-[#AE0D0A] cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {activeLight && (
          <div className="flex flex-col gap-1.5 pt-1.5 border-t border-[#730907]/40">
            <div className="flex items-center justify-between">
              <span className="text-[8.5px] font-bold text-[#F5F5F5]/60 uppercase truncate">
                {activeLight.name}
              </span>
              <button
                type="button"
                title="Duplicate light"
                onClick={() => mutate(() => {
                  const id = lm?.duplicateLight(activeLight.id);
                  if (id) lm?.selectLight(id);
                })}
                className="w-4 h-4 flex items-center justify-center text-[#F5F5F5]/40 hover:text-white cursor-pointer"
              >
                <Copy className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
              <span>INTENSITY</span>
              <span className="text-[#AE0D0A]">{activeLight.intensity.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={activeLight.intensity}
              onPointerDown={beginDrag}
              onPointerUp={commitDrag}
              onPointerCancel={commitDrag}
              onChange={(e) => update(activeLight.id, { intensity: parseFloat(e.target.value) })}
              className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
            />

            <div className="flex items-center justify-between pt-1 border-t border-[#730907]/30">
              <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">COLOR</span>
              <div className="flex items-center gap-1.5">
                {PRESET_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => mutate(() => update(activeLight.id, { color: c.toLowerCase() }))}
                    style={{ backgroundColor: c }}
                    className={`w-3.5 h-3.5 rounded-full border cursor-pointer active:scale-90 transition ${
                      activeLight.color.toLowerCase() === c.toLowerCase()
                        ? 'border-[#AE0D0A] scale-110'
                        : 'border-white/20'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={activeLight.color}
                  onChange={(e) => update(activeLight.id, { color: e.target.value })}
                  onBlur={commitDrag}
                  onPointerDown={beginDrag}
                  className="w-4 h-4 rounded-full bg-transparent border border-white/20 cursor-pointer p-0"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
              <span>POSITION</span>
              <span className="text-[#F5F5F5]/70 tabular-nums">
                {activeLight.position.map((v) => v.toFixed(1)).join('  ')}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-[#730907]/30">
              <span className="text-[8.5px] font-bold text-[#F5F5F5]/60">SHADOW</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() =>
                    mutate(() =>
                      update(activeLight.id, {
                        shadow: { ...activeLight.shadow, enabled: !activeLight.shadow.enabled },
                      })
                    )
                  }
                  className={`px-1.5 h-[15px] rounded-full text-[8px] font-bold uppercase tracking-wider transition cursor-pointer ${
                    activeLight.shadow.enabled
                      ? 'bg-[#AE0D0A] text-white'
                      : 'bg-[#07050F] text-[#F5F5F5]/60 hover:text-white'
                  }`}
                >
                  {activeLight.shadow.enabled ? 'On' : 'Off'}
                </button>
                {MAP_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() =>
                      mutate(() =>
                        update(activeLight.id, { shadow: { ...activeLight.shadow, mapSize: size } })
                      )
                    }
                    className={`h-[15px] px-1 rounded-[4px] text-[8px] font-bold cursor-pointer ${
                      activeLight.shadow.mapSize === size
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
              <span className="text-[#AE0D0A]">{activeLight.shadow.radius.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="12"
              step="0.5"
              value={activeLight.shadow.radius}
              onPointerDown={beginDrag}
              onPointerUp={commitDrag}
              onPointerCancel={commitDrag}
              onChange={(e) =>
                update(activeLight.id, {
                  shadow: { ...activeLight.shadow, radius: parseFloat(e.target.value) },
                })
              }
              className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
            />

            {activeLight.type === 'spot' && (
              <>
                <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
                  <span>ANGLE</span>
                  <span className="text-[#AE0D0A]">{Math.round((activeLight.angle * 180) / Math.PI)}°</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="1"
                  value={Math.round((activeLight.angle * 180) / Math.PI)}
                  onPointerDown={beginDrag}
                  onPointerUp={commitDrag}
                  onPointerCancel={commitDrag}
                  onChange={(e) =>
                    update(activeLight.id, { angle: (parseFloat(e.target.value) * Math.PI) / 180 })
                  }
                  className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
                />
                <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
                  <span>PENUMBRA</span>
                  <span className="text-[#AE0D0A]">{activeLight.penumbra.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={activeLight.penumbra}
                  onPointerDown={beginDrag}
                  onPointerUp={commitDrag}
                  onPointerCancel={commitDrag}
                  onChange={(e) => update(activeLight.id, { penumbra: parseFloat(e.target.value) })}
                  className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
                />
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 pt-1.5 border-t border-[#730907]/40">
          {ambient && (
            <>
              <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
                <span>AMBIENT</span>
                <span className="text-[#AE0D0A]">{ambient.intensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={ambient.intensity}
                onPointerDown={beginDrag}
                onPointerUp={commitDrag}
                onPointerCancel={commitDrag}
                onChange={(e) => update(ambient.id, { intensity: parseFloat(e.target.value) })}
                className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
              />
            </>
          )}
          <div className="flex items-center justify-between text-[8.5px] font-bold text-[#F5F5F5]/60">
            <span>EXPOSURE</span>
            <span className="text-[#AE0D0A]">{(lm?.getExposure() ?? 1).toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="3"
            step="0.05"
            value={lm?.getExposure() ?? 1}
            onPointerDown={beginDrag}
            onPointerUp={commitDrag}
            onPointerCancel={commitDrag}
            onChange={(e) => lm?.setExposure(parseFloat(e.target.value))}
            className="w-full accent-[#AE0D0A] cursor-pointer h-1.5 bg-[#07050F] rounded-lg appearance-none"
          />
        </div>
        </div>
      </div>
    </div>
  );
}

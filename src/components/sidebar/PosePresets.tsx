import { POSE_PRESETS } from '../../presets/poses';
import { AutoFitText } from '../common/AutoFitText';
import { Sparkles, Plus } from 'lucide-react';

interface PosePresetsProps {
  activePoseId: string | null;
  onPoseSelect: (id: string) => void;
}

export function PosePresets({ activePoseId, onPoseSelect }: PosePresetsProps) {
  return (
    <div className="flex flex-col gap-1.5 pt-0.5">
      <div className="flex items-center gap-1 text-[#F5F5F5]/60 text-[9px] font-bold tracking-wider">
        <span>PRESETS</span>
        <Sparkles className="w-2.5 h-2.5 text-[#F5F5F5]/60" />
      </div>

      {/* Responsive 2-Column Buttons (radius 15px, NO borders, NO inner shadow) */}
      <div className="grid grid-cols-2 gap-1.5 w-full">
        {POSE_PRESETS.map((preset) => {
          const isActive = activePoseId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPoseSelect(preset.id)}
              className={`h-[22px] rounded-[15px] text-[8.5px] font-bold uppercase tracking-wider transition active:scale-95 cursor-pointer px-1.5 flex items-center justify-center border-0 shadow-none overflow-hidden ${
                isActive
                  ? 'bg-[#AE0D0A] text-[#F5F5F5]'
                  : 'bg-[#07050F] text-[#F5F5F5] hover:bg-[#730907]/40'
              }`}
            >
              <AutoFitText horizontalPadding={4} minScale={0.55}>
                {preset.name}
              </AutoFitText>
            </button>
          );
        })}
      </div>

      {/* Plus Button (14x14, radius 15px, border-0) */}
      <button
        type="button"
        title="Add custom preset"
        className="w-[16px] h-[16px] rounded-full bg-[#07050F] hover:bg-[#730907] flex items-center justify-center text-white transition active:scale-90 cursor-pointer mt-0.5 border-0 shadow-none"
      >
        <Plus className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

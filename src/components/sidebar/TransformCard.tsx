import { BodyPartName } from '../../types';
import { PosePresets } from './PosePresets';
import { Move, RotateCw, MousePointerClick } from 'lucide-react';

interface TransformCardProps {
  activeTab: 'BODY' | 'POSE';
  selectedPart: BodyPartName | null;
  rootPos: [number, number, number];
  rootRot: [number, number, number];
  partPos: [number, number, number];
  partRot: [number, number, number];
  onFocus: (kind: 'pos' | 'rot', axis: 'x' | 'y' | 'z', val: number) => void;
  onBlur: (kind: 'pos' | 'rot', axis: 'x' | 'y' | 'z', val: number) => void;
  onPosChange: (axis: 'x' | 'y' | 'z', valStr: string) => void;
  onRotChange: (axis: 'x' | 'y' | 'z', valStr: string) => void;
  activePoseId: string | null;
  onPoseSelect: (id: string) => void;
}

export function TransformCard({
  activeTab,
  selectedPart,
  rootPos,
  rootRot,
  partPos,
  partRot,
  onFocus,
  onBlur,
  onPosChange,
  onRotChange,
  activePoseId,
  onPoseSelect,
}: TransformCardProps) {
  const formatPartName = (name: string) => {
    // EDGE CASE: name being undefined or null will throw TypeError on .replace()
    return name.replace(/([A-Z])/g, ' $1').toUpperCase().trim();
  };

  const renderAxisInputBox = (
    kind: 'pos' | 'rot',
    values: [number, number, number],
    onChange: (axis: 'x' | 'y' | 'z', valStr: string) => void
  ) => (
    <div className="w-full h-[42px] bg-[#360403] rounded-[15px] flex items-center overflow-hidden border-0 shadow-none">
      {(['x', 'y', 'z'] as const).map((axis, i) => {
        // EDGE CASE: rootPos or partPos array index i missing evaluates to undefined, switching input to uncontrolled
        const currentVal = values[i];
        return (
          <div key={axis} className="flex-1 h-full flex flex-col items-center justify-center relative">
            <span className="text-[10px] font-bold text-[#F5F5F5]/60 leading-none pt-1">
              {axis.toUpperCase()}
            </span>
            <input
              type="number"
              value={currentVal}
              onFocus={() => onFocus(kind, axis, currentVal)}
              onBlur={() => onBlur(kind, axis, currentVal)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLElement).blur();
              }}
              onChange={(e) => onChange(axis, e.target.value)}
              className="w-full text-center text-[18px] font-bold text-[#F5F5F5] bg-transparent border-0 focus:outline-none p-0 leading-tight [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {i < 2 && (
              <div className="absolute right-0 top-2 bottom-2 w-[1px] bg-[#07050F]/60 pointer-events-none" />
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mt-3.5 w-full min-h-[267px] bg-[#730907]/40 rounded-[9px] overflow-hidden flex flex-col border-0 shadow-none">
      <div className="w-full h-[19px] bg-[#730907] flex items-center justify-center px-2">
        <span className="text-[11px] font-bold text-[#AD0D0A] uppercase tracking-wider truncate">
          {activeTab === 'BODY'
            ? 'Transform'
            : selectedPart && selectedPart !== 'root'
            ? formatPartName(selectedPart)
            : 'POSE'}
        </span>
      </div>

      {activeTab === 'POSE' && (!selectedPart || selectedPart === 'root') ? (
        <div className="p-4 flex-1 flex flex-col items-center justify-center text-center gap-2">
          <MousePointerClick className="w-6 h-6 text-[#F5F5F5]/20" />
          <span className="text-[10px] font-medium text-[#F5F5F5]/40 leading-relaxed">
            Select a limb on the character to pose
          </span>
        </div>
      ) : (
        <div className="p-2 flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[#F5F5F5]/60 text-[9px] font-bold tracking-wider">
              <span>TRANSLATE</span>
              <Move className="w-2.5 h-2.5 text-[#F5F5F5]/60" />
            </div>

            {renderAxisInputBox('pos', activeTab === 'BODY' ? rootPos : partPos, onPosChange)}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-[#F5F5F5]/60 text-[9px] font-bold tracking-wider">
              <span>ROTATE</span>
              <RotateCw className="w-2.5 h-2.5 text-[#F5F5F5]/60" />
            </div>

            {renderAxisInputBox('rot', activeTab === 'BODY' ? rootRot : partRot, onRotChange)}
          </div>

          <PosePresets activePoseId={activePoseId} onPoseSelect={onPoseSelect} />
        </div>
      )}
    </div>
  );
}

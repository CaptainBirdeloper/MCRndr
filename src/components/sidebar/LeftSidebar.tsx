import { useState, useEffect, useRef } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { BodyPartName } from '../../types';
import { TransformCard } from './TransformCard';
import { CameraCard } from './CameraCard';
import { LightingCard } from './LightingCard';
import { Upload, Image as ImageIcon, Settings } from 'lucide-react';

interface LeftSidebarProps {
  stage: SceneStage | null;
  skinName: string | null;
  activePoseId: string | null;
  selectedPart: BodyPartName | null;
  onPoseSelect: (id: string) => void;
  onSkinLoaded: (fileName: string, armType: 'steve' | 'alex') => void;
  onOpenExport: () => void;
  onOpenSettings: (origin: { x: number; y: number }) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function LeftSidebar({
  stage,
  skinName,
  activePoseId,
  selectedPart,
  onPoseSelect,
  onSkinLoaded,
  onOpenExport,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
}: LeftSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  // Tab mode: 'BODY' (whole body transform), 'POSE' (part-wise limb posing), or 'WORLD' (camera/environment)
  const [activeTab, setActiveTab] = useState<'BODY' | 'POSE' | 'WORLD'>('BODY');

  // Whole Body Transform State
  const [rootPos, setRootPos] = useState<[number, number, number]>([0, 0, 0]);
  const [rootRot, setRootRot] = useState<[number, number, number]>([0, 0, 0]);

  // Selected Part Transform State (for POSE tab)
  const [partPos, setPartPos] = useState<[number, number, number]>([0, 0, 0]);
  const [partRot, setPartRot] = useState<[number, number, number]>([0, 0, 0]);

  // Sync tab mode with stage controls wholeBodyMode
  const handleTabChange = (tab: 'BODY' | 'POSE' | 'WORLD') => {
    setActiveTab(tab);
    if (!stage) return;
    if (tab === 'BODY') {
      stage.controlsManager.setWholeBodyMode(true);
    } else {
      stage.controlsManager.setWholeBodyMode(false);
      stage.controlsManager.selectPart(null);
    }
  };

  useEffect(() => {
    if (!stage) return;
    const controls = stage.controlsManager;

    controls.setRootTransformListener((pos, rot) => {
      setRootPos([...pos]);
      setRootRot([...rot]);
    });

    controls.setPartTransformListener((_part, pos, rot) => {
      setPartPos([...pos]);
      setPartRot([...rot]);
    });

    const currentRoot = controls.getRootTransform();
    setRootPos([...currentRoot.position]);
    setRootRot([...currentRoot.rotationDeg]);
  }, [stage]);

  // Update part values whenever selected part changes
  useEffect(() => {
    if (!stage || !selectedPart || selectedPart === 'root') return;
    const currentPart = stage.controlsManager.getPartTransform(selectedPart);
    setPartPos([...currentPart.position]);
    setPartRot([...currentPart.rotationDeg]);
  }, [stage, selectedPart]);

  // Press 1 for BODY, 2 for POSE
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        handleTabChange('BODY');
      } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        handleTabChange('POSE');
      } else if (e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        handleTabChange('WORLD');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && stage) {
      const detectedArm = await stage.loadSkinFile(file);
      onSkinLoaded(file.name, detectedArm);
    }
  };

  // Pre-focus snapshot values for undo tracking
  const focusValuesRef = useRef<{
    pos: { x: number; y: number; z: number };
    rot: { x: number; y: number; z: number };
  }>({
    pos: { x: 0, y: 0, z: 0 },
    rot: { x: 0, y: 0, z: 0 },
  });

  const handleFocus = (kind: 'pos' | 'rot', axis: 'x' | 'y' | 'z', currentVal: number) => {
    focusValuesRef.current[kind][axis] = currentVal;
  };

  const handleBlur = (kind: 'pos' | 'rot', axis: 'x' | 'y' | 'z', currentVal: number) => {
    const prev = focusValuesRef.current[kind][axis];
    if (prev === currentVal || !stage) return;

    if (activeTab === 'BODY') {
      if (kind === 'pos') {
        stage.controlsManager.commitPositionHistory(axis, prev, currentVal);
      } else {
        stage.controlsManager.commitRotationHistory(axis, prev, currentVal);
      }
    } else if (selectedPart && selectedPart !== 'root') {
      if (kind === 'pos') {
        stage.controlsManager.commitPartPositionHistory(selectedPart, axis, prev, currentVal);
      } else {
        stage.controlsManager.commitPartRotationHistory(selectedPart, axis, prev, currentVal);
      }
    }
  };

  const handlePosChange = (axis: 'x' | 'y' | 'z', valStr: string) => {
    const val = parseFloat(valStr) || 0;
    if (stage) {
      if (activeTab === 'BODY') {
        stage.controlsManager.setRootPosition(axis, val);
      } else if (selectedPart && selectedPart !== 'root') {
        stage.controlsManager.setPartPosition(selectedPart, axis, val);
      }
    }
  };

  const handleRotChange = (axis: 'x' | 'y' | 'z', valStr: string) => {
    const val = parseFloat(valStr) || 0;
    if (stage) {
      if (activeTab === 'BODY') {
        stage.controlsManager.setRootRotation(axis, val);
      } else if (selectedPart && selectedPart !== 'root') {
        stage.controlsManager.setPartRotation(selectedPart, axis, val);
      }
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Left Sidebar (#360403, border-0, shadow-none, scrollable for high zoom) */}
      <aside
        className={`absolute left-0 top-0 bottom-0 z-40 w-[214px] bg-[#360403] transition-transform duration-350 ease-spring flex flex-col justify-between select-none font-['Rethink_Sans'] border-0 shadow-none overflow-y-auto custom-deck-scrollbar ${
          isCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        {/* Top Section */}
        <div className="flex flex-col">
          {/* Top Mode Header Strip with Sliding Pill Indicator */}
          <div className="relative w-full h-[26px] bg-[#730907] p-[3px] flex items-center">
            {/* Sliding Pill Indicator */}
            <div
              className="absolute top-[3px] bottom-[3px] rounded-full bg-[#AE0D0A] transition-transform duration-300 ease-spring pointer-events-none"
              style={{
                width: 'calc((100% - 6px) / 3)',
                left: '3px',
                transform: `translateX(${
                  activeTab === 'BODY' ? '0%' : activeTab === 'POSE' ? '100%' : '200%'
                })`,
              }}
            />

            {/* Segmented Buttons */}
            <button
              type="button"
              onClick={() => handleTabChange('BODY')}
              className={`relative z-10 flex-1 h-full rounded-full font-bold text-[9px] uppercase tracking-wider border-0 shadow-none cursor-pointer transition-colors duration-200 flex items-center justify-center ${
                activeTab === 'BODY' ? 'text-[#F5F5F5]' : 'text-[#F5F5F5]/60 hover:text-white'
              }`}
            >
              BODY
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('POSE')}
              className={`relative z-10 flex-1 h-full rounded-full font-bold text-[9px] uppercase tracking-wider border-0 shadow-none cursor-pointer transition-colors duration-200 flex items-center justify-center ${
                activeTab === 'POSE' ? 'text-[#F5F5F5]' : 'text-[#F5F5F5]/60 hover:text-white'
              }`}
            >
              POSE
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('WORLD')}
              className={`relative z-10 flex-1 h-full rounded-full font-bold text-[9px] uppercase tracking-wider border-0 shadow-none cursor-pointer transition-colors duration-200 flex items-center justify-center ${
                activeTab === 'WORLD' ? 'text-[#F5F5F5]' : 'text-[#F5F5F5]/60 hover:text-white'
              }`}
            >
              WORLD
            </button>
          </div>

          {/* Decomposed Transform Card or World Cards (Camera & Lighting) */}
          {activeTab === 'WORLD' ? (
            <div className="flex flex-col gap-2">
              <CameraCard stage={stage} />
              <LightingCard stage={stage} />
            </div>
          ) : (
            <TransformCard
              activeTab={activeTab}
              selectedPart={selectedPart}
              rootPos={rootPos}
              rootRot={rootRot}
              partPos={partPos}
              partRot={partRot}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onPosChange={handlePosChange}
              onRotChange={handleRotChange}
              activePoseId={activePoseId}
              onPoseSelect={onPoseSelect}
            />
          )}
        </div>

        {/* Bottom Cluster: Settings Button + Action Toolbar */}
        <div className="w-full flex flex-col gap-1.5 pb-2.5">
          {/* Settings Full-Width Trigger */}
          <div className="w-full px-2.5 box-border">
            <button
              ref={settingsBtnRef}
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenSettings({
                  x: Math.round(rect.left + rect.width / 2),
                  y: Math.round(rect.top + rect.height / 2),
                });
              }}
              className="w-full h-[24px] rounded-[12px] bg-[#07050F] hover:bg-[#730907]/60 text-[#F5F5F5] font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition border-0 shadow-none"
            >
              <Settings className="w-3 h-3 text-[#AE0D0A] pointer-events-none" />
              <span className="pointer-events-none select-none">Settings</span>
            </button>
          </div>

          {/* Bottom Bar: Import Skin & Export Button (NO borders, NO inner shadow) */}
          <div className="w-full px-2.5 flex items-center gap-2 overflow-hidden box-border">
            {/* Skin Uploader Pill */}
            {!skinName ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-w-0 h-[24px] rounded-full bg-[#07050F] hover:bg-black/80 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition border-0 shadow-none px-2.5"
              >
                <Upload className="w-3 h-3 shrink-0" />
                <span className="leading-none whitespace-nowrap">Import skin</span>
              </button>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-w-0 h-[24px] px-2.5 rounded-full bg-[#07050F] text-white flex items-center gap-1 cursor-pointer active:scale-95 transition border-0 shadow-none"
              >
                <ImageIcon className="w-3 h-3 text-[#AE0D0A] shrink-0" />
                <span className="text-[10px] font-bold truncate">
                  {skinName}
                </span>
              </div>
            )}

            {/* Export Red Pill Button */}
            <button
              type="button"
              onClick={onOpenExport}
              className="w-[68px] shrink-0 h-[24px] rounded-[12px] bg-[#730907] hover:bg-[#AE0D0A] text-[#F5F5F5] font-semibold text-[11px] flex items-center justify-center cursor-pointer active:scale-95 transition border-0 shadow-none leading-none whitespace-nowrap tracking-tight"
            >
              Export
            </button>
          </div>
        </div>
      </aside>

      {/* Collapse Toggle Tab (Left edge docked when collapsed, border-0, shadow-none) */}
      <button
        type="button"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        className={`absolute top-1/2 -translate-y-1/2 z-50 w-[11px] h-[20px] bg-[#AE0D0A] hover:bg-[#c9120e] rounded-r-md flex items-center justify-center text-white cursor-pointer transition-all duration-350 ease-spring border-0 shadow-none ${
          isCollapsed ? 'left-0' : 'left-[214px]'
        }`}
      >
        <span className="text-[9px] font-bold leading-none select-none">
          {isCollapsed ? '›' : '‹'}
        </span>
      </button>
    </>
  );
}

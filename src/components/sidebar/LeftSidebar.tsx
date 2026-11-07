import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { SceneStage } from '../../engine/render/scene';
import { BodyPartName } from '../../types';
import { TransformCard } from './TransformCard';
import { CameraCard } from './CameraCard';
import type { ReactNode } from 'react';
import { LightingCard } from './LightingCard';
import { EnvironmentCard } from './EnvironmentCard';
import { Upload, Image as ImageIcon, Settings } from 'lucide-react';
import { SMOOTH, SNAPPY, PRESS_DOWN } from '../../utils/motion';

interface LeftSidebarProps {
  stage: SceneStage | null;
  skinName: string | null;
  activePoseId: string | null;
  selectedPart: BodyPartName | null;
  onPoseSelect: (id: string) => void;
  guidesCard?: ReactNode;
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
  guidesCard,
  onOpenExport,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
}: LeftSidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);

  // Tab mode: 'BODY' (whole body transform), 'POSE' (part-wise limb posing), or 'WORLD' (camera/environment)
  const [activeTab, setActiveTab] = useState<'BODY' | 'POSE' | 'WORLD'>('BODY');

  const [rootPos, setRootPos] = useState<[number, number, number]>([0, 0, 0]);
  const [rootRot, setRootRot] = useState<[number, number, number]>([0, 0, 0]);

  const [partPos, setPartPos] = useState<[number, number, number]>([0, 0, 0]);
  const [partRot, setPartRot] = useState<[number, number, number]>([0, 0, 0]);

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

  useEffect(() => {
    if (!stage || !selectedPart || selectedPart === 'root') return;
    const currentPart = stage.controlsManager.getPartTransform(selectedPart);
    setPartPos([...currentPart.position]);
    setPartRot([...currentPart.rotationDeg]);
  }, [stage, selectedPart]);

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
      // EDGE CASE: loadSkinFile rejection on corrupt skin file causes unhandled Promise rejection and blocks re-upload
      await stage.loadSkinFile(file);
    }
  };

  // Scroll affordance: the top fade only shows when there is content hidden above
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [fadeTop, setFadeTop] = useState(false);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 2);
  };

  useEffect(() => {
    const observer = new ResizeObserver(updateFades);
    if (scrollRef.current) observer.observe(scrollRef.current);
    if (contentRef.current) observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  // Run before paint so a tab switch never shows one frame of hard-clipped content
  useLayoutEffect(() => {
    updateFades();
  });

  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    updateFades();
  }, [activeTab]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png"
        className="hidden"
        onChange={handleFileUpload}
      />

      <motion.aside
        animate={{ x: isCollapsed ? -214 : 0 }}
        transition={SMOOTH}
        className="absolute left-0 top-0 bottom-0 z-40 w-[214px] bg-[#360403] flex flex-col select-none font-['Rethink_Sans'] border-0 shadow-none overflow-hidden"
      >
        <div className="relative w-full h-[26px] shrink-0 bg-[#730907] p-[3px] flex items-center">
            <motion.div
              className="absolute top-[3px] bottom-[3px] rounded-full bg-[#AE0D0A] pointer-events-none"
              style={{
                width: 'calc((100% - 6px) / 3)',
                left: '3px',
              }}
              animate={{
                x: activeTab === 'BODY' ? '0%' : activeTab === 'POSE' ? '100%' : '200%',
              }}
              transition={SNAPPY}
            />

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

        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={updateFades}
            className="w-full h-full overflow-y-auto overflow-x-hidden overscroll-contain custom-deck-scrollbar px-2.5"
          >
            <div ref={contentRef} className="flex flex-col gap-2 pt-3.5 pb-2.5">
              {activeTab === 'WORLD' ? (
                <>
                  <EnvironmentCard stage={stage} />
                  <CameraCard stage={stage} />
                  {guidesCard}
                  <LightingCard stage={stage} />
                </>
              ) : (
                <TransformCard
                  activeTab={activeTab}
                  selectedPart={selectedPart}
                  rootPos={rootPos}
                  rootRot={rootRot}
                  partPos={partPos}
                  partRot={partRot}
                  activePoseId={activePoseId}
                  onPoseSelect={onPoseSelect}
                />
              )}
            </div>
          </div>

          <div
            className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-[#360403] to-transparent transition-opacity duration-75 ${
              fadeTop ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        <div className="w-full shrink-0 flex flex-col gap-1.5 pt-2.5 pb-2.5 border-t border-[#730907]/40">
          <div className="w-full px-2.5 box-border">
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={PRESS_DOWN}
              ref={settingsBtnRef}
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onOpenSettings({
                  x: Math.round(rect.left + rect.width / 2),
                  y: Math.round(rect.top + rect.height / 2),
                });
              }}
              className="w-full h-[24px] rounded-[12px] bg-[#07050F] hover:bg-[#730907]/60 text-[#F5F5F5] font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors border-0 shadow-none"
            >
              <Settings className="w-3 h-3 text-[#AE0D0A] pointer-events-none" />
              <span className="pointer-events-none select-none">Settings</span>
            </motion.button>
          </div>

          <div className="w-full px-2.5 flex items-center gap-2 overflow-hidden box-border">
            {!skinName ? (
              <motion.button
                whileTap={{ scale: 0.95 }}
                transition={PRESS_DOWN}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-w-0 h-[24px] rounded-full bg-[#07050F] hover:bg-black/80 text-white font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer transition-colors border-0 shadow-none px-2.5"
              >
                <Upload className="w-3 h-3 shrink-0" />
                <span className="leading-none whitespace-nowrap">Import skin</span>
              </motion.button>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 min-w-0 h-[24px] px-2.5 rounded-full bg-[#07050F] text-white flex items-center gap-1 cursor-pointer transition-colors border-0 shadow-none"
              >
                <ImageIcon className="w-3 h-3 text-[#AE0D0A] shrink-0" />
                <span className="text-[10px] font-bold truncate">
                  {skinName}
                </span>
              </div>
            )}

            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={PRESS_DOWN}
              type="button"
              onClick={onOpenExport}
              className="w-[68px] shrink-0 h-[24px] rounded-[12px] bg-[#730907] hover:bg-[#AE0D0A] text-[#F5F5F5] font-semibold text-[11px] flex items-center justify-center cursor-pointer transition-colors border-0 shadow-none leading-none whitespace-nowrap tracking-tight"
            >
              Export
            </motion.button>
          </div>
        </div>
      </motion.aside>

      <motion.button
        animate={{ left: isCollapsed ? 0 : 214 }}
        transition={SMOOTH}
        whileTap={{ scale: 0.92 }}
        type="button"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Expand panel' : 'Collapse panel'}
        className="absolute top-1/2 -translate-y-1/2 z-50 w-[11px] h-[20px] bg-[#AE0D0A] hover:bg-[#c9120e] rounded-r-md flex items-center justify-center text-white cursor-pointer transition-colors border-0 shadow-none"
      >
        <span className="text-[9px] font-bold leading-none select-none">
          {isCollapsed ? '›' : '‹'}
        </span>
      </motion.button>
    </>
  );
}

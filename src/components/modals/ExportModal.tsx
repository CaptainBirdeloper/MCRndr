import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SceneStage } from '../../engine/render/scene';
import {
  exportSinglePass,
  exportSelectedPasses,
  ExportResolution,
} from '../../engine/render/exporter';
import { ShaderPassMode } from '../../types';
import { X, Check, ChevronDown } from 'lucide-react';
import { SMOOTH, SNAPPY, PRESS_DOWN, PRESS_UP } from '../../utils/motion';

import passBeauty from '../../assets/passes/pass-beauty.png';
import passWem from '../../assets/passes/pass-wem-mask.png';
import passNormal from '../../assets/passes/pass-normal.png';
import passClown from '../../assets/passes/pass-clown-id.png';

interface ExportModalProps {
  stage: SceneStage | null;
  activePass: ShaderPassMode;
  onClose: () => void;
}

interface PassCardConfig {
  id: ShaderPassMode;
  label: string;
  image: string;
}

const PASS_CARDS: PassCardConfig[] = [
  { id: 'beauty', label: 'beauty', image: passBeauty },
  { id: 'wem', label: 'wem', image: passWem },
  { id: 'normal', label: 'normal', image: passNormal },
  { id: 'clown', label: 'clown', image: passClown },
];

export function ExportModal({ stage, activePass, onClose }: ExportModalProps) {
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [selectedPasses, setSelectedPasses] = useState<ShaderPassMode[]>([activePass || 'beauty']);
  const [isCamOpen, setIsCamOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showTick, setShowTick] = useState(false);

  const cameras = stage ? stage.controlsManager.getCameras() : [];
  const initialCamId = stage?.controlsManager.getActiveCameraId() || 'viewport';
  const [selectedCamId, setSelectedCamId] = useState<string>(initialCamId);

  const camContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (camContainerRef.current && !camContainerRef.current.contains(e.target as Node)) {
        setIsCamOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePass = (passId: ShaderPassMode) => {
    setSelectedPasses((prev) => {
      if (prev.includes(passId)) {
        return prev.length > 1 ? prev.filter((p) => p !== passId) : prev;
      }
      return [...prev, passId];
    });
  };

  const getTargetCamera = () => {
    if (!stage || selectedCamId === 'viewport') return null;
    return stage.controlsManager.getCameraById(selectedCamId);
  };

  const runExport = async () => {
    if (!stage || isExporting || selectedPasses.length === 0) return;
    setIsExporting(true);
    try {
      const targetCam = getTargetCamera();
      if (selectedPasses.length === 1) {
        await exportSinglePass(stage, selectedPasses[0], resolution, true, targetCam);
      } else {
        await exportSelectedPasses(stage, selectedPasses, resolution, true, targetCam);
      }
      setShowTick(true);
      setTimeout(() => {
        setShowTick(false);
      }, 1400);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const getCamLabel = () => {
    if (selectedCamId === 'viewport') return 'viewport';
    const found = cameras.find((c) => c.id === selectedCamId);
    return found ? (found.name || found.id).toLowerCase() : selectedCamId.toLowerCase();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SMOOTH}
      className="fixed inset-0 z-50 bg-[#000000] text-[#F5F5F5] w-screen h-screen overflow-hidden flex flex-col justify-between p-8 sm:p-10 select-none font-['Rethink_Sans'] font-bold"
    >
      {/* TOP BAR */}
      <header className="w-full flex items-center justify-between">
        <h1 className="text-sm font-black tracking-[0.22em] uppercase text-white pl-1">
          EXPORT
        </h1>

        <motion.button
          whileTap={{ scale: 0.92 }}
          transition={PRESS_DOWN}
          onClick={onClose}
          title="Close (Esc)"
          className="w-7 h-7 rounded-full bg-[#140303] hover:bg-[#250505] text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border-0 shadow-none"
        >
          <X className="w-3.5 h-3.5" />
        </motion.button>
      </header>

      {/* CENTER: 4 TALL CARDS */}
      <main className="w-full flex-1 flex items-center justify-center my-auto px-2">
        <div className="grid grid-cols-4 gap-6 w-full max-w-6xl h-[calc(100vh-170px)] max-h-[560px]">
          {PASS_CARDS.map((card) => {
            const isSelected = selectedPasses.includes(card.id);
            return (
              <div
                key={card.id}
                onClick={() => togglePass(card.id)}
                className={`relative rounded-[28px] bg-[#000000] border flex flex-col items-center justify-between p-3 pb-5 cursor-pointer select-none transition-colors duration-150 ${
                  isSelected
                    ? 'border-[#360403]'
                    : 'border-[#1b0202] hover:border-[#2d0505] hover:bg-[#080202]'
                }`}
              >
                {/* Preview Frame with Inner Shadow / Selection Outline */}
                <div
                  className={`w-full flex-1 rounded-[22px] flex items-center justify-center overflow-hidden my-auto p-4 transition-colors duration-150 ${
                    isSelected
                      ? 'border border-[#AE0D0A] shadow-[inset_0_0_24px_rgba(174,13,10,0.25)]'
                      : 'border border-transparent'
                  }`}
                >
                  <img
                    src={card.image}
                    alt={`${card.label} pass`}
                    className={`w-full h-full object-contain transition-opacity duration-150 pointer-events-none ${
                      isSelected ? 'opacity-100' : 'opacity-40'
                    }`}
                  />
                </div>

                {/* Flat Pill Badge */}
                <div
                  className={`px-8 py-2 rounded-full text-xs tracking-wide lowercase transition-colors duration-150 border-0 shadow-none ${
                    isSelected
                      ? 'bg-[#730907] text-white'
                      : 'bg-[#360403] text-zinc-400'
                  }`}
                >
                  {card.label}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* BOTTOM BAR: 100% FLAT SOLID ELEMENTS */}
      <footer className="w-full flex items-center justify-between">
        {/* Left: Resolution Pill Segmented Group (Solid Flat) */}
        <div className="relative flex items-center bg-[#360403] rounded-full p-1 border-0 shadow-none">
          <motion.div
            className="absolute top-1 bottom-1 left-1 w-[88px] bg-[#730907] rounded-full pointer-events-none"
            animate={{
              x:
                resolution === '1080p'
                  ? 0
                  : resolution === '2k'
                  ? 88
                  : 176,
            }}
            transition={SNAPPY}
          />
          <button
            onClick={() => setResolution('1080p')}
            className={`relative z-10 w-[88px] py-2 text-center text-xs cursor-pointer transition-colors border-0 shadow-none ${
              resolution === '1080p' ? 'text-white' : 'text-zinc-300 hover:text-white'
            }`}
          >
            1080p
          </button>
          <button
            onClick={() => setResolution('2k')}
            className={`relative z-10 w-[88px] py-2 text-center text-xs cursor-pointer transition-colors border-0 shadow-none ${
              resolution === '2k' ? 'text-white' : 'text-zinc-300 hover:text-white'
            }`}
          >
            2k
          </button>
          <button
            onClick={() => setResolution('4k')}
            className={`relative z-10 w-[88px] py-2 text-center text-xs cursor-pointer transition-colors border-0 shadow-none ${
              resolution === '4k' ? 'text-white' : 'text-zinc-300 hover:text-white'
            }`}
          >
            4k
          </button>
        </div>

        {/* Right: Camera Dropdown & Export Button (Solid Flat) */}
        <div className="flex items-center gap-4">
          <div ref={camContainerRef} className="relative">
            <motion.button
              whileTap={{ scale: 0.96 }}
              transition={PRESS_DOWN}
              onClick={() => setIsCamOpen((prev) => !prev)}
              className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-[#360403] hover:bg-[#4a0604] text-xs text-white transition-colors cursor-pointer border-0 shadow-none"
            >
              <span className="lowercase font-bold">{getCamLabel()}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-300 stroke-[2.5]" />
            </motion.button>

            <AnimatePresence>
              {isCamOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={SNAPPY}
                  className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl bg-[#140303] border border-[#360403] p-1.5 shadow-2xl flex flex-col gap-1 z-30"
                >
                  <button
                    onClick={() => {
                      setSelectedCamId('viewport');
                      setIsCamOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      selectedCamId === 'viewport' ? 'bg-[#730907] text-white' : 'hover:bg-[#730907]/40 text-zinc-300'
                    }`}
                  >
                    viewport
                  </button>
                  {cameras.map((cam) => {
                    const isAct = selectedCamId === cam.id;
                    const label = cam.name ? cam.name.toLowerCase() : cam.id.toLowerCase();
                    return (
                      <button
                        key={cam.id}
                        onClick={() => {
                          setSelectedCamId(cam.id);
                          setIsCamOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                          isAct ? 'bg-[#730907] text-white' : 'hover:bg-[#730907]/40 text-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            transition={PRESS_UP}
            onClick={runExport}
            disabled={isExporting || selectedPasses.length === 0}
            className="min-w-[120px] h-[38px] px-8 rounded-full bg-[#AE0D0A] hover:bg-[#cf100d] text-white text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed border-0 shadow-none"
          >
            {showTick ? (
              <Check className="w-5 h-5 text-white stroke-[3] animate-in zoom-in-75 duration-150" />
            ) : isExporting ? (
              <span className="animate-pulse">...</span>
            ) : (
              <span>EXPORT</span>
            )}
          </motion.button>
        </div>
      </footer>
    </motion.div>
  );
}

export default ExportModal;

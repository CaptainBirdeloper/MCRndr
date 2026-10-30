import { useState } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { exportSinglePass, exportAllPasses, ExportResolution, RESOLUTIONS } from '../../engine/render/exporter';
import { ShaderPassMode } from '../../types';
import { Animate } from '../../utils/motion';
import { Download, Layers, X } from 'lucide-react';

interface ExportModalProps {
  stage: SceneStage | null;
  activePass: ShaderPassMode;
  onClose: () => void;
}

export function ExportModal({ stage, activePass, onClose }: ExportModalProps) {
  const [resolution, setResolution] = useState<ExportResolution>('1080p');
  const [transparent, setTransparent] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const cameras = stage ? stage.controlsManager.getCameras() : [];
  const initialCamId = stage?.controlsManager.getActiveCameraId() || 'viewport';
  const [selectedCamId, setSelectedCamId] = useState<string>(initialCamId);

  const getTargetCamera = () => {
    if (!stage || selectedCamId === 'viewport') return null;
    return stage.controlsManager.getCameraById(selectedCamId);
  };

  const handleSingleExport = async () => {
    if (!stage || isExporting) return;
    setIsExporting(true);
    try {
      await exportSinglePass(stage, activePass, resolution, transparent, getTargetCamera());
    } finally {
      setIsExporting(false);
    }
  };

  const handleAllExport = async () => {
    if (!stage || isExporting) return;
    setIsExporting(true);
    try {
      await exportAllPasses(stage, resolution, transparent, getTargetCamera());
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 transition-opacity duration-200 ease-smooth">
      <Animate
        show={true}
        from={{ opacity: 0, transform: 'scale(0.92) translateY(18px)' }}
        to={{ opacity: 1, transform: 'scale(1) translateY(0px)' }}
        curve="spring"
        duration={300}
        className="w-full max-w-sm"
      >
        <div className="relative w-full bg-[#07050F] border border-[#740907] rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-[#F5F5F5]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-[#740907]/60">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-[#AE0D0A]" />
            <h2 className="text-sm font-bold tracking-wide text-white font-['Rethink_Sans']">
              4K Export Engine
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[#740907] text-zinc-400 hover:text-white transition cursor-pointer active:scale-[0.92] ease-snappy"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Resolution Selector with Sliding Pill */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-['Rethink_Sans']">
            Resolution
          </label>
          <div className="relative grid grid-cols-3 p-1 bg-[#120e24] rounded-xl border border-[#740907]/40">
            {/* Sliding Background Indicator Pill */}
            <div
              className="absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] bg-[#AE0D0A] rounded-lg transition-transform duration-250 ease-spring pointer-events-none"
              style={{
                transform:
                  resolution === '1080p'
                    ? 'translateX(0%)'
                    : resolution === '2k'
                    ? 'translateX(100%)'
                    : 'translateX(200%)',
              }}
            />
            {(Object.keys(RESOLUTIONS) as ExportResolution[]).map((res) => {
              const isActive = resolution === res;
              return (
                <button
                  key={res}
                  onClick={() => setResolution(res)}
                  className={`relative z-10 py-2 px-1 rounded-lg text-xs font-medium transition-all duration-150 ease-spring text-center cursor-pointer select-none active:scale-[0.96] ease-snappy ${
                    isActive ? 'text-[#F5F5F5]' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="font-bold">{res.toUpperCase()}</div>
                  <div className="text-[10px] opacity-80">{RESOLUTIONS[res].width}×{RESOLUTIONS[res].height}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Camera View Selector Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-['Rethink_Sans']">
            Camera View
          </label>
          <div className="relative">
            <select
              value={selectedCamId}
              onChange={(e) => setSelectedCamId(e.target.value)}
              className="w-full py-2.5 px-3 rounded-xl bg-[#120e24] border border-[#740907]/40 text-xs text-[#F5F5F5] font-bold focus:outline-none focus:border-[#AE0D0A] transition cursor-pointer font-['Rethink_Sans'] appearance-none pr-8"
            >
              <option value="viewport" className="bg-[#07050F] text-[#F5F5F5]">
                Current Viewport
              </option>
              {cameras.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#07050F] text-[#F5F5F5]">
                  {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Background Alpha Toggle (iOS-style Animated Switch) */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#120e24] border border-[#740907]/40">
          <span className="text-xs text-zinc-200 font-medium font-['Rethink_Sans']">
            Transparent Alpha Background
          </span>
          <button
            type="button"
            onClick={() => setTransparent(!transparent)}
            className={`w-10 h-6 rounded-full p-1 relative flex items-center transition-colors duration-250 ease-spring cursor-pointer active:scale-[0.92] ease-snappy ${
              transparent ? 'bg-[#AE0D0A]' : 'bg-[#1a1435]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform duration-250 ease-spring shadow-md ${
                transparent ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          <button
            disabled={isExporting}
            onClick={handleAllExport}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#AE0D0A] hover:bg-[#cf100d] text-white font-bold text-xs transition cursor-pointer active:scale-[0.96] active:duration-100 ease-snappy disabled:opacity-50 font-['Rethink_Sans'] ${
              isExporting ? 'animate-pulse' : ''
            }`}
          >
            <Layers className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
            <span>
              {isExporting ? 'Rendering Passes...' : 'Export All 4 Passes (Beauty, WEM, Normal, Clown)'}
            </span>
          </button>

          <button
            disabled={isExporting}
            onClick={handleSingleExport}
            className={`w-full py-2 px-4 rounded-xl bg-[#120e24] hover:bg-[#1a1435] border border-[#740907]/50 text-zinc-300 hover:text-white font-semibold text-xs transition cursor-pointer active:scale-[0.96] active:duration-100 ease-snappy disabled:opacity-50 font-['Rethink_Sans'] ${
              isExporting ? 'animate-pulse' : ''
            }`}
          >
            Export Active Pass Only ({activePass.toUpperCase()})
          </button>
        </div>
      </div>
      </Animate>
    </div>
  );
}

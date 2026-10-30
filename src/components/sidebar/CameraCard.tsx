import { useState, useEffect } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { CameraItem } from '../../types';
import { Camera, Plus, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

interface CameraCardProps {
  stage: SceneStage | null;
}

export function CameraCard({ stage }: CameraCardProps) {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const [selectedCamId, setSelectedCamId] = useState<string | null>(null);

  useEffect(() => {
    if (!stage) return;
    const update = (items: CameraItem[], activeId: string | null) => {
      setCameras([...items]);
      setActiveCameraId(activeId);
      if (activeId) {
        setSelectedCamId(activeId);
      }
    };

    stage.controlsManager.setCameraChangeListener(update);
    const initialCams = stage.controlsManager.getCameras();
    const initialActive = stage.controlsManager.getActiveCameraId();
    setCameras(initialCams);
    setActiveCameraId(initialActive);
    if (initialActive) {
      setSelectedCamId(initialActive);
    } else if (initialCams.length > 0) {
      setSelectedCamId(initialCams[0].id);
    }

    return () => {
      stage.controlsManager.removeCameraChangeListener?.(update);
    };
  }, [stage]);

  if (!stage) return null;

  const activeCam = cameras.find((c) => c.id === (activeCameraId || selectedCamId)) || cameras[0];
  const isViewingCamera = Boolean(activeCameraId && activeCam && activeCameraId === activeCam.id);
  const activeFov = activeCam ? activeCam.fov : 38;

  const handleFovChange = (val: number) => {
    if (!activeCam) return;
    stage.controlsManager.setCameraFov(activeCam.id, val);
    if (activeCameraId !== activeCam.id) {
      stage.controlsManager.selectCamera(activeCam.id);
    }
  };

  const handleSnapToCamera = () => {
    if (activeCam) {
      stage.controlsManager.selectCamera(activeCam.id);
    }
  };

  const handleCyclePrev = () => {
    if (cameras.length <= 1) return;
    const currentId = activeCameraId || selectedCamId;
    const idx = cameras.findIndex((c) => c.id === currentId);
    const prevIdx = idx <= 0 ? cameras.length - 1 : idx - 1;
    stage.controlsManager.selectCamera(cameras[prevIdx].id);
  };

  const handleCycleNext = () => {
    if (cameras.length <= 1) return;
    const currentId = activeCameraId || selectedCamId;
    const idx = cameras.findIndex((c) => c.id === currentId);
    const nextIdx = (idx + 1) % cameras.length;
    stage.controlsManager.selectCamera(cameras[nextIdx].id);
  };

  const handleAddCamera = () => {
    stage.controlsManager.addCamera();
  };

  const FOV_PRESETS = [
    { label: '25°', fov: 25 },
    { label: '45°', fov: 45 },
    { label: '70°', fov: 70 },
    { label: '90°', fov: 90 },
  ];

  return (
    <div className="mx-auto mt-3.5 w-[calc(100%-16px)] min-h-[267px] bg-[#730907]/40 rounded-[9px] overflow-hidden flex flex-col border-0 shadow-none font-['Rethink_Sans']">
      {/* Header Banner - Written exact how TRANSFORM is written */}
      <div className="w-full h-[19px] bg-[#730907] flex items-center justify-center px-2">
        <span className="text-[11px] font-bold text-[#AD0D0A] uppercase tracking-wider truncate">
          CAMERA
        </span>
      </div>

      {cameras.length === 0 ? (
        /* Empty State: No Cameras */
        <div className="flex-1 flex flex-col items-center justify-center p-3 text-center">
          <Camera className="w-6 h-6 text-[#F5F5F5]/30 mb-2" />
          <span className="text-[10px] font-semibold text-[#F5F5F5]/60 mb-3">
            No camera created yet
          </span>
          <button
            type="button"
            onClick={handleAddCamera}
            className="w-full h-[23px] rounded-[12px] bg-[#730907] hover:bg-[#AE0D0A] text-[#F5F5F5] font-semibold text-[10px] flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition border-0 shadow-none"
          >
            <Plus className="w-3 h-3 pointer-events-none" />
            <span className="pointer-events-none select-none">Create Camera</span>
          </button>
        </div>
      ) : (
        /* Active Camera & Controls */
        <div className="p-2 flex flex-col gap-2.5">
          {/* Camera Selector Strip */}
          <div className="w-full h-[26px] bg-[#360403] rounded-[10px] flex items-center justify-between px-1.5 border-0 shadow-none">
            <button
              type="button"
              onClick={handleCyclePrev}
              disabled={cameras.length <= 1}
              title="Previous camera"
              className="w-4 h-4 flex items-center justify-center text-[#F5F5F5]/70 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#F5F5F5] truncate px-1">
              {activeCam ? activeCam.name : 'CAMERA'}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleCycleNext}
                disabled={cameras.length <= 1}
                title="Next camera"
                className="w-4 h-4 flex items-center justify-center text-[#F5F5F5]/70 hover:text-white disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleAddCamera}
                title="Add new camera"
                className="w-4 h-4 rounded-full bg-[#730907] hover:bg-[#AE0D0A] flex items-center justify-center text-white cursor-pointer transition active:scale-90"
              >
                <Plus className="w-2.5 h-2.5 pointer-events-none" />
              </button>
            </div>
          </div>

          {/* Section Header: FOV & View Status */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1 text-[#F5F5F5]/60 text-[9px] font-bold uppercase tracking-wider">
              <SlidersHorizontal className="w-2.5 h-2.5 text-[#AE0D0A]" />
              <span>FOV</span>
            </div>
            <div className="flex items-center gap-1.5">
              {isViewingCamera ? (
                <span className="text-[8px] font-bold uppercase tracking-wider text-[#BAF5F5] bg-[#07050F] px-1.5 py-0.5 rounded leading-none">
                  In View
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSnapToCamera}
                  className="text-[8px] font-bold uppercase tracking-wider text-[#F5F5F5] bg-[#730907] hover:bg-[#AE0D0A] px-1.5 py-0.5 rounded cursor-pointer transition active:scale-95 border-0 shadow-none leading-none"
                  title="Switch viewport into this camera view"
                >
                  View
                </button>
              )}
              <span className="text-[10px] font-bold text-[#AE0D0A] tracking-tight">
                {activeFov}°
              </span>
            </div>
          </div>

          {/* Unified FOV Slider Card */}
          <div className="w-full bg-[#360403] rounded-[15px] p-2.5 flex flex-col gap-2 border-0 shadow-none">
            <div className="flex items-baseline justify-between px-0.5">
              <span className="text-[18px] font-bold text-[#F5F5F5] leading-none tracking-tight">
                {activeFov}
              </span>
              <span className="text-[9px] font-bold text-[#F5F5F5]/40 uppercase tracking-wider">
                DEGREES
              </span>
            </div>

            {/* Custom Range Slider */}
            <input
              type="range"
              min="10"
              max="120"
              step="1"
              value={activeFov}
              onChange={(e) => handleFovChange(Number(e.target.value))}
              className="w-full h-1.5 bg-[#07050F] rounded-full appearance-none cursor-pointer accent-[#AE0D0A] focus:outline-none"
            />

            {/* Preset FOV Pills */}
            <div className="grid grid-cols-4 gap-1 mt-1">
              {FOV_PRESETS.map((p) => (
                <button
                  key={p.fov}
                  type="button"
                  onClick={() => handleFovChange(p.fov)}
                  className={`h-[19px] rounded-[8px] text-[9px] font-bold transition flex items-center justify-center cursor-pointer border-0 shadow-none active:scale-95 ${
                    activeFov === p.fov
                      ? 'bg-[#AE0D0A] text-white'
                      : 'bg-[#07050F] text-[#F5F5F5]/80 hover:text-white hover:bg-black'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

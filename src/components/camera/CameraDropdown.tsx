import { useState, useEffect, useRef } from 'react';
import { SceneStage } from '../../engine/render/scene';
import { CameraItem } from '../../types';

interface CameraDropdownProps {
  stage: SceneStage | null;
}

export function CameraDropdown({ stage }: CameraDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!stage) return;
    const update = (items: CameraItem[], activeId: string | null) => {
      setCameras([...items]);
      setActiveCameraId(activeId);
    };

    stage.controlsManager.setCameraChangeListener(update);
    setCameras(stage.controlsManager.getCameras());
    setActiveCameraId(stage.controlsManager.getActiveCameraId());

    return () => {
      stage.controlsManager.removeCameraChangeListener?.(update);
    };
  }, [stage]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('pointerdown', handleClickOutside);
      return () => window.removeEventListener('pointerdown', handleClickOutside);
    }
  }, [isOpen]);

  if (!stage) return null;

  const hasCameras = cameras.length > 0;
  const activeCam = cameras.find((c) => c.id === activeCameraId);
  const formatCamName = (name: string) => name.replace(/\s+/g, '').toUpperCase();
  const displayName = hasCameras ? (activeCam ? formatCamName(activeCam.name) : 'FREE VIEW') : 'CREATE CAMERA +';

  const handleSelect = (camId: string) => {
    stage.controlsManager.selectCamera(camId);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className="fixed top-3 right-6 z-40 select-none font-['Arial',sans-serif]">
      {/* Closed State Pill (Anti-clipping min-w-auto, exact bg #360403, radius 15px) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            if (!hasCameras) {
              stage.controlsManager.addCamera();
            } else {
              setIsOpen(true);
            }
          }}
          className="min-w-[97px] w-auto h-[22px] px-3 rounded-[15px] bg-[#360403] hover:bg-[#4a0505] flex items-center justify-between gap-2 transition cursor-pointer text-[#BAF5F5] active:scale-95 border-0 shadow-none outline-none whitespace-nowrap"
        >
          <span className="text-[12px] font-bold uppercase tracking-tight leading-none">
            {displayName}
          </span>
          <svg className="w-2.5 h-2.5 text-[#BAF5F5]/80 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
          </svg>
        </button>
      )}

      {/* Expanded State Dropdown (Anti-clipping min-w-auto, vertical rhythm) */}
      {isOpen && (
        <div className="min-w-[105px] w-auto max-h-[140px] overflow-y-auto bg-[#360403] rounded-[8px] p-1 flex flex-col gap-0.5 custom-deck-scrollbar border-0 shadow-none">
          {cameras.map((cam) => {
            const isActive = cam.id === activeCameraId;
            return (
              <button
                key={cam.id}
                type="button"
                onClick={() => handleSelect(cam.id)}
                className={`w-full h-[22px] text-left px-2 text-[13px] font-bold rounded flex items-center transition uppercase tracking-tight cursor-pointer whitespace-nowrap leading-none ${
                  isActive
                    ? 'text-white bg-[#730907]'
                    : 'text-[#BAF5F5] hover:text-white hover:bg-white/5'
                }`}
              >
                {formatCamName(cam.name)}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              stage.controlsManager.addCamera();
              setIsOpen(false);
            }}
            className="w-full h-[20px] text-left px-2 text-[11px] font-bold text-[#AD0D0A] hover:text-white transition uppercase tracking-tight cursor-pointer whitespace-nowrap leading-none mt-1 flex items-center"
          >
            + ADD CAMERA
          </button>
        </div>
      )}
    </div>
  );
}

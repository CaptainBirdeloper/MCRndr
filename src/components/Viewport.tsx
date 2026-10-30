import { useEffect, useRef, useState } from 'react';
import { createScene, SceneStage } from '../engine/render/scene';
import { BodyPartName, ArmType } from '../types';
import { UploadCloud } from 'lucide-react';

interface ViewportProps {
  onStageReady?: (stage: SceneStage) => void;
  onSkinLoaded?: (fileName: string, armType: ArmType) => void;
  onSelectionChange?: (part: BodyPartName | null, rotDeg: [number, number, number]) => void;
}

export function Viewport({ onStageReady, onSkinLoaded, onSelectionChange }: ViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<SceneStage | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Store callbacks in refs to prevent scene destruction on parent re-renders
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const onStageReadyRef = useRef(onStageReady);
  onStageReadyRef.current = onStageReady;

  const onSkinLoadedRef = useRef(onSkinLoaded);
  onSkinLoadedRef.current = onSkinLoaded;

  useEffect(() => {
    if (!containerRef.current) return;
    const stage = createScene(containerRef.current, (part, deg) => {
      onSelectionChangeRef.current?.(part, deg);
    });
    stageRef.current = stage;
    onStageReadyRef.current?.(stage);

    return () => {
      stage.destroy();
      stageRef.current = null;
    };
  }, []); // Run ONCE on mount! Never destroy scene on state updates!

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'image/png' && stageRef.current) {
      const armType = await stageRef.current.loadSkinFile(file);
      onSkinLoadedRef.current?.(file.name, armType);
    }
  };

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full h-full bg-[#07050F] overflow-hidden"
    >
      {/* Viewport Vignette Overlay (pointer-events-none ensures zero click interception) */}
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)] z-10" />

      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-4 z-30 rounded-2xl border-2 border-dashed border-[#AE0D0A] bg-[#740907]/40 backdrop-blur-md flex flex-col items-center justify-center gap-3 pointer-events-none transition-all">
          <UploadCloud className="w-12 h-12 text-[#AE0D0A] animate-bounce" />
          <p className="text-sm font-semibold text-[#F5F5F5] font-['Rethink_Sans']">
            Drop Minecraft Skin (.PNG) to apply
          </p>
        </div>
      )}
    </div>
  );
}

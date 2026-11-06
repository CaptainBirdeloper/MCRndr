import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { SNAPPY } from '../../utils/motion';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  canAdd: boolean;
  onAdd: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 132;
const MENU_HEIGHT = 32;

export function CanvasContextMenu({ x, y, canAdd, onAdd, onClose }: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(y, window.innerHeight - MENU_HEIGHT - 8);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={SNAPPY}
      style={{ left, top, width: MENU_WIDTH }}
      className="fixed z-[70] bg-[#360403] border border-white/10 rounded-[8px] p-1 shadow-2xl select-none"
    >
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => {
          onAdd();
          onClose();
        }}
        className="w-full h-[22px] text-left px-2 rounded-[4px] text-[11px] font-bold uppercase tracking-tight leading-none flex items-center whitespace-nowrap transition-colors cursor-pointer text-[#F5F5F5] hover:bg-[#730907] disabled:opacity-35 disabled:cursor-default"
      >
        + Add Player
      </button>
    </motion.div>
  );
}

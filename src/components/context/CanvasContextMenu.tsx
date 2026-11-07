import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { SNAPPY } from '../../utils/motion';

interface CanvasContextMenuProps {
  x: number;
  y: number;
  canAdd: boolean;
  onAdd: () => void;
  canChangeSkin: boolean;
  onChangeSkin: () => void;
  showThirds: boolean;
  showCenterGuide: boolean;
  onToggleThirds: () => void;
  onToggleCenterGuide: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 156;
const ROW_HEIGHT = 24;
const DIVIDER_HEIGHT = 9;
const MENU_PADDING = 6;

export function CanvasContextMenu({
  x,
  y,
  canAdd,
  onAdd,
  canChangeSkin,
  onChangeSkin,
  showThirds,
  showCenterGuide,
  onToggleThirds,
  onToggleCenterGuide,
  onClose,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    // EDGE CASE: the clamp above is computed once, so a resize can leave the menu off-screen
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  const rows = (canChangeSkin ? 1 : 0) + 1 + 2;
  const height = rows * ROW_HEIGHT + DIVIDER_HEIGHT + MENU_PADDING;
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(y, window.innerHeight - height - 8);

  const rowClass =
    'w-full h-[24px] text-left px-2.5 rounded-[5px] text-[10px] font-bold uppercase tracking-wide leading-none flex items-center gap-2 transition-colors cursor-pointer text-[#F5F5F5] hover:bg-[#730907] disabled:opacity-35 disabled:cursor-default';

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
      {canChangeSkin && (
        <button
          type="button"
          onClick={() => {
            onChangeSkin();
            onClose();
          }}
          className={rowClass}
        >
          Change Skin
        </button>
      )}
      <button
        type="button"
        disabled={!canAdd}
        onClick={() => {
          onAdd();
          onClose();
        }}
        className={rowClass}
      >
        + Add Player
      </button>
      <div className="h-px my-[4px] bg-white/10" />
      {[
        { label: 'Rule of Thirds', active: showThirds, onClick: onToggleThirds },
        { label: 'Center Guide', active: showCenterGuide, onClick: onToggleCenterGuide },
      ].map((guide) => (
        <button
          key={guide.label}
          type="button"
          onClick={guide.onClick}
          aria-pressed={guide.active}
          className={`${rowClass} justify-between`}
        >
          <span className="truncate">{guide.label}</span>
          <span
            className={`w-[6px] h-[6px] rounded-full shrink-0 transition-colors ${
              guide.active ? 'bg-[#AE0D0A]' : 'bg-white/25'
            }`}
          />
        </button>
      ))}
    </motion.div>
  );
}

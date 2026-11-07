import { Grid3x3 } from 'lucide-react';

interface GuidesCardProps {
  showThirds: boolean;
  showCenterGuide: boolean;
  onToggleThirds: () => void;
  onToggleCenterGuide: () => void;
}

export function GuidesCard({
  showThirds,
  showCenterGuide,
  onToggleThirds,
  onToggleCenterGuide,
}: GuidesCardProps) {
  const guides = [
    { label: 'Thirds', active: showThirds, onClick: onToggleThirds },
    { label: 'Center', active: showCenterGuide, onClick: onToggleCenterGuide },
  ];

  return (
    <div className="w-full bg-[#730907]/40 rounded-[9px] overflow-hidden flex flex-col font-['Rethink_Sans'] select-none">
      <div className="w-full h-[19px] bg-[#730907] flex items-center justify-center px-2">
        <span className="text-[11px] font-bold text-[#AD0D0A] uppercase tracking-wider truncate">
          GUIDES
        </span>
      </div>
      <div className="p-2 flex flex-col gap-1">
        <div className="grid grid-cols-2 gap-1">
          {guides.map((guide) => (
            <button
              key={guide.label}
              type="button"
              onClick={guide.onClick}
              aria-pressed={guide.active}
              className={`h-[22px] rounded-[12px] text-[9px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1 cursor-pointer border-0 shadow-none active:scale-95 ${
                guide.active
                  ? 'bg-[#AE0D0A] text-white'
                  : 'bg-[#360403] text-[#F5F5F5]/80 hover:bg-[#4a0505] hover:text-white'
              }`}
            >
              <Grid3x3 className="w-2.5 h-2.5 pointer-events-none opacity-70" />
              <span className="pointer-events-none">{guide.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

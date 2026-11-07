interface ViewportGuidesProps {
  showThirds: boolean;
  showCenter: boolean;
}

const LINE = 'absolute bg-[#F5F5F5]/15';

export function ViewportGuides({ showThirds, showCenter }: ViewportGuidesProps) {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden">
      {showThirds && (
        <>
          <div className={`${LINE} top-0 bottom-0 w-px left-[33.333%]`} />
          <div className={`${LINE} top-0 bottom-0 w-px left-[66.666%]`} />
          <div className={`${LINE} left-0 right-0 h-px top-[33.333%]`} />
          <div className={`${LINE} left-0 right-0 h-px top-[66.666%]`} />
        </>
      )}
      {showCenter && (
        <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[18px] h-px bg-[#F5F5F5]/35" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[18px] w-px bg-[#F5F5F5]/35" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full bg-[#AE0D0A]" />
        </>
      )}
    </div>
  );
}

import React, { useLayoutEffect, useRef, useState } from 'react';

interface AutoFitTextProps {
  children: React.ReactNode;
  className?: string;
  horizontalPadding?: number; // Total padding/margin reserve in px (both sides)
  minScale?: number;
  maxScale?: number;
}

/**
 * AutoFitText ensures text labels never clip or overflow their container button/rect.
 * Measures natural unscaled text width vs container clientWidth and applies CSS transform scale.
 */
export const AutoFitText: React.FC<AutoFitTextProps> = ({
  children,
  className = '',
  horizontalPadding = 6,
  minScale = 0.4,
  maxScale = 1.0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState<number>(1.0);

  useLayoutEffect(() => {
    const updateScale = () => {
      const container = containerRef.current;
      const text = textRef.current;
      if (!container || !text) return;

      const containerWidth = container.clientWidth;
      // Use getBoundingClientRect divided by current scale to get true natural unscaled width
      const naturalTextWidth = scale !== 0 ? text.getBoundingClientRect().width / scale : text.scrollWidth;

      if (containerWidth <= 0 || naturalTextWidth <= 0) return;

      const availableWidth = Math.max(0, containerWidth - horizontalPadding);
      if (naturalTextWidth > availableWidth) {
        const calculatedScale = availableWidth / naturalTextWidth;
        setScale(Math.max(minScale, Math.min(maxScale, calculatedScale)));
      } else {
        setScale(1.0);
      }
    };

    updateScale();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateScale();
      });
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [children, horizontalPadding, minScale, maxScale, scale]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center pointer-events-none ${className}`}
      style={{ overflow: 'visible' }}
    >
      <span
        ref={textRef}
        className="whitespace-nowrap inline-block text-center select-none"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {children}
      </span>
    </div>
  );
};

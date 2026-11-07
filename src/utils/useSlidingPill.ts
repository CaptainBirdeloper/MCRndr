import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export interface PillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Measures the active button inside a `position: relative` container so a single
 * absolute pill can slide to it. Layout coordinates (offsetLeft/offsetTop) are used
 * instead of projection so CSS `zoom` on the app root cannot skew the result.
 */
export function useSlidingPill(activeKey: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonsRef = useRef(new Map<string, HTMLElement>());
  const callbacksRef = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const [pill, setPill] = useState<PillRect | null>(null);

  const register = useCallback((key: string) => {
    let cb = callbacksRef.current.get(key);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if (el) buttonsRef.current.set(key, el);
        else buttonsRef.current.delete(key);
      };
      callbacksRef.current.set(key, cb);
    }
    return cb;
  }, []);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const button = activeKey ? buttonsRef.current.get(activeKey) : undefined;
    if (!container || !button) {
      setPill(null);
      return;
    }
    setPill((prev) => {
      const next = {
        x: button.offsetLeft,
        y: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
      };
      if (
        prev &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height
      ) {
        return prev;
      }
      return next;
    });
  }, [activeKey]);

  useLayoutEffect(() => {
    measure();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    buttonsRef.current.forEach((button) => observer.observe(button));
    return () => observer.disconnect();
  }, [measure]);

  return { containerRef, register, pill };
}

import React, { useMemo } from 'react';

/**
 * Apple-calibrated fluid animation easing curves
 */
export const CURVES = {
  spring: 'cubic-bezier(0.16, 1, 0.3, 1)',    // Apple iOS signature fluid spring
  snappy: 'cubic-bezier(0.25, 1, 0.5, 1)',     // Instant responsive UI tap / toggle
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',      // Continuous layout morphing
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Tactile micro-overshoot bounce
  soft: 'cubic-bezier(0.25, 0.1, 0.25, 1)',    // Gentle fade
} as const;

export type EasingCurve = keyof typeof CURVES;

export interface AnimateProps {
  show?: boolean;
  from: React.CSSProperties;
  to: React.CSSProperties;
  curve?: EasingCurve;
  duration?: number; // milliseconds
  delay?: number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Declarative component for quick starting state -> ending state fluid animations.
 * Example:
 * <Animate
 *   show={isOpen}
 *   from={{ opacity: 0, transform: 'scale(0.92) translateY(12px)' }}
 *   to={{ opacity: 1, transform: 'scale(1) translateY(0px)' }}
 *   curve="spring"
 *   duration={300}
 * >
 *   <MyModal />
 * </Animate>
 */
export function Animate({
  show = true,
  from,
  to,
  curve = 'spring',
  duration = 300,
  delay = 0,
  className = '',
  children,
}: AnimateProps) {
  const currentStyle = useMemo<React.CSSProperties>(() => {
    const targetState = show ? to : from;
    const easing = CURVES[curve] ?? CURVES.spring;
    return {
      ...targetState,
      transition: `all ${duration}ms ${easing} ${delay}ms`,
      willChange: 'transform, opacity',
    };
  }, [show, from, to, curve, duration, delay]);

  return (
    <div style={currentStyle} className={className}>
      {children}
    </div>
  );
}

/**
 * Imperative one-liner for animating any raw HTML element with preset curves.
 * Example:
 * animate(myButton, { transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { curve: 'bounce', duration: 180 });
 */
export function animate(
  element: HTMLElement | null,
  from: Keyframe,
  to: Keyframe,
  options?: {
    curve?: EasingCurve;
    duration?: number;
    delay?: number;
    fill?: FillMode;
  }
): Animation | null {
  if (!element) return null;
  const easing = CURVES[options?.curve ?? 'spring'] ?? CURVES.spring;
  return element.animate([from, to], {
    duration: options?.duration ?? 300,
    delay: options?.delay ?? 0,
    easing,
    fill: options?.fill ?? 'forwards',
  });
}

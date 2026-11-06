import type { Transition } from 'motion/react';

/**
 * Official Apple WWDC Spring Presets calibrated via Motion 14.10.1
 * Every motion = visualDuration + bounce (-1..1, 0 = no overshoot).
 */
export const REDUCED: Transition = { duration: 0.15 };

export const SMOOTH: Transition = {
  type: 'spring',
  visualDuration: 0.5,
  bounce: 0,
};

export const SNAPPY: Transition = {
  type: 'spring',
  visualDuration: 0.5,
  bounce: 0.15,
};

export const BOUNCY: Transition = {
  type: 'spring',
  visualDuration: 0.5,
  bounce: 0.3,
};

export const PRESS_DOWN: Transition = {
  type: 'spring',
  visualDuration: 0.16,
  bounce: 0,
};

export const PRESS_UP: Transition = {
  type: 'spring',
  visualDuration: 0.45,
  bounce: 0.55,
};

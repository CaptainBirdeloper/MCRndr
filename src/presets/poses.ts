import { PosePreset } from '../types';

const DEG = Math.PI / 180;

export const POSE_PRESETS: PosePreset[] = [
  {
    id: 'walking',
    name: 'walking',
    description: 'Natural balanced walking stride',
    rotations: {
      head: [0, 0, 0],
      torso: [2 * DEG, 0, 0],
      rightArm: [-25 * DEG, 0, 0],
      leftArm: [25 * DEG, 0, 0],
      rightLeg: [25 * DEG, 0, 2 * DEG],
      leftLeg: [-25 * DEG, 0, -2 * DEG],
      pelvis: [0, 0, 0],
    },
    rootPosition: [0, 0, 0],
  },
  {
    id: 'running',
    name: 'running',
    description: 'Dynamic sprinting lean with staggered limbs',
    rotations: {
      head: [-15 * DEG, 0, 0],
      torso: [20 * DEG, -10 * DEG, 0],
      rightArm: [-60 * DEG, 10 * DEG, -15 * DEG],
      leftArm: [55 * DEG, -10 * DEG, 15 * DEG],
      rightLeg: [60 * DEG, 0, 5 * DEG],
      leftLeg: [-55 * DEG, 0, -5 * DEG],
      pelvis: [10 * DEG, 0, 0],
    },
    rootPosition: [0, 0, 0],
  },
  {
    id: 'pointing',
    name: 'pointing',
    description: 'Focused direct gesture pointing forward',
    rotations: {
      head: [0, 15 * DEG, 0],
      torso: [0, 10 * DEG, 0],
      rightArm: [-85 * DEG, 15 * DEG, -5 * DEG],
      leftArm: [15 * DEG, -5 * DEG, 10 * DEG],
      rightLeg: [10 * DEG, 0, 5 * DEG],
      leftLeg: [-10 * DEG, 0, -5 * DEG],
      pelvis: [0, 0, 0],
    },
    rootPosition: [0, 0, 0],
  },
  {
    id: 'showcasing',
    name: 'showcasing',
    description: 'Joyful celebration with both arms raised high in the air',
    rotations: {
      head: [0, 0, 0],
      torso: [0, 0, 0],
      rightArm: [-168 * DEG, 0, 22 * DEG],
      leftArm: [-168 * DEG, 0, -22 * DEG],
      rightLeg: [0, 0, 2 * DEG],
      leftLeg: [0, 0, -2 * DEG],
      pelvis: [0, 0, 0],
    },
    rootPosition: [0, 0, 0],
  },
];

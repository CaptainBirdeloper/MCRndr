export type BodyPartName =
  | 'root'
  | 'pelvis'
  | 'torso'
  | 'head'
  | 'rightArm'
  | 'leftArm'
  | 'rightLeg'
  | 'leftLeg';

export const PALETTE = {
  black: '#07050F',
  inferno: '#AE0D0A',
  lava: '#740907',
  plum: '#521451',
  smoke: '#F5F5F5',
} as const;

export type PaletteColor = keyof typeof PALETTE;

export type ShaderPassMode = 'beauty' | 'wem' | 'normal' | 'clown';

export type ArmType = 'steve' | 'alex';

export type TransformMode = 'rotate' | 'translate';

export interface PartEuler {
  x: number;
  y: number;
  z: number;
}

export interface PosePreset {
  id: string;
  name: string;
  description: string;
  rotations: Partial<Record<BodyPartName, [number, number, number]>>;
  rootPosition?: [number, number, number];
}

export interface EngineEvents {
  onSelectPart: (part: BodyPartName | null) => void;
  onTransformChange: (part: BodyPartName, rot: PartEuler, pos: PartEuler) => void;
}

export interface CameraItem {
  id: string;
  name: string;
  visible: boolean;
  fov: number;
}

export type LightType = 'directional' | 'point' | 'spot' | 'ambient';
export type LightingStyle = 'realistic' | 'minecrafty';

export interface LightItem {
  id: string;
  name: string;
  type: LightType;
  visible: boolean;
  intensity: number;
  color: string;
  castShadow: boolean;
}

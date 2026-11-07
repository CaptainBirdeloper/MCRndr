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

export interface PlayerItem {
  id: string;
  name: string;
  skinName: string | null;
  armType: ArmType;
}

export interface CameraItem {
  id: string;
  name: string;
  visible: boolean;
  fov: number;
}

export type LightType = 'directional' | 'point' | 'spot' | 'ambient';

export interface LightShadowSpec {
  enabled: boolean;
  mapSize: 512 | 1024 | 2048;
  bias: number;
  normalBias: number;
  radius: number;
  near: number;
  far: number;
  extent: number;
}

/** Serializable description of a light. Source of truth; THREE objects are derived from it. */
export interface LightSpec {
  id: string;
  name: string;
  type: LightType;
  color: string;
  intensity: number;
  visible: boolean;
  position: [number, number, number];
  target: [number, number, number];
  distance: number;
  decay: number;
  angle: number;
  penumbra: number;
  shadow: LightShadowSpec;
}

export interface LightPreset {
  id: string;
  label: string;
  exposure: number;
  lights: LightSpec[];
}

/** @deprecated superseded by LightSpec; kept so UI code compiles during the P0 migration */
export type LightItem = LightSpec;

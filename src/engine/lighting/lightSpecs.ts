import { LightPreset, LightShadowSpec, LightSpec, LightType } from '../../types';

export const AMBIENT_LIGHT_ID = 'light_ambient';
export const MAX_LIGHTS = 8;
export const MAX_SHADOW_CASTERS = 4;

export const DEFAULT_EXPOSURE = 1.05;

const MAP_SIZES = [512, 1024, 2048] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function numOr(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function vec3Or(value: unknown, fallback: [number, number, number], min: number, max: number): [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return [...fallback];
  const out: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < 3; i++) out[i] = numOr(value[i], fallback[i], min, max);
  return out;
}

export function createShadowSpec(type: LightType): LightShadowSpec {
  if (type === 'ambient') {
    return { enabled: false, mapSize: 512, bias: 0, normalBias: 0, radius: 0, near: 0.5, far: 15, extent: 2.5 };
  }
  if (type === 'point') {
    return { enabled: true, mapSize: 512, bias: -0.005, normalBias: 0.02, radius: 0, near: 0.5, far: 15, extent: 2.5 };
  }
  if (type === 'spot') {
    return { enabled: true, mapSize: 1024, bias: -0.0005, normalBias: 0.02, radius: 0, near: 0.5, far: 15, extent: 2.5 };
  }
  return { enabled: true, mapSize: 2048, bias: -0.0005, normalBias: 0.02, radius: 0, near: 0.5, far: 15, extent: 2.5 };
}

export function sanitizeShadowSpec(raw: unknown, type: LightType): LightShadowSpec {
  const base = createShadowSpec(type);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<LightShadowSpec>;
  const mapSize = MAP_SIZES.includes(r.mapSize as 512) ? (r.mapSize as LightShadowSpec['mapSize']) : base.mapSize;
  return {
    enabled: type === 'ambient' ? false : typeof r.enabled === 'boolean' ? r.enabled : base.enabled,
    mapSize,
    bias: numOr(r.bias, base.bias, -0.05, 0.05),
    normalBias: numOr(r.normalBias, base.normalBias, 0, 0.2),
    radius: numOr(r.radius, base.radius, 0, 12),
    near: numOr(r.near, base.near, 0.05, 10),
    far: numOr(r.far, base.far, 1, 60),
    extent: numOr(r.extent, base.extent, 0.5, 20),
  };
}

export function sanitizeLightSpec(raw: unknown, fallbackId = 'light_directional'): LightSpec {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<LightSpec>;
  const type: LightType =
    r.type === 'point' || r.type === 'spot' || r.type === 'ambient' ? r.type : 'directional';
  const base = createLightSpec(type);
  const id = typeof r.id === 'string' && r.id.length > 0 ? r.id.slice(0, 64) : fallbackId;
  return {
    id,
    name: typeof r.name === 'string' && r.name.length > 0 ? r.name.slice(0, 48) : base.name,
    type,
    color: hexOr(r.color, base.color),
    intensity: numOr(r.intensity, base.intensity, 0, 10),
    visible: typeof r.visible === 'boolean' ? r.visible : true,
    position: vec3Or(r.position, base.position, -50, 50),
    target: vec3Or(r.target, base.target, -50, 50),
    distance: numOr(r.distance, base.distance, 0, 100),
    decay: numOr(r.decay, base.decay, 0, 4),
    angle: numOr(r.angle, base.angle, 0.05, 1.4),
    penumbra: numOr(r.penumbra, base.penumbra, 0, 1),
    shadow: sanitizeShadowSpec(r.shadow, type),
  };
}

/** Validates a persisted rig; always returns at least one spatial light plus exactly one ambient. */
export function sanitizeLightRig(raw: unknown): LightSpec[] {
  const list = Array.isArray(raw) ? raw.slice(0, MAX_LIGHTS) : [];
  const out: LightSpec[] = [];
  const seen = new Set<string>();
  let ambient: LightSpec | null = null;
  for (const item of list) {
    const spec = sanitizeLightSpec(item);
    if (spec.type === 'ambient') {
      if (!ambient) ambient = { ...spec, id: AMBIENT_LIGHT_ID, name: 'Ambient' };
      continue;
    }
    if (seen.has(spec.id)) spec.id = `${spec.id}_${out.length}`;
    seen.add(spec.id);
    out.push(spec);
  }
  if (out.length === 0) out.push(...cloneRig(DEFAULT_LIGHT_RIG.filter((l) => l.type !== 'ambient')));
  if (!ambient) ambient = { ...sanitizeLightSpec({ type: 'ambient', id: AMBIENT_LIGHT_ID, name: 'Ambient' }) };
  out.push(ambient);
  return out;
}

export function cloneSpec(spec: LightSpec): LightSpec {
  return { ...spec, position: [...spec.position], target: [...spec.target], shadow: { ...spec.shadow } };
}

export function cloneRig(specs: LightSpec[]): LightSpec[] {
  return specs.map(cloneSpec);
}

export function createLightSpec(type: LightType, overrides: Partial<LightSpec> = {}): LightSpec {
  const base: LightSpec = {
    id: `light_${type}`,
    name: type === 'ambient' ? 'Ambient' : `${type[0].toUpperCase()}${type.slice(1)} Light`,
    type,
    color: type === 'point' ? '#fff3e0' : '#fff3e0',
    intensity: type === 'ambient' ? 0.45 : type === 'directional' ? 2.2 : 2.0,
    visible: true,
    position: type === 'directional' ? [3, 4, 3] : [1.5, 2.5, 2],
    target: [0, 0.95, 0],
    distance: 10,
    decay: 2,
    angle: 0.6,
    penumbra: 0.3,
    shadow: createShadowSpec(type),
  };
  return { ...base, ...overrides, shadow: { ...base.shadow, ...(overrides.shadow ?? {}) } };
}

export const DEFAULT_LIGHT_RIG: LightSpec[] = [
  createLightSpec('directional', {
    id: 'light_key_light',
    name: 'Key Light',
    color: '#fff3e0',
    intensity: 2.2,
    position: [3, 4, 3],
    shadow: { ...createShadowSpec('directional'), mapSize: 2048 },
  }),
  createLightSpec('directional', {
    id: 'light_fill_light',
    name: 'Fill Light',
    color: '#cfd8dc',
    intensity: 0.9,
    position: [-3, 2, 2],
    shadow: { ...createShadowSpec('directional'), mapSize: 1024 },
  }),
  createLightSpec('directional', {
    id: 'light_rim_light',
    name: 'Rim Light',
    color: '#80d8ff',
    intensity: 2.6,
    position: [0, 3.5, -3.5],
    shadow: { ...createShadowSpec('directional'), mapSize: 1024 },
  }),
  createLightSpec('ambient', { id: AMBIENT_LIGHT_ID, name: 'Ambient', intensity: 0.45 }),
];

function presetLight(
  id: string,
  name: string,
  type: LightType,
  color: string,
  intensity: number,
  position: [number, number, number],
  extra: Partial<LightSpec> = {}
): LightSpec {
  return createLightSpec(type, { id, name, color, intensity, position, ...extra });
}

const AMBIENT = (intensity: number): LightSpec =>
  createLightSpec('ambient', { id: AMBIENT_LIGHT_ID, name: 'Ambient', intensity });

export const LIGHT_PRESETS: LightPreset[] = [
  {
    id: 'studio-3pt',
    label: '3-Pt',
    exposure: DEFAULT_EXPOSURE,
    lights: cloneRig(DEFAULT_LIGHT_RIG),
  },
  {
    id: 'soft-key',
    label: 'Soft',
    exposure: 1.15,
    lights: [
      presetLight('light_key_light', 'Key Light', 'directional', '#fff3e0', 1.6, [2.5, 3.5, 3.5], {
        shadow: { ...createShadowSpec('directional'), mapSize: 2048, radius: 6, extent: 3 },
      }),
      presetLight('light_fill_light', 'Fill Light', 'directional', '#e0e6ea', 0.7, [-3, 2, 2.5]),
      presetLight('light_rim_light', 'Rim Light', 'directional', '#80d8ff', 1.2, [0, 3.5, -3.5]),
      AMBIENT(0.55),
    ],
  },
  {
    id: 'rim-only',
    label: 'Rim',
    exposure: 1.0,
    lights: [
      presetLight('light_rim_light', 'Rim Light', 'directional', '#80d8ff', 3.2, [0, 3.5, -3.5], {
        shadow: { ...createShadowSpec('directional'), mapSize: 1024 },
      }),
      AMBIENT(0.3),
    ],
  },
  {
    id: 'outdoor-sun',
    label: 'Sun',
    exposure: 1.2,
    lights: [
      presetLight('light_key_light', 'Sun', 'directional', '#fff1d0', 3.4, [4, 6, 2], {
        shadow: { ...createShadowSpec('directional'), mapSize: 2048, extent: 4 },
      }),
      presetLight('light_fill_light', 'Sky Fill', 'directional', '#a8c8ff', 0.5, [-2, 1.5, 3]),
      AMBIENT(0.5),
    ],
  },
  {
    id: 'flat',
    label: 'Flat',
    exposure: 1.0,
    lights: [
      presetLight('light_key_light', 'Key Light', 'directional', '#ffffff', 1.4, [2, 3, 3], {
        shadow: { ...createShadowSpec('directional'), enabled: false },
      }),
      AMBIENT(1.1),
    ],
  },
];

export function getPreset(id: string): LightPreset | undefined {
  return LIGHT_PRESETS.find((p) => p.id === id);
}

import * as THREE from 'three';
import { LightPreset, LightSpec, LightType } from '../../types';
import { LightGlyph, createLightGlyph, setGlyphColor, updateLightGlyph } from './lightGlyphs';
import {
  AMBIENT_LIGHT_ID,
  DEFAULT_EXPOSURE,
  LIGHT_PRESETS,
  MAX_LIGHTS,
  MAX_SHADOW_CASTERS,
  cloneRig,
  cloneSpec,
  createLightSpec,
  getPreset,
  sanitizeLightRig,
  sanitizeLightSpec,
} from './lightSpecs';
import { loadSettings, saveSettings } from '../../utils/settings';

export interface ManagedLight {
  spec: LightSpec;
  object: THREE.Light;
  group: THREE.Group;
  glyph: LightGlyph;
}

export interface LightingManagerOptions {
  initialRig?: unknown;
  exposure?: number;
  presetId?: string | null;
  onExposure?: (exposure: number) => void;
  onShadowMode?: (mode: 'soft' | 'basic') => void;
  persist?: boolean;
}

export interface LightingManager {
  getLights: () => LightSpec[];
  getSpecs: () => LightSpec[];
  getAmbient: () => LightSpec;
  getPresets: () => LightPreset[];
  getExposure: () => number;
  setExposure: (exposure: number) => void;
  getActivePresetId: () => string | null;
  addLight: (type: LightType, init?: Partial<LightSpec>) => string | null;
  duplicateLight: (id: string) => string | null;
  removeLight: (id: string) => void;
  updateLight: (id: string, patch: Partial<LightSpec>) => void;
  applyRig: (rig: unknown) => void;
  applyPreset: (presetId: string) => void;
  getActiveLightId: () => string | null;
  selectLight: (id: string | null) => void;
  setLightIntensity: (id: string, intensity: number) => void;
  setLightColor: (id: string, hexColor: string) => void;
  toggleLightShadow: (id: string) => void;
  toggleLightVisibility: (id: string) => void;
  updateGlyphVisuals: (camera: THREE.Camera) => void;
  getRaycastTargets: () => THREE.Object3D[];
  getLightGroupById: (id: string) => THREE.Group | null;
  getGlyphs: () => THREE.Object3D[];
  getLightScreenPosition: (
    id: string,
    camera: THREE.Camera,
    width: number,
    height: number
  ) => { x: number; y: number; visible: boolean } | null;
  setChangeListener: (cb: (lights: LightSpec[], activeId: string | null) => void) => void;
  setSelectionListener: (cb: (activeId: string | null) => void) => void;
  destroy: () => void;
}

function disposeGroup(group: THREE.Group): void {
  group.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material?.dispose();
  });
}

export function createLightingManager(
  scene: THREE.Scene,
  options: LightingManagerOptions = {}
): LightingManager {
  const persistEnabled = options.persist !== false;
  const spatial: ManagedLight[] = [];
  let ambientSpec = createLightSpec('ambient', { id: AMBIENT_LIGHT_ID, name: 'Ambient', intensity: 0.45 });
  const ambientObject = new THREE.AmbientLight(0xffffff, ambientSpec.intensity);
  scene.add(ambientObject);

  let activeLightId: string | null = null;
  let presetId: string | null = options.presetId ?? null;
  let exposure = Math.min(3, Math.max(0.3, options.exposure ?? DEFAULT_EXPOSURE));
  let onChangeCb: ((lights: LightSpec[], activeId: string | null) => void) | null = null;
  let onSelectionCb: ((activeId: string | null) => void) | null = null;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let lastShadowMode: 'soft' | 'basic' | null = null;

  function applyExposure(value: number) {
    exposure = Math.min(3, Math.max(0.3, value));
    options.onExposure?.(exposure);
  }

  function schedulePersist() {
    if (!persistEnabled) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      const current = loadSettings();
      saveSettings({ ...current, lightRig: getSpecs(), lightingPresetId: presetId, exposure });
    }, 250);
  }

  function updateGlyphHighlights() {
    spatial.forEach((m) => {
      setGlyphColor(m.glyph, m.spec.id === activeLightId ? '#ae0d0a' : m.spec.color);
    });
  }

  function notifyChange() {
    updateGlyphHighlights();
    const shadowMode: 'soft' | 'basic' = spatial.some(
      (m) => m.spec.shadow.enabled && m.spec.shadow.radius > 0
    )
      ? 'basic'
      : 'soft';
    if (shadowMode !== lastShadowMode) {
      lastShadowMode = shadowMode;
      options.onShadowMode?.(shadowMode);
    }
    schedulePersist();
    onChangeCb?.(getSpecs(), activeLightId);
  }

  function targetLocal(group: THREE.Object3D, spec: LightSpec): THREE.Vector3 {
    return new THREE.Vector3(
      spec.target[0] - spec.position[0],
      spec.target[1] - spec.position[1],
      spec.target[2] - spec.position[2]
    ).applyQuaternion(group.quaternion.clone().invert());
  }

  function applyShadow(light: THREE.Light, spec: LightSpec) {
    const s = spec.shadow;
    light.castShadow = s.enabled;
    if (!s.enabled) return;
    const shadow = light.shadow;
    if (!shadow) return;
    if (shadow.mapSize.width !== s.mapSize) {
      shadow.map?.dispose();
      shadow.map = null;
      shadow.mapSize.set(s.mapSize, s.mapSize);
    }
    shadow.bias = s.bias;
    shadow.normalBias = s.normalBias;
    shadow.radius = s.radius;
    if (shadow.camera instanceof THREE.OrthographicCamera || shadow.camera instanceof THREE.PerspectiveCamera) {
      shadow.camera.near = s.near;
      shadow.camera.far = s.far;
      shadow.camera.updateProjectionMatrix();
    }
    if (light instanceof THREE.DirectionalLight) {
      const cam = shadow.camera as THREE.OrthographicCamera;
      cam.left = -s.extent;
      cam.right = s.extent;
      cam.top = s.extent;
      cam.bottom = -s.extent;
      cam.updateProjectionMatrix();
    }
  }

  function sync(m: ManagedLight) {
    const spec = m.spec;
    m.group.position.set(...spec.position);
    m.group.visible = spec.visible;
    m.object.color.set(spec.color);
    m.object.intensity = spec.intensity;

    if (m.object instanceof THREE.DirectionalLight) {
      m.object.target.position.copy(targetLocal(m.group, spec));
      m.object.target.updateMatrixWorld();
    } else if (m.object instanceof THREE.PointLight) {
      m.object.distance = spec.distance;
      m.object.decay = spec.decay;
    } else if (m.object instanceof THREE.SpotLight) {
      m.object.distance = spec.distance;
      m.object.decay = spec.decay;
      m.object.angle = spec.angle;
      m.object.penumbra = spec.penumbra;
      m.object.target.position.copy(targetLocal(m.group, spec));
      m.object.target.updateMatrixWorld();
    }
    applyShadow(m.object, spec);
    setGlyphColor(m.glyph, spec.id === activeLightId ? '#ae0d0a' : spec.color);
  }

  function createSpatial(spec: LightSpec): ManagedLight {
    const group = new THREE.Group();
    group.name = `light_group_${spec.id}`;
    group.position.set(...spec.position);
    group.visible = spec.visible;

    let object: THREE.Light;
    if (spec.type === 'directional') {
      const dir = new THREE.DirectionalLight(spec.color, spec.intensity);
      dir.target.position.copy(targetLocal(group, spec));
      group.add(dir.target);
      object = dir;
    } else if (spec.type === 'spot') {
      const spot = new THREE.SpotLight(
        spec.color,
        spec.intensity,
        spec.distance,
        spec.angle,
        spec.penumbra,
        spec.decay
      );
      spot.target.position.copy(targetLocal(group, spec));
      group.add(spot.target);
      object = spot;
    } else {
      object = new THREE.PointLight(spec.color, spec.intensity, spec.distance, spec.decay);
    }
    group.add(object);

    const glyph = createLightGlyph(spec.type, spec.color);
    glyph.traverse((child) => {
      if (child.userData.isLight) child.userData.lightId = spec.id;
    });
    group.add(glyph);

    scene.add(group);
    const managed: ManagedLight = { spec, object, group, glyph };
    applyShadow(object, spec);
    return managed;
  }

  function disposeSpatial(m: ManagedLight) {
    scene.remove(m.group);
    m.object.dispose();
    m.object.shadow?.map?.dispose();
    disposeGroup(m.group);
  }

  function syncAmbient() {
    ambientObject.intensity = ambientSpec.intensity;
    ambientObject.color.set(ambientSpec.color);
    ambientObject.visible = ambientSpec.visible;
  }

  function refreshSpatialSpecs() {
    spatial.forEach((m) => {
      m.spec.position = [m.group.position.x, m.group.position.y, m.group.position.z];
      if (m.object instanceof THREE.DirectionalLight || m.object instanceof THREE.SpotLight) {
        const world = new THREE.Vector3();
        m.object.target.getWorldPosition(world);
        m.spec.target = [world.x, world.y, world.z];
      }
    });
  }

  function getSpecs(): LightSpec[] {
    refreshSpatialSpecs();
    return [...spatial.map((m) => cloneSpec(m.spec)), cloneSpec(ambientSpec)];
  }

  function uniqueId(type: LightType): string {
    let n = 1;
    while (spatial.some((m) => m.spec.id === `light_${type}_${n}`)) n++;
    return `light_${type}_${n}`;
  }

  function nextName(type: LightType): string {
    const label = `${type[0].toUpperCase()}${type.slice(1)} Light`;
    const count = spatial.filter((m) => m.spec.type === type).length;
    return count === 0 ? label : `${label} ${count + 1}`;
  }

  function shadowCasterCount(): number {
    return spatial.filter((m) => m.spec.shadow.enabled).length;
  }

  function selectLight(id: string | null) {
    // Re-selecting the same light must still re-emit selection: the click path clears
    // the rig gizmo first, so an early return would leave it permanently detached.
    if (activeLightId === id) {
      onSelectionCb?.(id);
      return;
    }
    activeLightId = id;
    notifyChange();
    onSelectionCb?.(id);
  }

  function updateLight(id: string, patch: Partial<LightSpec>) {
    if (id === AMBIENT_LIGHT_ID) {
      const merged = sanitizeLightSpec({ ...ambientSpec, ...patch, type: 'ambient' }, AMBIENT_LIGHT_ID);
      merged.id = AMBIENT_LIGHT_ID;
      ambientSpec = merged;
      syncAmbient();
      notifyChange();
      return;
    }
    const m = spatial.find((item) => item.spec.id === id);
    if (!m) return;
    if (patch.type === 'ambient') return;
    const merged = sanitizeLightSpec({ ...m.spec, ...patch, id }, id);
    presetId = null;
    if (merged.type !== m.spec.type) {
      const index = spatial.indexOf(m);
      const wasActive = activeLightId === id;
      disposeSpatial(m);
      const fresh = createSpatial(merged);
      spatial[index] = fresh;
      if (wasActive) activeLightId = id;
      notifyChange();
      return;
    }
    m.spec = merged;
    sync(m);
    notifyChange();
  }

  function addLight(type: LightType, init: Partial<LightSpec> = {}): string | null {
    if (type === 'ambient') return null;
    if (spatial.length >= MAX_LIGHTS) return null;
    const id = uniqueId(type);
    const spec = sanitizeLightSpec(
      { ...createLightSpec(type, { id, name: nextName(type) }), ...init, id, type },
      id
    );
    if (spec.shadow.enabled && shadowCasterCount() >= MAX_SHADOW_CASTERS) spec.shadow.enabled = false;
    spatial.push(createSpatial(spec));
    presetId = null;
    notifyChange();
    return id;
  }

  function duplicateLight(id: string): string | null {
    const source = spatial.find((m) => m.spec.id === id);
    if (!source || spatial.length >= MAX_LIGHTS) return null;
    const copy = cloneSpec(source.spec);
    copy.id = uniqueId(copy.type);
    copy.name = `${source.spec.name} Copy`;
    copy.position = [copy.position[0] + 0.6, copy.position[1], copy.position[2]];
    copy.target = [copy.target[0] + 0.6, copy.target[1], copy.target[2]];
    if (copy.shadow.enabled && shadowCasterCount() >= MAX_SHADOW_CASTERS) copy.shadow.enabled = false;
    spatial.push(createSpatial(copy));
    presetId = null;
    notifyChange();
    return copy.id;
  }

  function removeLight(id: string) {
    if (id === AMBIENT_LIGHT_ID) return;
    const index = spatial.findIndex((m) => m.spec.id === id);
    if (index < 0) return;
    disposeSpatial(spatial[index]);
    spatial.splice(index, 1);
    if (activeLightId === id) {
      activeLightId = null;
      onSelectionCb?.(null);
    }
    presetId = null;
    notifyChange();
  }

  function applyRig(rig: unknown) {
    spatial.slice().forEach(disposeSpatial);
    spatial.length = 0;
    const specs = sanitizeLightRig(rig);
    specs.forEach((spec) => {
      if (spec.type === 'ambient') {
        ambientSpec = { ...spec, id: AMBIENT_LIGHT_ID };
        return;
      }
      spatial.push(createSpatial(spec));
    });
    syncAmbient();
    if (activeLightId && !spatial.some((m) => m.spec.id === activeLightId)) {
      activeLightId = null;
      onSelectionCb?.(null);
    }
    notifyChange();
  }

  function setExposure(value: number) {
    if (value === exposure) return;
    applyExposure(value);
    presetId = null;
    notifyChange();
  }

  function applyPreset(nextPresetId: string) {
    const preset = getPreset(nextPresetId);
    if (!preset) return;
    presetId = preset.id;
    applyExposure(preset.exposure);
    applyRig(cloneRig(preset.lights));
  }

  function getLightScreenPosition(
    id: string,
    camera: THREE.Camera,
    width: number,
    height: number
  ): { x: number; y: number; visible: boolean } | null {
    const m = spatial.find((item) => item.spec.id === id);
    if (!m || !m.spec.visible) return null;
    const worldPos = new THREE.Vector3();
    m.group.getWorldPosition(worldPos);

    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const toLight = worldPos.clone().sub(camera.position);
    if (camDir.dot(toLight) <= 0) {
      return { x: 0, y: 0, visible: false };
    }

    const proj = worldPos.clone().project(camera);
    if (proj.z > 1) {
      return { x: 0, y: 0, visible: false };
    }

    const rawX = ((proj.x + 1) * width) / 2;
    const rawY = ((-proj.y + 1) * height) / 2;

    // EDGE CASE: viewport width < 438 or height < 220 inverts clamp bounds, pinning modal position off-screen
    const clampedX = Math.max(228, Math.min(width - 210, rawX + 32));
    const clampedY = Math.max(40, Math.min(height - 180, rawY - 24));

    return { x: Math.round(clampedX), y: Math.round(clampedY), visible: true };
  }

  const glyphWorldPos = new THREE.Vector3();
  const glyphDir = new THREE.Vector3();
  function updateGlyphVisuals(camera: THREE.Camera) {
    spatial.forEach((m) => {
      if (!m.spec.visible) return;
      m.group.getWorldPosition(glyphWorldPos);
      if (m.object instanceof THREE.DirectionalLight || m.object instanceof THREE.SpotLight) {
        glyphDir.copy(m.object.target.position);
      } else {
        glyphDir.set(
          m.spec.target[0] - m.spec.position[0],
          m.spec.target[1] - m.spec.position[1],
          m.spec.target[2] - m.spec.position[2]
        );
      }
      updateLightGlyph(
        m.glyph,
        m.spec,
        camera.position.distanceTo(glyphWorldPos),
        m.spec.id === activeLightId,
        glyphDir
      );
    });
  }

  function getRaycastTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = [];
    spatial.forEach((m) => {
      if (!m.spec.visible) return;
      const isActive = m.spec.id === activeLightId;
      m.glyph.traverse((child) => {
        if (!child.userData.isLight) return;
        const handle = child.userData.lightHandle as string | undefined;
        // Raycaster ignores parent visibility, so the detail handles must be
        // filtered explicitly or inactive lights would still be grabbable.
        if (handle && handle !== 'body') {
          if (!isActive || !m.glyph.detail.visible || !child.visible) return;
        }
        targets.push(child);
      });
    });
    return targets;
  }

  function destroy() {
    if (persistTimer) clearTimeout(persistTimer);
    spatial.slice().forEach(disposeSpatial);
    spatial.length = 0;
    scene.remove(ambientObject);
    ambientObject.dispose();
  }

  if (options.initialRig) {
    applyRig(options.initialRig);
  } else if (presetId) {
    applyPreset(presetId);
  } else {
    applyRig(null);
  }
  applyExposure(options.exposure ?? DEFAULT_EXPOSURE);

  return {
    getLights: getSpecs,
    getSpecs,
    getAmbient: () => cloneSpec(ambientSpec),
    getPresets: () => LIGHT_PRESETS,
    getExposure: () => exposure,
    setExposure,
    getActivePresetId: () => presetId,
    addLight,
    duplicateLight,
    removeLight,
    updateLight,
    applyRig,
    applyPreset,
    getActiveLightId: () => activeLightId,
    selectLight,
    setLightIntensity: (id, intensity) => updateLight(id, { intensity }),
    setLightColor: (id, hexColor) => updateLight(id, { color: hexColor }),
    toggleLightShadow: (id) => {
      const m = spatial.find((item) => item.spec.id === id);
      if (m) updateLight(id, { shadow: { ...m.spec.shadow, enabled: !m.spec.shadow.enabled } });
    },
    toggleLightVisibility: (id) => {
      const m = id === AMBIENT_LIGHT_ID ? null : spatial.find((item) => item.spec.id === id);
      const visible = m ? !m.spec.visible : !ambientSpec.visible;
      updateLight(id, { visible });
    },
    updateGlyphVisuals,
    getRaycastTargets,
    getLightGroupById: (id: string) => spatial.find((m) => m.spec.id === id)?.group ?? null,
    getGlyphs: () => spatial.map((m) => m.glyph),
    getLightScreenPosition,
    setChangeListener: (cb) => {
      onChangeCb = cb;
      notifyChange();
    },
    setSelectionListener: (cb) => {
      onSelectionCb = cb;
    },
    destroy,
  };
}

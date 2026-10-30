import * as THREE from 'three';
import { LightItem, LightType, LightingStyle } from '../../types';
import { createLightGlyph } from './lightGlyphs';
import { applyLightingStyle } from './lightingStyles';

export interface ManagedLight {
  id: string;
  name: string;
  type: LightType;
  light: THREE.Light;
  group: THREE.Group;
  glyph: THREE.Group;
  visible: boolean;
  intensity: number;
  color: string;
  castShadow: boolean;
}

export interface LightingManager {
  getLights: () => LightItem[];
  getActiveLightId: () => string | null;
  selectLight: (id: string | null) => void;
  setLightIntensity: (id: string, intensity: number) => void;
  setLightColor: (id: string, hexColor: string) => void;
  toggleLightShadow: (id: string) => void;
  toggleLightVisibility: (id: string) => void;
  getStyle: () => LightingStyle;
  setStyle: (style: LightingStyle) => void;
  getRaycastTargets: () => THREE.Object3D[];
  getLightGroupById: (id: string) => THREE.Group | null;
  getGlyphs: () => THREE.Object3D[];
  getLightScreenPosition: (
    id: string,
    camera: THREE.Camera,
    width: number,
    height: number
  ) => { x: number; y: number; visible: boolean } | null;
  setChangeListener: (cb: (lights: LightItem[], activeId: string | null) => void) => void;
  setSelectionListener: (cb: (activeId: string | null) => void) => void;
  destroy: () => void;
}

export function createLightingManager(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer
): LightingManager {
  const lights: ManagedLight[] = [];
  let activeLightId: string | null = null;
  let currentStyle: LightingStyle = 'realistic';
  let onChangeCb: ((lights: LightItem[], activeId: string | null) => void) | null = null;
  let onSelectionCb: ((activeId: string | null) => void) | null = null;

  function updateGlyphHighlights() {
    lights.forEach((l) => {
      const isSelected = l.id === activeLightId;
      l.glyph.traverse((child) => {
        if ((child as THREE.Line).isLine || (child as THREE.LineSegments).isLineSegments) {
          const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
          if (mat) {
            mat.color.setHex(isSelected ? 0xae0d0a : parseInt(l.color.replace('#', '0x'), 16) || 0xfff3e0);
            mat.needsUpdate = true;
          }
        }
      });
    });
  }

  function notifyChange() {
    updateGlyphHighlights();
    if (onChangeCb) {
      const items: LightItem[] = lights.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        visible: l.visible,
        intensity: l.intensity,
        color: l.color,
        castShadow: l.castShadow,
      }));
      onChangeCb(items, activeLightId);
    }
  }

  function addInitialLight(
    name: string,
    type: LightType,
    colorHex: number,
    intensity: number,
    pos: [number, number, number],
    castShadow = false
  ) {
    const id = `light_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const group = new THREE.Group();
    group.name = `light_group_${id}`;
    group.position.set(...pos);

    let light: THREE.Light;
    if (type === 'directional') {
      const dirLight = new THREE.DirectionalLight(colorHex, intensity);
      if (castShadow) {
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 15;
        dirLight.shadow.bias = -0.0005;
        const d = 2.5;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
      }
      light = dirLight;
    } else {
      light = new THREE.PointLight(colorHex, intensity, 10, 2);
    }

    group.add(light);
    const glyph = createLightGlyph(type, colorHex);
    // Mark hit mesh with lightId
    glyph.traverse((child) => {
      if (child.userData.isLight) {
        child.userData.lightId = id;
      }
    });
    group.add(glyph);
    scene.add(group);

    const managed: ManagedLight = {
      id,
      name,
      type,
      light,
      group,
      glyph,
      visible: true,
      intensity,
      color: `#${colorHex.toString(16).padStart(6, '0')}`,
      castShadow,
    };
    lights.push(managed);
  }

  // Initial Studio 3-Point Lights
  addInitialLight('Key Light', 'directional', 0xfff3e0, 2.2, [3, 4, 3], true);
  addInitialLight('Fill Light', 'directional', 0xcfd8dc, 0.9, [-3, 2, 2], false);
  addInitialLight('Rim Light', 'directional', 0x80d8ff, 2.6, [0, 3.5, -3.5], false);

  // Studio Ambient
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambient);

  function selectLight(id: string | null) {
    if (activeLightId === id) return;
    activeLightId = id;
    notifyChange();
    onSelectionCb?.(id);
  }

  function getLightScreenPosition(
    id: string,
    camera: THREE.Camera,
    width: number,
    height: number
  ): { x: number; y: number; visible: boolean } | null {
    const l = lights.find((item) => item.id === id);
    if (!l || !l.visible) return null;
    const worldPos = new THREE.Vector3();
    l.group.getWorldPosition(worldPos);

    // Behind camera check
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

    const clampedX = Math.max(228, Math.min(width - 210, rawX + 32));
    const clampedY = Math.max(40, Math.min(height - 180, rawY - 24));

    return { x: Math.round(clampedX), y: Math.round(clampedY), visible: true };
  }

  function setLightIntensity(id: string, intensity: number) {
    const l = lights.find((item) => item.id === id);
    if (l) {
      l.intensity = intensity;
      l.light.intensity = intensity;
      notifyChange();
    }
  }

  function setLightColor(id: string, hexColor: string) {
    const l = lights.find((item) => item.id === id);
    if (l) {
      l.color = hexColor;
      l.light.color.set(hexColor);
      notifyChange();
    }
  }

  function toggleLightShadow(id: string) {
    const l = lights.find((item) => item.id === id);
    if (l && l.light instanceof THREE.DirectionalLight) {
      l.castShadow = !l.castShadow;
      l.light.castShadow = l.castShadow;
      notifyChange();
    }
  }

  function toggleLightVisibility(id: string) {
    const l = lights.find((item) => item.id === id);
    if (l) {
      l.visible = !l.visible;
      l.group.visible = l.visible;
      notifyChange();
    }
  }

  function setStyle(style: LightingStyle) {
    currentStyle = style;
    applyLightingStyle(renderer, style);
    notifyChange();
  }

  function getRaycastTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = [];
    lights.forEach((l) => {
      if (l.visible) {
        l.glyph.traverse((child) => {
          if (child.userData.isLight) {
            targets.push(child);
          }
        });
      }
    });
    return targets;
  }

  function destroy() {
    lights.forEach((l) => {
      scene.remove(l.group);
    });
    scene.remove(ambient);
  }

  return {
    getLights: () =>
      lights.map((l) => ({
        id: l.id,
        name: l.name,
        type: l.type,
        visible: l.visible,
        intensity: l.intensity,
        color: l.color,
        castShadow: l.castShadow,
      })),
    getActiveLightId: () => activeLightId,
    selectLight,
    setLightIntensity,
    setLightColor,
    toggleLightShadow,
    toggleLightVisibility,
    getStyle: () => currentStyle,
    setStyle,
    getRaycastTargets,
    getLightGroupById: (id: string) => lights.find((l) => l.id === id)?.group || null,
    getGlyphs: () => lights.map((l) => l.glyph),
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

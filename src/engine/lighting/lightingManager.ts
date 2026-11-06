import * as THREE from 'three';
import { LightItem, LightType } from '../../types';
import { createLightGlyph } from './lightGlyphs';

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
  updateGlyphScale: (camera: THREE.Camera) => void;
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

export function createLightingManager(scene: THREE.Scene): LightingManager {
  const lights: ManagedLight[] = [];
  let activeLightId: string | null = null;
  let onChangeCb: ((lights: LightItem[], activeId: string | null) => void) | null = null;
  let onSelectionCb: ((activeId: string | null) => void) | null = null;

  function updateGlyphHighlights() {
    lights.forEach((l) => {
      const isSelected = l.id === activeLightId;
      l.glyph.traverse((child) => {
        if ((child as THREE.Line).isLine || (child as THREE.LineSegments).isLineSegments) {
          const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
          if (mat) {
            // EDGE CASE: l.color being undefined or null will throw TypeError on .replace()
            mat.color.setHex(isSelected ? 0xae0d0a : parseInt(l.color.replace('#', '0x'), 16) || 0xfff3e0);
            mat.needsUpdate = true;
          }
        }
      });
    });
  }

  function getLights(): LightItem[] {
    return lights.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      visible: l.visible,
      intensity: l.intensity,
      color: l.color,
      castShadow: l.castShadow,
    }));
  }

  function notifyChange() {
    updateGlyphHighlights();
    if (onChangeCb) {
      onChangeCb(getLights(), activeLightId);
    }
  }

  function addInitialLight(
    name: string,
    type: LightType,
    colorHex: number,
    intensity: number,
    pos: [number, number, number],
    castShadow = true,
    shadowMapSize = 2048
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
        dirLight.shadow.mapSize.width = shadowMapSize;
        dirLight.shadow.mapSize.height = shadowMapSize;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 15;
        dirLight.shadow.bias = -0.0005;
        // EDGE CASE: pure bias cannot fix acne on axis-aligned box faces; normalBias offsets along the normal instead
        dirLight.shadow.normalBias = 0.02;
        const d = 2.5;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
      }
      light = dirLight;
    } else {
      const pointLight = new THREE.PointLight(colorHex, intensity, 10, 2);
      if (castShadow) {
        pointLight.castShadow = true;
        pointLight.shadow.mapSize.width = 512;
        pointLight.shadow.mapSize.height = 512;
        pointLight.shadow.bias = -0.005;
        pointLight.shadow.normalBias = 0.02;
      }
      light = pointLight;
    }

    group.add(light);
    const glyph = createLightGlyph(type, colorHex);
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

  addInitialLight('Key Light', 'directional', 0xfff3e0, 2.2, [3, 4, 3], true, 2048);
  addInitialLight('Fill Light', 'directional', 0xcfd8dc, 0.9, [-3, 2, 2], true, 1024);
  addInitialLight('Rim Light', 'directional', 0x80d8ff, 2.6, [0, 3.5, -3.5], true, 1024);

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

  const glyphWorldPos = new THREE.Vector3();
  function updateGlyphScale(camera: THREE.Camera) {
    lights.forEach((l) => {
      if (!l.visible) return;
      l.group.getWorldPosition(glyphWorldPos);
      const scale = Math.min(
        2.4,
        Math.max(0.55, camera.position.distanceTo(glyphWorldPos) * 0.045)
      );
      l.glyph.scale.setScalar(scale);
    });
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
    getLights,
    getActiveLightId: () => activeLightId,
    selectLight,
    setLightIntensity,
    setLightColor,
    toggleLightShadow,
    toggleLightVisibility,
    updateGlyphScale,
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

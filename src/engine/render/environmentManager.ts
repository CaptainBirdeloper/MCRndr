import * as THREE from 'three';
import { ShaderPassMode } from '../../types';
import { GroundMode, loadSettings, saveSettings } from '../../utils/settings';
import grassBlockTopUrl from '../../assets/grass_block_top.png';

export interface SkyboxPreset {
  id: string;
  label: string;
  top: string;
  horizon: string;
  bottom: string;
}

export const SKYBOX_PRESETS: SkyboxPreset[] = [
  { id: 'studio', label: 'STUDIO', top: '#0a0612', horizon: '#3b1d30', bottom: '#06040d' },
  { id: 'sunset', label: 'SUNSET', top: '#182a5c', horizon: '#ff7a3a', bottom: '#2a1104' },
  { id: 'night', label: 'NIGHT', top: '#01020a', horizon: '#12203f', bottom: '#03040a' },
  { id: 'black', label: 'BLACK', top: '#000000', horizon: '#000000', bottom: '#000000' },
];

export interface ExportEnvironment {
  skyboxId: string;
  groundMode: GroundMode;
}

export interface EnvironmentState {
  skyboxId: string;
  groundMode: GroundMode;
  fogEnabled: boolean;
  fogFar: number;
  giEnabled: boolean;
  giIntensity: number;
}

export interface EnvironmentManagerOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  initial?: Partial<EnvironmentState>;
  onChange?: (state: EnvironmentState) => void;
  persist?: boolean;
}

export interface EnvironmentManager {
  sky: THREE.Mesh;
  ground: THREE.Mesh;
  getPresets: () => SkyboxPreset[];
  getState: () => EnvironmentState;
  setSkybox: (id: string) => void;
  setGroundMode: (mode: GroundMode) => void;
  setFogEnabled: (enabled: boolean) => void;
  setFogFar: (far: number) => void;
  setGiEnabled: (enabled: boolean) => void;
  setGiIntensity: (value: number) => void;
  setChangeListener: (fn: ((state: EnvironmentState) => void) | null) => void;
  setPassVisible: (mode: ShaderPassMode) => void;
  prepareForExport: (env: ExportEnvironment | null) => () => void;
  update: (camera: THREE.PerspectiveCamera) => void;
  destroy: () => void;
}

const SKY_RADIUS = 90;
const GROUND_SIZE = 400;
const GROUND_REPEAT = 400;
const FOG_NEAR = 10;
// Minecraft plains grass tint (grass_block_top is grayscale, biome tint gives the green)
const GRASS_TINT = '#91BD59';

const SKY_VERTEX = `
varying vec3 vWorldPos;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const SKY_FRAGMENT = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 bottomColor;
varying vec3 vWorldPos;
void main() {
  float h = normalize(vWorldPos).y;
  vec3 color = h > 0.0
    ? mix(horizonColor, topColor, smoothstep(0.0, 0.55, h))
    : mix(horizonColor, bottomColor, smoothstep(0.0, -0.35, h));
  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function getPreset(id: string): SkyboxPreset {
  return SKYBOX_PRESETS.find((p) => p.id === id) ?? SKYBOX_PRESETS[0];
}

export function createEnvironmentManager(options: EnvironmentManagerOptions): EnvironmentManager {
  const { renderer, scene } = options;
  const stored = loadSettings();

  const state: EnvironmentState = {
    skyboxId: typeof options.initial?.skyboxId === 'string' ? options.initial.skyboxId : stored.skyboxId,
    groundMode: options.initial?.groundMode ?? stored.groundMode,
    fogEnabled: options.initial?.fogEnabled ?? stored.fogEnabled,
    fogFar: options.initial?.fogFar ?? stored.fogFar,
    giEnabled: options.initial?.giEnabled ?? stored.giEnabled,
    giIntensity: options.initial?.giIntensity ?? stored.giIntensity,
  };
  state.skyboxId = getPreset(state.skyboxId).id;

  let changeListener: ((updated: EnvironmentState) => void) | null = options.onChange ?? null;
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  let passMode: ShaderPassMode = 'beauty';
  let exportHidden = false;
  let exportTransparent = false;
  let exportEnv: ExportEnvironment | null = null;

  const skyUniforms = {
    topColor: { value: new THREE.Color() },
    horizonColor: { value: new THREE.Color() },
    bottomColor: { value: new THREE.Color() },
  };

  const skyGeometry = new THREE.SphereGeometry(SKY_RADIUS, 32, 16);
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    toneMapped: true,
  });
  const sky = new THREE.Mesh(skyGeometry, skyMaterial);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  const grassTexture = new THREE.TextureLoader().load(grassBlockTopUrl);
  grassTexture.magFilter = THREE.NearestFilter;
  grassTexture.minFilter = THREE.LinearMipmapLinearFilter;
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(GROUND_REPEAT, GROUND_REPEAT);
  grassTexture.colorSpace = THREE.SRGBColorSpace;
  grassTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: grassTexture,
    color: GRASS_TINT,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.002;
  ground.receiveShadow = true;
  scene.add(ground);

  const catcherMaterial = new THREE.ShadowMaterial({ opacity: 0.35 });
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), catcherMaterial);
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.001;
  catcher.receiveShadow = true;
  scene.add(catcher);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(skyGeometry, skyMaterial);
  envScene.add(envSky);
  let envTarget: THREE.WebGLRenderTarget | null = null;

  function schedulePersist() {
    if (options.persist === false) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      const current = loadSettings();
      saveSettings({
        ...current,
        skyboxId: state.skyboxId,
        groundMode: state.groundMode,
        fogEnabled: state.fogEnabled,
        fogFar: state.fogFar,
        giEnabled: state.giEnabled,
        giIntensity: state.giIntensity,
      });
    }, 250);
  }

  function notify() {
    changeListener?.({ ...state });
    schedulePersist();
  }

  function applySkyColors() {
    const preset = getPreset(state.skyboxId);
    state.skyboxId = preset.id;
    skyUniforms.topColor.value.set(preset.top);
    skyUniforms.horizonColor.value.set(preset.horizon);
    skyUniforms.bottomColor.value.set(preset.bottom);
  }

  function applyFog() {
    if (state.groundMode === 'grass' && state.fogEnabled) {
      const preset = getPreset(state.skyboxId);
      scene.fog = new THREE.Fog(new THREE.Color(preset.horizon), FOG_NEAR, state.fogFar);
    } else {
      scene.fog = null;
    }
  }

  function rebuildEnvironment() {
    if (envTarget) {
      envTarget.dispose();
      envTarget = null;
    }
    if (!state.giEnabled) {
      scene.environment = null;
      return;
    }
    envTarget = pmrem.fromScene(envScene, 0, 0.1, SKY_RADIUS * 1.5);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = state.giIntensity;
  }

  function applyVisibility() {
    if (exportHidden) {
      if (exportEnv) {
        const beauty = passMode === 'beauty';
        // "black" sky = transparent capture; other presets bake the sky dome
        sky.visible = beauty && exportEnv.skyboxId !== 'black';
        ground.visible = beauty && exportEnv.groundMode === 'grass';
        catcher.visible = beauty && exportEnv.groundMode === 'shadow';
        return;
      }
      // Legacy path: hide all environment, keep catcher for transparent captures
      sky.visible = false;
      ground.visible = false;
      catcher.visible = passMode === 'beauty' && exportTransparent;
      return;
    }
    const beauty = passMode === 'beauty';
    sky.visible = beauty;
    ground.visible = beauty && state.groundMode === 'grass';
    catcher.visible = beauty && state.groundMode === 'shadow';
  }

  function applyAll() {
    applySkyColors();
    applyFog();
    rebuildEnvironment();
    applyVisibility();
  }

  applyAll();

  return {
    sky,
    ground,
    getPresets: () => SKYBOX_PRESETS,
    getState: () => ({ ...state }),
    setSkybox(id: string) {
      const next = getPreset(id);
      if (next.id === state.skyboxId) return;
      state.skyboxId = next.id;
      applySkyColors();
      applyFog();
      rebuildEnvironment();
      notify();
    },
    setGroundMode(mode: GroundMode) {
      if (mode === state.groundMode) return;
      state.groundMode = mode;
      applyFog();
      applyVisibility();
      notify();
    },
    setFogEnabled(enabled: boolean) {
      if (enabled === state.fogEnabled) return;
      state.fogEnabled = enabled;
      applyFog();
      notify();
    },
    setFogFar(far: number) {
      state.fogFar = Math.max(20, Math.min(120, far));
      applyFog();
      notify();
    },
    setGiEnabled(enabled: boolean) {
      if (enabled === state.giEnabled) return;
      state.giEnabled = enabled;
      rebuildEnvironment();
      notify();
    },
    setGiIntensity(value: number) {
      state.giIntensity = Math.max(0, Math.min(2, value));
      scene.environmentIntensity = state.giIntensity;
      notify();
    },
    setChangeListener(fn) {
      changeListener = fn;
    },
    setPassVisible(mode: ShaderPassMode) {
      passMode = mode;
      applyVisibility();
    },
    prepareForExport(env: ExportEnvironment | null) {
      const prevState = { ...state };
      exportHidden = true;
      exportEnv = env;
      exportTransparent = true;
      if (env) {
        state.skyboxId = getPreset(env.skyboxId).id;
        state.groundMode = env.groundMode;
        applySkyColors();
        applyFog();
      } else {
        scene.fog = null;
      }
      applyVisibility();
      return () => {
        Object.assign(state, prevState);
        exportHidden = false;
        exportEnv = null;
        applyAll();
      };
    },
    update(camera: THREE.PerspectiveCamera) {
      sky.position.copy(camera.position);
    },
    destroy() {
      if (persistTimer) clearTimeout(persistTimer);
      scene.remove(sky);
      scene.remove(ground);
      scene.remove(catcher);
      scene.environment = null;
      scene.fog = null;
      if (envTarget) envTarget.dispose();
      envTarget = null;
      pmrem.dispose();
      skyGeometry.dispose();
      skyMaterial.dispose();
      grassTexture.dispose();
      groundMaterial.dispose();
      catcher.geometry.dispose();
      catcherMaterial.dispose();
      ground.geometry.dispose();
    },
  };
}

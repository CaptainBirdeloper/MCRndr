import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSteveDefaultCanvas, createSkinTexture, detectSkinModel } from '../rig/skin';
import { MinecraftRig } from '../rig/rig';
import { setupRigControls, RigControlsManager } from '../transforms/controls';
import { ShaderPassManager } from './shaders';
import { createLightingManager, LightingManager } from '../lighting/lightingManager';
import { createEnvironmentManager, EnvironmentManager } from './environmentManager';
import { createPlayerManager, PlayerManager } from '../players/playerManager';
import { BodyPartName, ShaderPassMode, ArmType } from '../../types';
import { loadSettings } from '../../utils/settings';

export interface SceneStage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  rig: MinecraftRig;
  controlsManager: RigControlsManager;
  shaderManager: ShaderPassManager;
  players: PlayerManager;
  lightingManager: LightingManager;
  environmentManager: EnvironmentManager;
  ground: THREE.Mesh;
  grid: THREE.GridHelper;
  isExporting: boolean;
  setShaderPass: (mode: ShaderPassMode) => void;
  setPanSpeed: (speed: number) => void;
  loadSkinFile: (file: File, playerId?: string) => Promise<ArmType>;
  resize: () => void;
  destroy: () => void;
}

export function createScene(
  container: HTMLDivElement,
  onSelectionChange?: (part: BodyPartName | null, rotDeg: [number, number, number]) => void
): SceneStage {
  // EDGE CASE: container and window height of 0 causes division by zero (NaN aspect ratio), corrupting camera projection matrix
  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = null; // transparent for custom AMOLED background & export

  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 1.4, 4.2);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.95, 0); // focus on torso/head level
  controls.maxDistance = 15;
  controls.minDistance = 0.8;
  // Right mouse reserved for the canvas context menu (player creation) instead of pan
  (controls.mouseButtons as unknown as { RIGHT: unknown }).RIGHT = null;
  controls.update();

  const storedSettings = loadSettings();
  const lightingManager = createLightingManager(scene, {
    initialRig: storedSettings.lightRig,
    presetId: storedSettings.lightingPresetId,
    exposure: storedSettings.exposure,
    onExposure: (value) => {
      renderer.toneMappingExposure = value;
    },
    onShadowMode: (mode) => {
      const type = mode === 'basic' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
      if (renderer.shadowMap.type === type) return;
      renderer.shadowMap.type = type;
      renderer.shadowMap.needsUpdate = true;
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((m) => (m.needsUpdate = true));
        else if (material) material.needsUpdate = true;
      });
    },
  });
  renderer.toneMappingExposure = lightingManager.getExposure();

  // Sky dome, flat grass world, fog and image-based GI
  const environmentManager = createEnvironmentManager({
    renderer,
    scene,
    initial: {
      skyboxId: storedSettings.skyboxId,
      groundMode: storedSettings.groundMode,
      fogEnabled: storedSettings.fogEnabled,
      fogFar: storedSettings.fogFar,
      giEnabled: storedSettings.giEnabled,
      giIntensity: storedSettings.giIntensity,
    },
  });

  const grid = new THREE.GridHelper(10, 20, 0x730907, 0x1f0b18);
  grid.position.y = 0.001;
  scene.add(grid);

  const playerManager = createPlayerManager(scene, () => createSkinTexture(createSteveDefaultCanvas()));
  playerManager.createPlayer();

  const controlsManager = setupRigControls(
    scene,
    camera,
    renderer.domElement,
    controls,
    playerManager.getActiveRig(),
    lightingManager,
    onSelectionChange,
    playerManager
  );

  playerManager.setChangeListener((_players, _activeId, activeRig) => {
    controlsManager.setActiveRig(activeRig);
  });

  function setShaderPass(mode: ShaderPassMode) {
    playerManager.setShaderPass(mode);
    const isBeauty = mode === 'beauty';
    environmentManager.setPassVisible(mode);
    grid.visible = isBeauty;
  }

  async function loadSkinFile(file: File, playerId?: string): Promise<ArmType> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        // EDGE CASE: img.onerror rejection on corrupt or invalid image data will cause unhandled Promise rejections if caller lacks try/catch
        img.onload = () => {
          const tex = createSkinTexture(img);
          const detectedArm = detectSkinModel(img);
          playerManager.applySkin(
            playerId ?? playerManager.getActiveId(),
            tex,
            detectedArm,
            file.name.replace(/\.png$/i, '')
          );
          resolve(detectedArm);
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  let animFrameId = 0;
  let isExporting = false;

  // WASD pan: right mouse is reserved for the player context menu, so ground panning moved to keys
  let panSpeed = loadSettings().panSpeed;
  const pressedKeys = new Set<string>();
  const panForward = new THREE.Vector3();
  const panRight = new THREE.Vector3();
  const panDelta = new THREE.Vector3();
  const worldUp = new THREE.Vector3(0, 1, 0);
  const panClock = new THREE.Clock();

  function onPanKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.ctrlKey || e.metaKey) return;
    const code = e.code;
    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'Space' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight'
    ) {
      // Space would otherwise scroll the page or re-trigger the focused button
      if (code === 'Space') e.preventDefault();
      pressedKeys.add(code);
    }
  }

  function onPanKeyUp(e: KeyboardEvent) {
    pressedKeys.delete(e.code);
  }

  function clearPanKeys() {
    pressedKeys.clear();
  }

  function applyWASDPan(dt: number) {
    if (pressedKeys.size === 0) return;

    const forwardAmount = (pressedKeys.has('KeyW') ? 1 : 0) - (pressedKeys.has('KeyS') ? 1 : 0);
    const strafeAmount = (pressedKeys.has('KeyD') ? 1 : 0) - (pressedKeys.has('KeyA') ? 1 : 0);
    const verticalAmount =
      (pressedKeys.has('Space') ? 1 : 0) -
      (pressedKeys.has('ShiftLeft') || pressedKeys.has('ShiftRight') ? 1 : 0);
    if (forwardAmount === 0 && strafeAmount === 0 && verticalAmount === 0) return;

    // Panning the workspace viewport must leave camera view; otherwise WASD moves the
    // camera we look through and the view stays trapped on it
    if (controlsManager.getActiveCameraId()) controlsManager.exitCameraView();

    panDelta.set(0, 0, 0);

    if (forwardAmount !== 0 || strafeAmount !== 0) {
      camera.getWorldDirection(panForward);
      panForward.y = 0;
      // EDGE CASE: looking straight down flattens the forward vector to ~1e-6, normalize() would emit a garbage direction
      if (panForward.lengthSq() < 1e-6) {
        panForward.copy(camera.up).setY(0);
        if (panForward.lengthSq() < 1e-6) panForward.set(0, 0, -1);
      }
      panForward.normalize();
      panRight.crossVectors(panForward, worldUp).normalize();
      panDelta.copy(panForward).multiplyScalar(forwardAmount).addScaledVector(panRight, strafeAmount);
    }

    panDelta.y += verticalAmount;
    if (panDelta.lengthSq() === 0) return;

    panDelta.normalize().multiplyScalar(panSpeed * dt);

    camera.position.add(panDelta);
    controls.target.add(panDelta);
  }

  function setPanSpeed(speed: number) {
    panSpeed = speed;
  }

  window.addEventListener('keydown', onPanKeyDown);
  window.addEventListener('keyup', onPanKeyUp);
  window.addEventListener('blur', clearPanKeys);
  document.addEventListener('visibilitychange', clearPanKeys);

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    // EDGE CASE: background tab pauses rAF, so the first delta on refocus can be seconds and teleport the camera
    const dt = Math.min(panClock.getDelta(), 0.1);
    if (isExporting) return;
    applyWASDPan(dt);
    controls.update();
    environmentManager.update(camera);
    lightingManager.updateGlyphVisuals(camera);
    renderer.render(scene, camera);
  }
  animate();

  function resize() {
    // EDGE CASE: container clientHeight of 0 during resize causes division by zero, breaking camera projection with NaN/Infinity
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener('resize', resize);

  function destroy() {
    cancelAnimationFrame(animFrameId);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onPanKeyDown);
    window.removeEventListener('keyup', onPanKeyUp);
    window.removeEventListener('blur', clearPanKeys);
    document.removeEventListener('visibilitychange', clearPanKeys);
    controlsManager.destroy();
    playerManager.destroy();
    lightingManager.destroy();
    environmentManager.destroy();
    controls.dispose();
    renderer.forceContextLoss();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  // DEBUG BISECT: ?hide=shadow,rig,ground,grid,glyphs,lines,helpers
  const hideFlags = (new URLSearchParams(window.location.search).get('hide') || '').split(',').filter(Boolean);
  if (hideFlags.length > 0) {
    if (hideFlags.includes('grid')) grid.visible = false;
    if (hideFlags.includes('ground')) environmentManager.ground.visible = false;
    if (hideFlags.includes('sky')) environmentManager.sky.visible = false;
    if (hideFlags.includes('rig')) playerManager.getActiveRig().root.visible = false;
    if (hideFlags.includes('shadow')) {
      renderer.shadowMap.enabled = false;
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh && mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            m.needsUpdate = true;
          });
        }
      });
    }
    if (hideFlags.includes('glyphs')) {
      lightingManager.getLights().forEach((l) => {
        const group = lightingManager.getLightGroupById(l.id);
        if (group) group.visible = false;
      });
    }
    if (hideFlags.includes('lines') || hideFlags.includes('helpers')) {
      scene.traverse((o) => {
        const line = o as THREE.Line;
        if (line.isLine || (o as THREE.LineSegments).isLineSegments) o.visible = false;
      });
    }
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    get rig() {
      return playerManager.getActiveRig();
    },
    controlsManager,
    get shaderManager() {
      return playerManager.getActiveShader();
    },
    players: playerManager,
    lightingManager,
    environmentManager,
    ground: environmentManager.ground,
    grid,
    get isExporting() {
      return isExporting;
    },
    set isExporting(val: boolean) {
      isExporting = val;
    },
    setShaderPass,
    setPanSpeed,
    loadSkinFile,
    resize,
    destroy,
  };
}

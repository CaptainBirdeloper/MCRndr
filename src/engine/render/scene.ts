import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createSteveDefaultCanvas, createSkinTexture, detectSkinModel } from '../rig/skin';
import { createMinecraftRig, MinecraftRig } from '../rig/rig';
import { setupRigControls, RigControlsManager } from '../transforms/controls';
import { ShaderPassManager } from './shaders';
import { createLightingManager, LightingManager } from '../lighting/lightingManager';
import { BodyPartName, ShaderPassMode, ArmType } from '../../types';

export interface SceneStage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  rig: MinecraftRig;
  controlsManager: RigControlsManager;
  shaderManager: ShaderPassManager;
  lightingManager: LightingManager;
  lights: {
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
    ambient: THREE.AmbientLight;
  };
  ground: THREE.Mesh;
  grid: THREE.GridHelper;
  isExporting: boolean;
  setShaderPass: (mode: ShaderPassMode) => void;
  loadSkinFile: (file: File) => Promise<ArmType>;
  resize: () => void;
  destroy: () => void;
}

export function createScene(
  container: HTMLDivElement,
  onSelectionChange?: (part: BodyPartName | null, rotDeg: [number, number, number]) => void
): SceneStage {
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
  controls.update();

  // Studio Lighting Manager (Key, Fill, Rim, Ambient)
  const lightingManager = createLightingManager(scene, renderer);
  const keyLight = (lightingManager.getLightGroupById('light_key_light')?.children[0] as THREE.DirectionalLight) || new THREE.DirectionalLight();
  const fillLight = (lightingManager.getLightGroupById('light_fill_light')?.children[0] as THREE.DirectionalLight) || new THREE.DirectionalLight();
  const rimLight = (lightingManager.getLightGroupById('light_rim_light')?.children[0] as THREE.DirectionalLight) || new THREE.DirectionalLight();
  const ambient = new THREE.AmbientLight(0xffffff, 0.45);

  // Shadow Catcher Ground (captures shadow on transparent alpha)
  const shadowGeo = new THREE.PlaneGeometry(20, 20);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const ground = new THREE.Mesh(shadowGeo, shadowMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = 0;
  scene.add(ground);

  // Subtle Studio Grid matching Lunacy Crimson Theme
  const grid = new THREE.GridHelper(10, 20, 0x730907, 0x1f0b18);
  grid.position.y = 0.001;
  scene.add(grid);

  // Initialize Minecraft Rig
  const defaultCanvas = createSteveDefaultCanvas();
  const defaultTexture = createSkinTexture(defaultCanvas);
  const rig = createMinecraftRig(defaultTexture, 'steve');
  scene.add(rig.root);

  // Initialize Shader Passes
  const shaderManager = new ShaderPassManager(rig, defaultTexture);

  // Initialize Rig Controls & Transform Gizmo
  const controlsManager = setupRigControls(
    scene,
    camera,
    renderer.domElement,
    controls,
    rig,
    lightingManager,
    onSelectionChange
  );

  function setShaderPass(mode: ShaderPassMode) {
    shaderManager.setPass(mode);
    const isBeauty = mode === 'beauty';
    ground.visible = isBeauty;
    grid.visible = isBeauty;
  }

  async function loadSkinFile(file: File): Promise<ArmType> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const tex = createSkinTexture(img);
          const detectedArm = detectSkinModel(img);
          rig.setArmType(detectedArm);
          rig.setSkinTexture(tex);
          shaderManager.updateTexture(tex);
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

  function animate() {
    animFrameId = requestAnimationFrame(animate);
    if (isExporting) return;
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  function resize() {
    if (!container) return;
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
    controlsManager.destroy();
    lightingManager.destroy();
    controls.dispose();
    renderer.forceContextLoss();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    rig,
    controlsManager,
    shaderManager,
    lightingManager,
    lights: { key: keyLight, fill: fillLight, rim: rimLight, ambient },
    ground,
    grid,
    get isExporting() {
      return isExporting;
    },
    set isExporting(val: boolean) {
      isExporting = val;
    },
    setShaderPass,
    loadSkinFile,
    resize,
    destroy,
  };
}

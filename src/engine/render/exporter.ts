import * as THREE from 'three';
import { SceneStage } from './scene';
import { ShaderPassMode } from '../../types';
import type { ExportEnvironment } from './environmentManager';

export type ExportResolution = '1080p' | '2k' | '4k';

export interface ResolutionConfig {
  width: number;
  height: number;
  label: string;
}

export const RESOLUTIONS: Record<ExportResolution, ResolutionConfig> = {
  '1080p': { width: 1920, height: 1080, label: '1080p (FHD)' },
  '2k': { width: 2560, height: 1440, label: '1440p (2K)' },
  '4k': { width: 3840, height: 2160, label: '2160p (4K)' },
};

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

/**
 * Captures an offscreen high-fidelity snapshot for a given pass and resolution.
 */
export async function capturePassImage(
  stage: SceneStage,
  pass: ShaderPassMode,
  resolution: ExportResolution = '1080p',
  transparentBg = true,
  targetCamera?: THREE.PerspectiveCamera | null,
  exportEnv?: ExportEnvironment | null
): Promise<string> {
  const { renderer, scene, camera, controlsManager } = stage;
  // EDGE CASE: unvalidated resolution key will return undefined from RESOLUTIONS, throwing TypeError on config.width
  const config = RESOLUTIONS[resolution];

  stage.isExporting = true;

  const prevSize = new THREE.Vector2();
  renderer.getSize(prevSize);
  const prevPixelRatio = renderer.getPixelRatio();
  const prevAspect = camera.aspect;
  const prevPass = stage.shaderManager.pass;
  const prevSelectedPart = controlsManager.selectedPart;

  const prevCamPos = camera.position.clone();
  const prevCamQuat = camera.quaternion.clone();
  const prevCamFov = camera.fov;

  // Temporarily deselect part to remove gizmo/box helpers from render
  controlsManager.selectPart(null);

  if (targetCamera) {
    camera.position.copy(targetCamera.position);
    camera.quaternion.copy(targetCamera.quaternion);
    camera.fov = targetCamera.fov;
    camera.updateMatrixWorld(true);
  }

  stage.setShaderPass(pass);
  const passTransparent = pass === 'beauty' ? transparentBg : true;
  const prevBg = scene.background;
  scene.background = passTransparent ? null : new THREE.Color(0x000000);

  // Always hide studio grid and camera wireframe helpers from exported renders
  const prevGridVisible = stage.grid.visible;
  stage.grid.visible = false;
  const cameraHelpers = controlsManager.getCameraHelpers();
  const prevHelpersVisibility = cameraHelpers.map((h) => h.visible);
  cameraHelpers.forEach((h) => {
    h.visible = false;
  });
  const lightGlyphs = stage.lightingManager.getGlyphs();
  const prevLightVisibility = lightGlyphs.map((g) => g.visible);
  lightGlyphs.forEach((g) => {
    g.visible = false;
  });
  // Environment overrides only affect the beauty pass; mask passes must stay clean
  const restoreEnvironment = stage.environmentManager.prepareForExport(
    pass === 'beauty' ? exportEnv ?? null : null
  );
  stage.environmentManager.update(camera);

  // Temporarily configure renderer for unscaled high-res capture (1:1 pixelRatio prevents DPI multiplication)
  renderer.setPixelRatio(1);
  renderer.setSize(config.width, config.height, false);
  camera.aspect = config.width / config.height;
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  // EDGE CASE: toDataURL() can throw SecurityError if canvas is tainted by cross-origin textures or return 'data:,' on GPU memory exhaustion at 4K
  const dataUrl = renderer.domElement.toDataURL('image/png');

  stage.grid.visible = prevGridVisible;
  cameraHelpers.forEach((h, i) => {
    h.visible = prevHelpersVisibility[i];
  });
  lightGlyphs.forEach((g, i) => {
    g.visible = prevLightVisibility[i];
  });
  restoreEnvironment();

  if (targetCamera) {
    camera.position.copy(prevCamPos);
    camera.quaternion.copy(prevCamQuat);
    camera.fov = prevCamFov;
    camera.updateMatrixWorld(true);
  }

  renderer.setPixelRatio(prevPixelRatio);
  renderer.setSize(prevSize.x, prevSize.y, true);
  camera.aspect = prevAspect;
  camera.updateProjectionMatrix();
  scene.background = prevBg;
  stage.setShaderPass(prevPass);
  if (prevSelectedPart) {
    controlsManager.selectPart(prevSelectedPart);
  }

  stage.isExporting = false;
  renderer.render(scene, camera);

  return dataUrl;
}

/**
 * Exports a single image to disk
 */
export async function exportSinglePass(
  stage: SceneStage,
  pass: ShaderPassMode,
  resolution: ExportResolution = '1080p',
  transparentBg = true,
  targetCamera?: THREE.PerspectiveCamera | null,
  exportEnv?: ExportEnvironment | null
) {
  const dataUrl = await capturePassImage(stage, pass, resolution, transparentBg, targetCamera, exportEnv);
  // EDGE CASE: Date.now().slice(-4) repeats every 10 seconds, causing filename collisions during repeated exports
  const time = Date.now().toString().slice(-4);
  downloadDataUrl(dataUrl, `mc_${pass}_${resolution}_${time}.png`);
}

export const PASS_NAMES: Record<ShaderPassMode, string> = {
  beauty: 'beauty',
  wem: 'wem_mask',
  normal: 'normal',
  clown: 'clown_id',
};

/**
 * Sequentially renders and downloads custom selected passes with identical camera matrix
 */
export async function exportSelectedPasses(
  stage: SceneStage,
  passes: ShaderPassMode[],
  resolution: ExportResolution = '1080p',
  transparentBg = true,
  targetCamera?: THREE.PerspectiveCamera | null,
  exportEnv?: ExportEnvironment | null
) {
  if (passes.length === 0) return;
  const time = Date.now().toString().slice(-4);

  for (const passMode of passes) {
    const filename = PASS_NAMES[passMode] || passMode;
    const dataUrl = await capturePassImage(stage, passMode, resolution, transparentBg, targetCamera, exportEnv);
    downloadDataUrl(dataUrl, `mc_${filename}_${resolution}_${time}.png`);
    // Brief delay to allow browser download queue to process cleanly
    await new Promise((r) => setTimeout(r, 180));
  }
}

/**
 * Sequentially renders and downloads all 4 passes with identical camera matrix
 */
export async function exportAllPasses(
  stage: SceneStage,
  resolution: ExportResolution = '1080p',
  transparentBg = true,
  targetCamera?: THREE.PerspectiveCamera | null,
  exportEnv?: ExportEnvironment | null
) {
  return exportSelectedPasses(stage, ['beauty', 'wem', 'normal', 'clown'], resolution, transparentBg, targetCamera, exportEnv);
}

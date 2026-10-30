import * as THREE from 'three';
import { SceneStage } from './scene';
import { ShaderPassMode } from '../../types';

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
  targetCamera?: THREE.PerspectiveCamera | null
): Promise<string> {
  const { renderer, scene, camera, controlsManager } = stage;
  const config = RESOLUTIONS[resolution];

  stage.isExporting = true;

  // Save current state accurately using logical dimensions and device pixel ratio
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

  // If a specific camera is targeted, apply its transform
  if (targetCamera) {
    camera.position.copy(targetCamera.position);
    camera.quaternion.copy(targetCamera.quaternion);
    camera.fov = targetCamera.fov;
    camera.updateMatrixWorld(true);
  }

  // Set pass and background
  stage.setShaderPass(pass);
  const prevBg = scene.background;
  scene.background = transparentBg ? null : new THREE.Color(0x000000);

  // Always hide studio grid and camera wireframe helpers from exported renders
  const prevGridVisible = stage.grid.visible;
  stage.grid.visible = false;
  const cameraHelpers = controlsManager.getCameraHelpers ? controlsManager.getCameraHelpers() : [];
  const prevHelpersVisibility = cameraHelpers.map((h) => h.visible);
  cameraHelpers.forEach((h) => {
    h.visible = false;
  });
  const lightGlyphs = stage.lightingManager?.getGlyphs() || [];
  const prevLightVisibility = lightGlyphs.map((g) => g.visible);
  lightGlyphs.forEach((g) => {
    g.visible = false;
  });

  // Temporarily configure renderer for unscaled high-res capture (1:1 pixelRatio prevents DPI multiplication)
  renderer.setPixelRatio(1);
  renderer.setSize(config.width, config.height, false);
  camera.aspect = config.width / config.height;
  camera.updateProjectionMatrix();

  // Render high-res frame
  renderer.render(scene, camera);
  const dataUrl = renderer.domElement.toDataURL('image/png');

  // Restore previous state
  stage.grid.visible = prevGridVisible;
  cameraHelpers.forEach((h, i) => {
    h.visible = prevHelpersVisibility[i] ?? false;
  });
  lightGlyphs.forEach((g, i) => {
    g.visible = prevLightVisibility[i] ?? false;
  });

  if (targetCamera) {
    camera.position.copy(prevCamPos);
    camera.quaternion.copy(prevCamQuat);
    camera.fov = prevCamFov;
    camera.updateMatrixWorld(true);
  }

  // Restore renderer pixel ratio and size back to exact logical viewport dimensions
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
  targetCamera?: THREE.PerspectiveCamera | null
) {
  const dataUrl = await capturePassImage(stage, pass, resolution, transparentBg, targetCamera);
  const time = Date.now().toString().slice(-4);
  downloadDataUrl(dataUrl, `mc_${pass}_${resolution}_${time}.png`);
}

/**
 * Sequentially renders and downloads all 4 passes with identical camera matrix
 */
export async function exportAllPasses(
  stage: SceneStage,
  resolution: ExportResolution = '1080p',
  transparentBg = true,
  targetCamera?: THREE.PerspectiveCamera | null
) {
  const passes: { mode: ShaderPassMode; name: string }[] = [
    { mode: 'beauty', name: 'beauty' },
    { mode: 'wem', name: 'wem_mask' },
    { mode: 'normal', name: 'normal' },
    { mode: 'clown', name: 'clown_id' },
  ];

  const time = Date.now().toString().slice(-4);

  for (const p of passes) {
    const dataUrl = await capturePassImage(stage, p.mode, resolution, transparentBg, targetCamera);
    downloadDataUrl(dataUrl, `mc_${p.name}_${resolution}_${time}.png`);
    // Brief delay to allow browser download queue to process cleanly
    await new Promise((r) => setTimeout(r, 180));
  }
}

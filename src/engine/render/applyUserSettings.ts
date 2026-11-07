import type { SceneStage } from './scene';
import type { UserSettings } from '../../utils/settings';

/** Push persisted general settings onto a freshly created stage. */
export function applySettingsToStage(stage: SceneStage, settings: UserSettings) {
  stage.controlsManager.setPerpetualFov(settings.perpetualFov);
  stage.controls.rotateSpeed = settings.orbitSensitivity;
  stage.controls.zoomSpeed = settings.orbitSensitivity;
  stage.controlsManager.setCameraControlMode(settings.cameraControlMode);
  stage.setPanSpeed(settings.panSpeed);
  stage.grid.visible = settings.showGrid;
  stage.controlsManager.getCameraHelpers().forEach((helper) => {
    helper.visible = settings.showCameraGlyphs;
  });
}

export type CameraControlMode = 'look' | 'orbit';
export type GroundMode = 'shadow' | 'grass' | 'off';

export interface UserSettings {
  perpetualFov: number;
  orbitSensitivity: number;
  panSpeed: number;
  uiZoom: number;
  showGrid: boolean;
  showCameraGlyphs: boolean;
  showThirds: boolean;
  showCenterGuide: boolean;
  cameraControlMode: CameraControlMode;
  /** Raw persisted rig; validated by sanitizeLightRig when the lighting manager boots. */
  lightRig: unknown;
  lightingPresetId: string | null;
  exposure: number;
  skyboxId: string;
  groundMode: GroundMode;
  fogEnabled: boolean;
  fogFar: number;
  giEnabled: boolean;
  giIntensity: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  perpetualFov: 38,
  orbitSensitivity: 1.0,
  panSpeed: 2.0,
  uiZoom: 125,
  showGrid: true,
  showCameraGlyphs: true,
  showThirds: false,
  showCenterGuide: false,
  cameraControlMode: 'look',
  lightRig: null,
  lightingPresetId: null,
  exposure: 1.05,
  skyboxId: 'studio',
  groundMode: 'grass',
  fogEnabled: true,
  fogFar: 48,
  giEnabled: true,
  giIntensity: 1.0,
};

const STORAGE_KEY = 'mc_render_user_settings';

export function loadSettings(): UserSettings {
  try {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlZoom = urlParams ? Number(urlParams.get('uiZoom')) : null;

    const raw = localStorage.getItem(STORAGE_KEY);
    // EDGE CASE: JSON.parse('null') returns null, causing TypeError on parsed.uiZoom access before catch block
    const parsed = raw ? JSON.parse(raw) : {};

    const effectiveZoom =
      urlZoom && !isNaN(urlZoom)
        ? Math.max(50, Math.min(300, urlZoom))
        : typeof parsed.uiZoom === 'number'
        ? Math.max(50, Math.min(300, parsed.uiZoom))
        : DEFAULT_SETTINGS.uiZoom;

    return {
      perpetualFov: typeof parsed.perpetualFov === 'number' ? Math.max(20, Math.min(90, parsed.perpetualFov)) : DEFAULT_SETTINGS.perpetualFov,
      orbitSensitivity: typeof parsed.orbitSensitivity === 'number' ? Math.max(0.2, Math.min(2.5, parsed.orbitSensitivity)) : DEFAULT_SETTINGS.orbitSensitivity,
      panSpeed: typeof parsed.panSpeed === 'number' ? Math.max(0.5, Math.min(8, parsed.panSpeed)) : DEFAULT_SETTINGS.panSpeed,
      uiZoom: effectiveZoom,
      showGrid: typeof parsed.showGrid === 'boolean' ? parsed.showGrid : DEFAULT_SETTINGS.showGrid,
      showCameraGlyphs: typeof parsed.showCameraGlyphs === 'boolean' ? parsed.showCameraGlyphs : DEFAULT_SETTINGS.showCameraGlyphs,
      showThirds: typeof parsed.showThirds === 'boolean' ? parsed.showThirds : DEFAULT_SETTINGS.showThirds,
      showCenterGuide: typeof parsed.showCenterGuide === 'boolean' ? parsed.showCenterGuide : DEFAULT_SETTINGS.showCenterGuide,
      cameraControlMode: parsed.cameraControlMode === 'orbit' ? 'orbit' : DEFAULT_SETTINGS.cameraControlMode,
      lightRig: parsed.lightRig ?? null,
      lightingPresetId: typeof parsed.lightingPresetId === 'string' ? parsed.lightingPresetId : null,
      exposure: typeof parsed.exposure === 'number' && Number.isFinite(parsed.exposure)
        ? Math.max(0.3, Math.min(3, parsed.exposure))
        : DEFAULT_SETTINGS.exposure,
      skyboxId: typeof parsed.skyboxId === 'string' ? parsed.skyboxId : DEFAULT_SETTINGS.skyboxId,
      groundMode: parsed.groundMode === 'shadow' || parsed.groundMode === 'grass' || parsed.groundMode === 'off'
        ? parsed.groundMode
        : DEFAULT_SETTINGS.groundMode,
      fogEnabled: typeof parsed.fogEnabled === 'boolean' ? parsed.fogEnabled : DEFAULT_SETTINGS.fogEnabled,
      fogFar: typeof parsed.fogFar === 'number' && Number.isFinite(parsed.fogFar)
        ? Math.max(20, Math.min(120, parsed.fogFar))
        : DEFAULT_SETTINGS.fogFar,
      giEnabled: typeof parsed.giEnabled === 'boolean' ? parsed.giEnabled : DEFAULT_SETTINGS.giEnabled,
      giIntensity: typeof parsed.giIntensity === 'number' && Number.isFinite(parsed.giIntensity)
        ? Math.max(0, Math.min(2, parsed.giIntensity))
        : DEFAULT_SETTINGS.giIntensity,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // EDGE CASE: silent failure when localStorage is disabled, sandboxed, or quota exceeded leaves user unaware settings were not persisted
    // Ignore quota errors
  }
}

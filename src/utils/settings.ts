export interface UserSettings {
  perpetualFov: number;
  orbitSensitivity: number;
  uiZoom: number;
  showGrid: boolean;
  showCameraGlyphs: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  perpetualFov: 38,
  orbitSensitivity: 1.0,
  uiZoom: 125,
  showGrid: true,
  showCameraGlyphs: true,
};

const STORAGE_KEY = 'mc_render_user_settings';

export function loadSettings(): UserSettings {
  try {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const urlZoom = urlParams ? Number(urlParams.get('uiZoom')) : null;

    const raw = localStorage.getItem(STORAGE_KEY);
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
      uiZoom: effectiveZoom,
      showGrid: typeof parsed.showGrid === 'boolean' ? parsed.showGrid : DEFAULT_SETTINGS.showGrid,
      showCameraGlyphs: typeof parsed.showCameraGlyphs === 'boolean' ? parsed.showCameraGlyphs : DEFAULT_SETTINGS.showCameraGlyphs,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

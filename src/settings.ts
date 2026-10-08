/** Viewer preferences that persist between visits. Quality and theme keep their own modules. */
export interface ViewerSettings {
  /** Whether passive labels are on when a viewer opens or is reset. */
  labelsDefault: boolean;
  /** Most passive labels shown at once, at full zoom. */
  maxLabels: number;
  showFps: boolean;
}

export const SETTINGS_STORAGE_KEY = "muscle-map-settings";
export const MIN_LABELS = 1;
export const MAX_LABELS = 24;
export const defaultSettings: Readonly<ViewerSettings> = { labelsDefault: false, maxLabels: 12, showFps: false };

export function readSettings(): ViewerSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}");
    const max = Number(saved.maxLabels);
    return {
      labelsDefault: typeof saved.labelsDefault === "boolean" ? saved.labelsDefault : defaultSettings.labelsDefault,
      maxLabels: Number.isFinite(max) ? Math.round(Math.min(MAX_LABELS, Math.max(MIN_LABELS, max))) : defaultSettings.maxLabels,
      showFps: typeof saved.showFps === "boolean" ? saved.showFps : defaultSettings.showFps,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: ViewerSettings) {
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch { /* blocked storage keeps the session values */ }
}

/** Passive label allowance by zoom tier: half the maximum when zoomed out, all of it up close. */
export function passiveLabelCap(maxLabels: number, tier: 1 | 2 | 3) {
  return Math.max(1, Math.round(maxLabels * (tier === 1 ? .5 : tier === 2 ? .75 : 1)));
}

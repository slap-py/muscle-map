export type GraphicsChoice = "auto" | "high" | "low";
export type GraphicsTier = "high" | "low";
/** Auto's remembered answer to the slow-frame prompt: downgrade, or stop asking. */
export type AutoOverride = "low" | "keep" | null;

export const GRAPHICS_STORAGE_KEY = "muscle-map-graphics";
export const GRAPHICS_AUTO_KEY = "muscle-map-graphics-auto";

export interface GraphicsSettings {
  /** Upper bound applied to devicePixelRatio. */
  maxPixelRatio: number;
  /** Pixel ratio while the camera moves; null keeps the resting ratio. */
  movingPixelRatio: number | null;
  shadows: boolean;
  /** Jittered TAA samples accumulated at rest; 0 disables TAA. */
  taaSamples: number;
  /** Fetch muscle and exterior models only when their layers are shown. */
  lazyLayers: boolean;
  /** Build picking BVHs in a worker instead of on the main thread. */
  workerBvh: boolean;
  /** Pick hover at most once per animation frame. */
  throttleHover: boolean;
  /** Widen hover picking around subpixel vessels and nerves (clicks always do). */
  thinHoverAssist: boolean;
  maxPassiveLabels: number;
}

export const graphicsSettings: Record<GraphicsTier, GraphicsSettings> = {
  high: {
    maxPixelRatio: 2, movingPixelRatio: null, shadows: true, taaSamples: 32,
    lazyLayers: false, workerBvh: false, throttleHover: false, thinHoverAssist: true, maxPassiveLabels: 12,
  },
  low: {
    maxPixelRatio: 1, movingPixelRatio: 0.75, shadows: false, taaSamples: 0,
    lazyLayers: true, workerBvh: true, throttleHover: true, thinHoverAssist: false, maxPassiveLabels: 6,
  },
};

const choices = new Set<GraphicsChoice>(["auto", "high", "low"]);

export function readGraphicsChoice(): GraphicsChoice {
  try {
    const saved = localStorage.getItem(GRAPHICS_STORAGE_KEY);
    return saved && choices.has(saved as GraphicsChoice) ? saved as GraphicsChoice : "auto";
  } catch {
    return "auto";
  }
}

export function saveGraphicsChoice(choice: GraphicsChoice) {
  try { localStorage.setItem(GRAPHICS_STORAGE_KEY, choice); } catch { /* blocked storage keeps the session choice */ }
}

export function readAutoOverride(): AutoOverride {
  try {
    const saved = localStorage.getItem(GRAPHICS_AUTO_KEY);
    return saved === "low" || saved === "keep" ? saved : null;
  } catch {
    return null;
  }
}

export function saveAutoOverride(value: AutoOverride) {
  try {
    if (value) localStorage.setItem(GRAPHICS_AUTO_KEY, value);
    else localStorage.removeItem(GRAPHICS_AUTO_KEY);
  } catch { /* ignore */ }
}

export interface DeviceHints {
  /** Unmasked WebGL renderer string, when the browser exposes it. */
  gpu?: string;
  /** navigator.deviceMemory in GiB (Chromium only). */
  memory?: number;
  /** Automated browsers keep the baseline renderer so validation captures stay reproducible. */
  automated?: boolean;
}

/** Integrated, mobile and software GPUs. Intel Arc is discrete and excluded. */
const weakGpu = /swiftshader|llvmpipe|softpipe|software|microsoft basic render|mali|powervr|adreno \(tm\) [1-5]\d\d\b|intel(?!.*\barc\b)/i;

export function weakDeviceReason(hints: DeviceHints): string | null {
  if (hints.automated) return null;
  if (hints.gpu && weakGpu.test(hints.gpu)) return "integrated or software graphics";
  if (hints.memory !== undefined && hints.memory <= 4) return "limited device memory";
  return null;
}

export function resolveTier(choice: GraphicsChoice, weakReason: string | null, override: AutoOverride): GraphicsTier {
  if (choice !== "auto") return choice;
  return weakReason || override === "low" ? "low" : "high";
}

/** Rolling check for the Auto prompt: sustained camera motion below ~25 fps. */
export function createSlowFrameMonitor(sampleCount = 90, slowMs = 40) {
  const samples: number[] = [];
  return {
    /** Record one moving frame's duration; true once the window is full and slow. */
    add(ms: number) {
      // Ignore stalls (tab switches, GC pauses, asset installs) that are not render cost.
      if (!(ms > 0) || ms > 250) return false;
      samples.push(ms);
      if (samples.length > sampleCount) samples.shift();
      if (samples.length < sampleCount) return false;
      const sorted = [...samples].sort((a, b) => a - b);
      return sorted[sorted.length >> 1] > slowMs;
    },
    reset() { samples.length = 0; },
  };
}

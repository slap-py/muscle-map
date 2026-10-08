import * as THREE from "three";

export type ThemeChoice = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "muscle-map-theme";

const validChoices = new Set<ThemeChoice>(["system", "light", "dark"]);

export function readThemeChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved && validChoices.has(saved as ThemeChoice)
      ? (saved as ThemeChoice)
      : "system";
  } catch {
    return "system";
  }
}

export function effectiveTheme(choice?: ThemeChoice): EffectiveTheme {
  // The live document is authoritative after a choice, even if storage is
  // blocked or retains an older value. The head script restores it on reload.
  const attribute = document.documentElement.dataset.theme;
  choice ??= attribute === "light" || attribute === "dark" ? attribute : "system";
  if (choice === "light" || choice === "dark") return choice;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply the user choice and notify the scene. System is represented by no attribute. */
export function setThemeChoice(choice: ThemeChoice) {
  if (!validChoices.has(choice)) choice = "system";
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = choice;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Private browsing and blocked storage should not prevent theme switching.
  }
  window.dispatchEvent(new CustomEvent("themechange", {
    detail: { choice, effective: effectiveTheme(choice) },
  }));
}

export interface SceneTheme {
  background: string;
  hemisphereSky: string;
  hemisphereGround: string;
  hemisphereIntensity: number;
  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  shadowColor: string;
  shadowOpacity: number;
}

export const sceneThemes: Record<EffectiveTheme, SceneTheme> = {
  // Scene backgrounds match the CSS canvas tokens; anatomy lighting is retained.
  light: {
    background: "#f7f5f0",
    hemisphereSky: "#fff7e8",
    hemisphereGround: "#9d8d7b",
    hemisphereIntensity: 2.3,
    keyColor: "#fff2db",
    keyIntensity: 3.4,
    fillColor: "#dcecf3",
    fillIntensity: 1.6,
    shadowColor: "#6e583e",
    shadowOpacity: 0.12,
  },
  dark: {
    background: "#2e2b27",
    hemisphereSky: "#e7f1fa",
    hemisphereGround: "#58636f",
    hemisphereIntensity: 2.75,
    keyColor: "#fff4e5",
    keyIntensity: 3.4,
    fillColor: "#e4f3ff",
    fillIntensity: 2,
    shadowColor: "#56616d",
    shadowOpacity: 0.045,
  },
};

export interface SceneThemeTargets {
  renderer: THREE.WebGLRenderer;
  hemisphere: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
}

export function applySceneTheme(targets: SceneThemeTargets, theme = effectiveTheme()) {
  const values = sceneThemes[theme];
  targets.renderer.domElement.dataset.sceneTheme = theme;
  // Keep the canvas transparent so the CSS token supplies the background. This preserves the original light render path while allowing the scene color to be inspected or used by alternate renderers.
  targets.renderer.setClearColor(values.background, 0);
  targets.hemisphere.color.set(values.hemisphereSky);
  targets.hemisphere.groundColor.set(values.hemisphereGround);
  targets.hemisphere.intensity = values.hemisphereIntensity;
  targets.key.color.set(values.keyColor);
  targets.key.intensity = values.keyIntensity;
  targets.fill.color.set(values.fillColor);
  targets.fill.intensity = values.fillIntensity;
  targets.floor.material.color.set(values.shadowColor);
  targets.floor.material.opacity = values.shadowOpacity;
  targets.floor.material.needsUpdate = true;
}

export function listenForThemeChanges(onChange: (theme: EffectiveTheme) => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const update = (event?: Event) => {
    const detail = (event as CustomEvent<{ effective?: EffectiveTheme }> | undefined)?.detail;
    onChange(detail?.effective ?? effectiveTheme());
  };
  window.addEventListener("themechange", update);
  const mediaUpdate = () => update();
  media.addEventListener("change", mediaUpdate);
  return () => {
    window.removeEventListener("themechange", update);
    media.removeEventListener("change", mediaUpdate);
  };
}

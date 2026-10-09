/** Shared between lazy route startup and model downloads. */
import { brandLockup } from "./branding";

export function loadingScreen(title: string) {
  return `<div id="loading" role="status" aria-live="polite"><div class="loading-brand">${brandLockup}</div><h1>${title}</h1><div class="loading-bar" aria-hidden="true"></div><p>Loading models…</p><button type="button" class="button" data-home>Back to Browser</button></div>`;
}

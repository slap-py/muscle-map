/** Shared between lazy route startup and model downloads. */
export const brandMark = '<svg class="brand-mark" viewBox="0 0 20 20" aria-hidden="true"><path d="M12 2c3-1 5 1 4 4l-2 5c-1 2 0 4-2 6-2 2-6 1-6-2 0-2 2-4 3-6s0-6 3-7Z"/><path d="m9 9 5 2"/></svg>';

export function loadingScreen(title: string) {
  return `<div id="loading" role="status" aria-live="polite">${brandMark}<h1>${title}</h1><div class="loading-bar" aria-hidden="true"></div><p>Loading models…</p><a href="#/">Back to home</a></div>`;
}

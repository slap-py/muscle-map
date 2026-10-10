import { brandLockup } from "./branding";
import { mainNavigation, siteFooter } from "./siteChrome";
import "./phoneScreen.css";

// Portrait phones and short touch screens in landscape; tablets remain supported.
export const phoneScreenQuery = "(max-width: 767px), (max-height: 499px) and (pointer: coarse)";

export function phoneScreenNotice() {
  return `<div class="phone-screen-page">
    <header class="phone-screen-header"><a class="phone-screen-brand" href="#/" aria-label="Fabrica home">${brandLockup}</a>${mainNavigation(location.hash)}</header>
    <main class="phone-screen-main" aria-labelledby="phone-screen-title">
      <div class="phone-screen-content">
        <svg class="phone-screen-icon" viewBox="0 0 80 64" aria-hidden="true"><rect x="4" y="6" width="50" height="34" rx="3"/><path d="M29 40v12M18 52h22"/><rect x="46" y="24" width="30" height="34" rx="3"/><path d="M58 52h6"/></svg>
        <h1 id="phone-screen-title">A little more room to explore</h1>
        <p>Fabrica is not designed to be used on phone-size screens. Please switch to a computer or tablet to use the browser and 3D editor.</p>
        <a class="intro-button intro-button-secondary" href="#/">Back to home</a>
      </div>
    </main>
    ${siteFooter}
  </div>`;
}

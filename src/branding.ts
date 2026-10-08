import logoUrl from "../output/branding/fabrica-logo-wordmark.png";

// CSS clips the symbol from the original artwork; its pixels stay unchanged.
// The wordmark is live Manrope text rather than the generated image lettering.
export const brandMark = `<span class="brand-mark" aria-hidden="true"><img src="${logoUrl}" alt="" width="2172" height="724"/></span>`;
export const brandLockup = `${brandMark}<span class="brand-wordmark">Fabrica</span>`;

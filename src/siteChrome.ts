/** Shared destinations and attribution for every app surface. */
export function mainNavigation(current = "") {
  return `<nav class="site-nav" aria-label="Main navigation">${[["#/browser", "Browser"], ["#/how-it-works", "How it works"]].map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join("")}</nav>`;
}
export const siteFooter = `<footer class="site-footer"><p>Models adapted from Z-Anatomy / BodyParts3D.</p><a href="#/credits">Sources &amp; credits</a></footer>`;

/** Skip link for keyboard users. Hash routing owns location.hash, so binding moves focus instead of navigating. */
export const skipLink = (targetId: string) => `<a class="skip-link" href="#${targetId}">Skip to main content</a>`;
export function bindSkipLink(root: HTMLElement) {
  const link = root.querySelector<HTMLAnchorElement>(".skip-link");
  link?.addEventListener("click", event => {
    event.preventDefault();
    const main = root.querySelector<HTMLElement>(`#${link.hash.slice(1)}`);
    main?.setAttribute("tabindex", "-1");
    main?.focus();
  });
}

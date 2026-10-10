/** Shared destinations and attribution for every app surface. */
export function mainNavigation(current = "") {
  return `<nav class="site-nav" aria-label="Main navigation">${[["#/browser", "Browser"], ["#/how-it-works", "How it works"]].map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`).join("")}</nav>`;
}
export const siteFooter = `<footer class="site-footer"><p>Models adapted from Z-Anatomy / BodyParts3D.</p><a href="#/credits">Sources &amp; credits</a></footer>`;

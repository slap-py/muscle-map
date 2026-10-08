const sideOfId = (id: string) => id.startsWith('left-') ? 'left' : 'right';
const isUpperId = (id: string) => id.endsWith('upper-leg');

/** "Right Leg" for a side's upper and lower leg; otherwise a count, since mixed selections have no shared name. */
export function combinedTitleForIds(ids: readonly string[]) {
  const sides = new Set(ids.map(sideOfId));
  if (sides.size === 1) {
    const side = sideOfId(ids[0]) === 'left' ? 'Left' : 'Right';
    if (ids.length === 2 && ids.some(isUpperId) && ids.some(id => !isUpperId(id))) return `${side} Leg`;
  }
  return `${ids.length} Body Regions`;
}

import { describe, expect, it } from 'vitest';
import { combineRegionPacks } from '../src/regions/combine';
import { lowerLegPack } from '../src/regions/lower-leg';
import { leftLowerLegPack } from '../src/regions/left-lower-leg';
import rightUpperLegPack from '../src/regions/upper-leg/right';
import { resolveStructureId, restoreViewerSession, selectionAliases, type ViewerSession } from '../src/viewerSession';

const session: ViewerSession = {
  regionIds: ['lower-leg'], selectedAliases: ['lower-leg:vein-great-saphenous'],
  layers: ['bone','muscle','artery','vein','nerve'], atlasTypes: ['vein','nerve'],
  atlasRegion: 'lower-leg:leg', search: 'saphenous', onlyVisible: true,
  opacity: .2, skinOpacity: .5, neurovascularOpacity: .6, labels: false,
  highlightConnections: true, view: 'medial', viewDirection: 'medial', overview: false,
};
describe('region changes during exploration', () => {
  const combined = combineRegionPacks([lowerLegPack,rightUpperLegPack]);
  it('retains layers, opacity, labels, filters and the full shared selection when adding a region', () => {
    expect(restoreViewerSession(combined,session)).toMatchObject({ ...session, selected:'lower-leg:vein-great-saphenous' });
  });
  it('moves a shared selection to the remaining region and resets unavailable area filters', () => {
    const saved = { ...session, regionIds: combined.regionIds!, selectedAliases: selectionAliases(combined,'lower-leg:vein-great-saphenous') };
    expect(restoreViewerSession(rightUpperLegPack,saved)).toMatchObject({selected:'great-saphenous-vein',atlasRegion:'all',view:'medial'});
    expect(restoreViewerSession(lowerLegPack,saved)).toMatchObject({selected:'vein-great-saphenous',atlasRegion:'leg'});
  });
  it('clears removed selections and starts a fresh session for unrelated regions', () => {
    expect(restoreViewerSession(rightUpperLegPack,{...session,regionIds:combined.regionIds!,selectedAliases:['lower-leg:talus']})!.selected).toBeNull();
    expect(restoreViewerSession(leftLowerLegPack,session)).toBeUndefined();
    expect(resolveStructureId(combined,'right-upper-leg:great-saphenous-vein')).toBe('lower-leg:vein-great-saphenous');
    expect(resolveStructureId(lowerLegPack,'lower-leg:talus')).toBe('talus');
    expect(resolveStructureId(lowerLegPack,'missing')).toBeNull();
  });
  it('maps regional overviews to the new combined overview', () => {
    expect(restoreViewerSession(combined,{...session,view:'foot',overview:true})!.view).toBe(combined.defaultView);
  });
});

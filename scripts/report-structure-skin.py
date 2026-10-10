"""Attach current measured acceptance results to published skin manifests."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8-sig'))
def write(path,value):(ROOT/path).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
visual_review=read('validation/skin-visual-review.json')
summary={}
for side in ['right','left']:
 build=read(f'output/skin/{side}/build.json')
 mesh=read(f'validation/skin-mesh-{side}.json')
 geometry=read(f'validation/skin-geometry-{side}.json')
 enclosure=read(f'validation/skin-enclosure-{side}.json')
 clearance=read(f'validation/skin-clearance-{side}.json')
 containment=enclosure['containment']
 directories=[Path('public/models')/('left-lower-leg' if side=='left' else ''),Path(f'public/models/{side}-upper-leg')]
 for region,directory in zip(['lower','upper'],directories):
  glb=ROOT/directory/'exterior.glb';actual=hashlib.sha256(glb.read_bytes()).hexdigest()
  assert actual==enclosure['sourceGlbs'][region]['sha256'],f'{side} {region}: stale enclosure report'
  manifest=read(directory/'exterior.manifest.json')
  assert actual==manifest['glbSha256'],f'{side} {region}: stale manifest'
  manifest['acceptance']={
   'allOriginalSourceContainment':containment['sourceAllContainmentCriterion'],
   'studyCropContainment':dict(fraction=containment['eligibleContainmentFraction'],outliers=containment['outsideCount'],**containment['eligibleContainmentCriterion']),
   'proximalCropExcludedVertices':containment['crop']['excludedCount'],
   'clearance':{k:clearance[k] for k in ['method','samples','toleranceMm','maximumDeviationFromIntendedMm','fractionWithinHalfMm','passed']},
   'toes':[{k:t[k] for k in ['pair','fractionWithGapAtLeastHalfMm','passed']} for t in geometry['toes']],
   'landmarks':enclosure['landmarks'],
   'seam':enclosure['seams'],
   'hausdorff':{k:mesh['hausdorff'][k] for k in ['limitMm','measuredMaxMm','upperBoundMm','passed']},
   'sampledSelfIntersections':{k:v for k,v in mesh['selfIntersections'].items() if k!='intersections'},
   'visualReview':{'report':'validation/skin-visual-review.json','passed':visual_review['visualAcceptancePassed'],'noFlapsAndThinBridges':visual_review['findings']['noFlapsAndThinBridges']},
   'mirrorCertification':{'passed':None,'note':'Sampled diagnostic only; native source differences and raster/simplification error are reported, not certified as exact reflection.'},
   'initial150kTriangleGoalMet':build['simplification']['triangles']<=150000,
   'allCriteriaPassed':False,
   'limitations':['The groin study cut intentionally leaves proximal source context outside the envelope.','The photo-guided soft-tissue and rounded toe profiles have variable source clearance; the original uniform-clearance criterion remains independently measured.','The original 2-4 mm landmark bands are not met by the fuller contour; actual distances are recorded.']+(['The original 150k triangle goal remains unmet on this side.'] if build['simplification']['triangles']>150000 else [])+([visual_review['findings']['noFlapsAndThinBridges']['note']] if not visual_review['findings']['noFlapsAndThinBridges']['passed'] else [])}
  manifest['mirrorDiagnosticReport']=f'validation/skin-enclosure-{side}.json'
  manifest['visualReports']=visual_review.get('reports',[f'validation/skin-visual-final-{side}/skin-visual-browser-check.json','validation/skin-cut-caps/report.json'])
  manifest['loadBudgetReport']='validation/skin-load-budget.json'
  write(directory/'exterior.manifest.json',manifest)
  if directory!=Path('public/models'):
   parent_path=directory/'manifest.json';parent=read(parent_path)
   for record in parent.get('exports',[])+parent.get('assets',[]):
    if record.get('asset')=='exterior' or record.get('group')=='exterior':
     record['bytes']=glb.stat().st_size
     record['glbSha256' if 'glbSha256' in record else 'sha256']=actual
   parent['skinDerivative']=dict(source='structure-envelope',manifest='exterior.manifest.json',sha256=actual,bytes=glb.stat().st_size)
   for key in ['limitations','notes']:
    if isinstance(parent.get(key),list):parent[key]=[line.replace('crest/heel clearance and uniform clearance acceptance remain unmet','uniform clearance acceptance remains unmet') for line in parent[key]]
   write(parent_path,parent)
 summary[side]=dict(triangles=build['simplification']['triangles'],pieces=build['pieces'],cropContainment=containment['eligibleContainmentFraction'],cropOutliers=containment['outsideCount'],allContainment=containment['sourceAllContainmentFraction'],croppedVertices=containment['crop']['excludedCount'],toeFractions=[t['fractionWithGapAtLeastHalfMm'] for t in geometry['toes']],landmarkDistances=[l['skinDistanceMm'] for l in enclosure['landmarks']['landmarks']],clearanceFraction=clearance['fractionWithinHalfMm'],clearanceMaximumDeviationMm=clearance['maximumDeviationFromIntendedMm'],hausdorff=manifest['acceptance']['hausdorff'],seamUpperMm=enclosure['seams']['maxNearestMm'],visualAcceptancePassed=visual_review['visualAcceptancePassed'],visualReview='validation/skin-visual-review.json',allCriteriaPassed=False)
write('validation/skin-acceptance-summary.json',summary)
print(json.dumps({side:{k:v for k,v in record.items() if k!='pieces'} for side,record in summary.items()},indent=2))

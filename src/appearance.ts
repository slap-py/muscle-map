import * as THREE from 'three';
/** Coverage transparency keeps overlapping anatomy in the depth buffer and avoids
 * camera-dependent object sorting and the former 80% depth-write threshold. */
export function applyCoverage(mesh: THREE.Mesh, alpha: number) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  const hashed = alpha < 1;
  if(mat.alphaHash !== hashed || mat.transparent) {mat.alphaHash=hashed;mat.transparent=false;mat.needsUpdate=true;}
  mat.opacity=alpha;mat.depthWrite=true;mat.depthTest=true;
  // Match shadow coverage to visible coverage instead of casting opaque silhouettes.
  let depth = mesh.customDepthMaterial as THREE.MeshDepthMaterial | undefined;
  if(!depth) {
    depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
    const coverage={value:alpha};depth.userData.coverage=coverage;
    // RGBA-packed depth does not consume Material.opacity in Three's stock shader.
    depth.onBeforeCompile=shader=>{
      shader.uniforms.coverageAlpha=coverage;
      shader.fragmentShader='uniform float coverageAlpha;\n'+shader.fragmentShader.replace('vec4 diffuseColor = vec4( 1.0 );','vec4 diffuseColor = vec4( 1.0, 1.0, 1.0, coverageAlpha );');
    };
    depth.customProgramCacheKey=()=> 'anatomy-coverage-depth-v1';
    mesh.customDepthMaterial=depth;
  }
  depth.userData.coverage.value=alpha;
  if(depth.alphaHash !== hashed) {depth.alphaHash=hashed;depth.needsUpdate=true;}
  depth.opacity=alpha;
  mesh.castShadow=!mesh.userData.fiber && mesh.userData.id !== "skin";
  mesh.renderOrder=0;
}

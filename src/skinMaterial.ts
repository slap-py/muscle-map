import * as THREE from 'three';

// Shading detail only: authored positions, indices, normals and cut boundaries stay intact.
const atlas = { xMin: -80, xSpan: 280, zMin: -100, zSpan: 200 };
type Side = 'right' | 'left';
const smooth = (a: number, b: number, x: number) => { const t = THREE.MathUtils.clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

// Object-space noise has no UV seams or stretched pores on the thigh/calf.
// The fine relief fades with pixel footprint, so distant skin stays quiet.
const skinShader = /* glsl */`
varying vec3 vSkinPosition;
float skinHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float skinNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(skinHash(i), skinHash(i+vec3(1,0,0)),f.x),
                 mix(skinHash(i+vec3(0,1,0)),skinHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(skinHash(i+vec3(0,0,1)),skinHash(i+vec3(1,0,1)),f.x),
                 mix(skinHash(i+vec3(0,1,1)),skinHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;

function addSkinShading(material: THREE.MeshPhysicalMaterial, dorsal: boolean) {
  material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vSkinPosition;' + (dorsal ? '\nattribute float skinDorsal;\nvarying float vSkinDorsal;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkinPosition = position;' + (dorsal ? '\nvSkinDorsal = skinDorsal;' : ''));
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\n' + skinShader + (dorsal ? '\nvarying float vSkinDorsal;' : ''));
    if (dorsal) {
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;','diffuseColor *= vec4(mix(vec3(1.0), sampledDiffuseColor.rgb, vSkinDorsal), sampledDiffuseColor.a);'))
        .replace('#include <normal_fragment_maps>',THREE.ShaderChunk.normal_fragment_maps.replace('dHdxy_fwd(),','dHdxy_fwd() * vSkinDorsal,'));
    }
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float skinTone = skinNoise(vSkinPosition * 0.075);
        float skinGrain = skinNoise(vSkinPosition * 1.2);
        float skinFootprint = max(length(dFdx(vSkinPosition)), length(dFdy(vSkinPosition)));
        float skinDetail = 1.0 - smoothstep(0.3, 0.9, skinFootprint);
        diffuseColor.rgb *= vec3(1.0 + (skinTone-.5)*.065, 1.0 + (skinTone-.5)*.040, 1.0 + (skinTone-.5)*.025);
        diffuseColor.rgb *= 1.0 + (skinGrain-.5)*.05*skinDetail;
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (skinTone-.5)*.08, .75, .93);
      `)
      .replace('#include <lights_physical_fragment>', `
        float skinHeight = (skinGrain-.5)*.06;
        vec3 skinDx = dFdx(-vViewPosition), skinDy = dFdy(-vViewPosition);
        vec3 skinR1 = cross(normalize(skinDy), normal), skinR2 = cross(normal, normalize(skinDx));
        float skinDet = dot(normalize(skinDx), skinR1) * faceDirection;
        vec2 skinSlope = vec2(dFdx(skinHeight),dFdy(skinHeight)) / max(vec2(length(skinDx),length(skinDy)),vec2(.0001));
        normal = normalize(abs(skinDet)*normal - sign(skinDet)*(skinSlope.x*skinR1+skinSlope.y*skinR2)*skinDetail);
        #include <lights_physical_fragment>
      `);
  };
  material.customProgramCacheKey=()=> dorsal ? 'skin-natural-dorsal-v2' : 'skin-natural-v2';
}

type TextureLoader = (url: string, loaded: () => void, failed: (error: unknown) => void) => THREE.Texture;
const loadTexture: TextureLoader = (url, loaded, failed) => {
  if (typeof document === 'undefined') { loaded(); return new THREE.Texture(); }
  return new THREE.TextureLoader().load(url, loaded, undefined, failed);
};
export function createSkinMaterial(geometry: THREE.BufferGeometry, cap: boolean, load: TextureLoader = loadTexture): THREE.MeshStandardMaterial {
  const material=new THREE.MeshPhysicalMaterial({color:cap?'#b87362':'#c49c8d',roughness:cap ? .8 : .84,specularIntensity:cap ? 1 : .35,flatShading:cap,side:THREE.FrontSide});
  if (cap) return material;
  const bounds=geometry.boundingBox;
  const dorsal=!!bounds && bounds.max.x>=150 && bounds.min.y<=-30 && bounds.max.y>=300 && !!geometry.getAttribute('normal');
  addSkinShading(material,dorsal);
  // Upper pieces have their own femur frame: never project foot/nail maps onto them.
  if (!dorsal) return material;
  const side: Side=bounds!.getCenter(new THREE.Vector3()).z<0?'left':'right';
  const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
  const uv=new Float32Array(position.count*2),mask=new Float32Array(position.count);
  for(let i=0;i<position.count;i++) {
    uv[i*2]=(position.getX(i)-atlas.xMin)/atlas.xSpan;
    uv[i*2+1]=(position.getZ(i)-atlas.zMin)/atlas.zSpan;
    mask[i]=smooth(.05,.65,normal.getY(i))*(1-smooth(-12,22,position.getY(i)));
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.setAttribute('skinDorsal',new THREE.BufferAttribute(mask,1));
  const readiness: Promise<void>[]=[];
  const map=(kind: string)=>{
    let texture!: THREE.Texture;
    readiness.push(new Promise<void>((resolve,reject)=>{ texture=load(`${import.meta.env.BASE_URL}models/skin-detail/${side}-${kind}.png`,resolve,reject); }));
    return texture;
  };
  material.map=map('color');material.bumpMap=map('bump');material.bumpScale=2;
  material.userData.skinTextureReady=Promise.all(readiness);
  material.userData.skinTextureReady.catch(() => {});
  return material;
}


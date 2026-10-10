import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createAnkle } from "../src/ankle";
import { createRegionAssetLoaders } from "../src/assets";
import { chooseDepthAwareHit, enableMeshPicking } from "../src/picking";
import { applyCoverage } from "../src/appearance";
import type { Structure } from "../src/data";
import { combineRegionPacks } from "../src/regions/combine";
import { lowerLegPack } from "../src/regions/lower-leg";
import rightUpperLegPack from "../src/regions/upper-leg/right";
import leftUpperLegPack from "../src/regions/upper-leg/left";
import { disposeObject } from "../src/viewerResources";

const skin: Structure = {
  id: "skin", name: "Skin", tissue: "skin", region: "Lower leg", group: "Surface",
  description: "surface", role: "surface", connection: "surface", hint: "surface",
};


function skinScene(capEnds: readonly string[]) {
  const scene = new THREE.Group();
  const field = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshStandardMaterial());
  field.userData = { atlasId: "skin", source: "structure-envelope" };
  scene.add(field);
  for (const end of capEnds) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.1, .01, .1), new THREE.MeshStandardMaterial());
    cap.name = "skin-cap-" + end;
    cap.userData = { atlasId: "skin", skinCap: true, capEnd: end, source: "structure-envelope" };
    scene.add(cap);
  }
  return scene;
}
describe("imported skin viewer integration", () => {
  it("preserves authored normals and includes skin and caps in accelerated occlusion builds", async () => {
    const model = createAnkle();
    const loaders = createRegionAssetLoaders([skin], { bones: [], muscles: [], exterior: ["skin"], neurovascular: [] });
    const scene = new THREE.Group();
    const field = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshStandardMaterial());
    field.userData = { atlasId: "skin", source: "structure-envelope" };
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.1, .01, .1), new THREE.MeshStandardMaterial());
    cap.name = "skin-cap-seam";
    cap.userData = { atlasId: "skin", skinCap: true, capEnd: "seam", source: "structure-envelope" };
    scene.add(field, cap);
    const bvhMeshes: THREE.Mesh[][] = [];
    const report = await loaders.loadExteriorAssets(model.parts, undefined, async meshes => { bvhMeshes.push(meshes); }, "skin.glb", async () => scene);
    expect(report.loaded).toEqual(["skin"]);
    expect(bvhMeshes[0]).toHaveLength(2);
    expect(bvhMeshes[0].every(mesh => mesh.userData.skinSurface)).toBe(true);
    const meshes = model.parts.get("skin")!.meshes;
    expect(meshes).toHaveLength(2);
    expect(meshes[0].geometry.getAttribute("normal")).toBeDefined();
    expect(meshes.some(mesh => mesh.userData.skinSurface === true)).toBe(true);
    const importedCap = meshes.find(mesh => mesh.userData.skinCap);
    expect(importedCap?.userData.capEnd).toBe("seam");
    expect((importedCap?.material as THREE.MeshPhysicalMaterial).side).toBe(THREE.FrontSide);
    expect((importedCap?.material as THREE.MeshPhysicalMaterial).flatShading).toBe(true);
  });

  it("uses transparent depth coverage for skin below full opacity", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    mesh.userData = { id: "skin", skinSurface: true };
    applyCoverage(mesh, .4);
    expect(mesh.material.transparent).toBe(true);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.renderOrder).toBe(10);
    expect(mesh.castShadow).toBe(false);
    mesh.geometry.dispose(); mesh.material.dispose(); mesh.customDepthMaterial?.dispose();
  });

  it("skips translucent skin and cap hits when deeper anatomy is available", () => {
    const skinParent = new THREE.Group();
    skinParent.userData.alpha = .5;
    const skinMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    skinMesh.userData = { id: "skin", skinSurface: true };
    skinParent.add(skinMesh);
    const bone = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    bone.userData = { id: "tibia" };
    const hit = (object: THREE.Object3D, distance: number) => ({ object, distance } as THREE.Intersection);
    expect(chooseDepthAwareHit([hit(skinMesh, 1), hit(bone, 2)])!.object.userData.id).toBe("tibia");
    skinParent.userData.alpha = .8;
    expect(chooseDepthAwareHit([hit(skinMesh, 1)])!.object.userData.id).toBe("skin");
    const cap = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
    cap.name = "skin-cap-proximal";
    cap.userData = { id: "skin", skinCap: true };
    expect(chooseDepthAwareHit([hit(cap, 1)])).toBeUndefined();
  });

  it("hides paired seam caps while retaining outer proximal caps", async () => {
    const paired = combineRegionPacks([lowerLegPack, rightUpperLegPack]);
    const model = paired.createAnkle();
    try {
      await paired.loaders.loadExteriorAssets(model.parts, undefined, undefined, "combined.glb", async url =>
        skinScene(url.includes("right-upper-leg") ? ["seam", "proximal"] : ["seam"]));
      const lowerCaps = model.parts.get("lower-leg:skin")!.meshes.filter(mesh => mesh.userData.skinCap);
      const upperCaps = model.parts.get("right-upper-leg:skin")!.meshes.filter(mesh => mesh.userData.skinCap);
      expect(lowerCaps.find(mesh => mesh.userData.capEnd === "seam")?.userData.combineCapHidden).toBe(true);
      expect(upperCaps.find(mesh => mesh.userData.capEnd === "seam")?.userData.combineCapHidden).toBe(true);
      expect(upperCaps.find(mesh => mesh.userData.capEnd === "proximal")?.userData.combineCapHidden).toBe(false);
    } finally {
      disposeObject(model.root);
    }

    const unpaired = combineRegionPacks([leftUpperLegPack, rightUpperLegPack]);
    const upperModel = unpaired.createAnkle();
    try {
      await unpaired.loaders.loadExteriorAssets(upperModel.parts, undefined, undefined, "combined.glb", async () =>
        skinScene(["seam", "proximal"]));
      for (const id of ["left-upper-leg:skin", "right-upper-leg:skin"]) {
        expect(upperModel.parts.get(id)!.meshes.filter(mesh => mesh.userData.skinCap)
          .every(mesh => mesh.userData.combineCapHidden === false)).toBe(true);
      }
    } finally {
      disposeObject(upperModel.root);
    }
  });});



it("uses skin's own opacity when an independently opaque cap shares its parent",()=>{
 const parent=new THREE.Group();parent.userData.alpha=1;
 const skin=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 skin.userData={atlasId:'skin',alpha:.2};parent.add(skin);
 const cap=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 cap.name='skin-cap-seam';cap.userData.alpha=1;parent.add(cap);
 const hit=(object:THREE.Object3D,distance:number)=>({object,distance} as THREE.Intersection);
 expect(chooseDepthAwareHit([hit(cap,1),hit(skin,2)])).toBeUndefined();
 skin.userData.alpha=1;
 expect(chooseDepthAwareHit([hit(cap,1),hit(skin,2)])?.object).toBe(skin);
 enableMeshPicking(skin);enableMeshPicking(cap);
 expect(skin.geometry.boundsTree).toBeDefined();expect(cap.geometry.boundsTree).toBeDefined();
 skin.geometry.dispose();cap.geometry.dispose();skin.material.dispose();cap.material.dispose();
});

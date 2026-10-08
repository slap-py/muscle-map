import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lowerLegPack, attachmentRecords as rightAttachmentRecords } from "../src/regions/lower-leg";
import { leftLowerLegPack, attachmentRecords as leftAttachmentRecords, createAnkle as createLeftAnkle } from "../src/regions/left-lower-leg";

const expectMirrored = (actual: readonly number[], right: readonly number[]) => {
  expect(actual[0]).toBeCloseTo(right[0], 5);
  expect(actual[1]).toBeCloseTo(right[1], 5);
  expect(actual[2]).toBeCloseTo(-right[2], 5);
};

describe("left lower-leg region pack", () => {
  it("clones the source metadata and uses a separate asset namespace", () => {
    expect(leftLowerLegPack.id).toBe("left-lower-leg");
    expect(leftLowerLegPack.title).toBe("Left Lower Leg & Foot");
    expect(leftLowerLegPack.structures.map(s => s.id)).toEqual(lowerLegPack.structures.map(s => s.id));
    expect(leftLowerLegPack.assets.bones).toMatch(/models\/left-lower-leg\/bones\.glb$/);
    expect(leftLowerLegPack.assets.muscles).toMatch(/models\/left-lower-leg\/muscles\.glb$/);
    expect(leftLowerLegPack.about.overview.toLowerCase()).not.toContain("right foot");
    expect(leftLowerLegPack.about.overview).toContain("mirrored derivative");
    expect(leftLowerLegPack.about.controls).toEqual(lowerLegPack.about.controls);
    expect(leftLowerLegPack.about.controlsHtml).toBe(lowerLegPack.about.controlsHtml);
    const rightRecord = rightAttachmentRecords.find(record => record.id === "atfl:anterior-talofibular")!;
    const leftRecord = leftAttachmentRecords.find(record => record.id === rightRecord.id)!;
    expect(leftRecord.from.seedMm).toEqual([rightRecord.from.seedMm[0], rightRecord.from.seedMm[1], -rightRecord.from.seedMm[2]]);
    expect(leftRecord.normal).toEqual([rightRecord.normal[0], rightRecord.normal[1], -rightRecord.normal[2]]);
    expect(rightRecord.from.seedMm).toEqual([-7, 0, 28]);
  });

  it("flips side directions and camera poses across the anatomical Z plane", () => {
    const rightDirections = new Map(lowerLegPack.directions.map(direction => [direction.id, direction.v]));
    for (const direction of leftLowerLegPack.directions) {
      const right = rightDirections.get(direction.id)!;
      expect(direction.v).toEqual([right[0], right[1], -right[2]]);
    }
    for (const id of Object.keys(lowerLegPack.cameraViews)) {
      const right = lowerLegPack.cameraViews[id], left = leftLowerLegPack.cameraViews[id];
      expect(left).toEqual([right[0], right[1], -right[2]]);
      const rightPose = lowerLegPack.cameraPreset(id, 1.3), leftPose = leftLowerLegPack.cameraPreset(id, 1.3);
      expect(leftPose.target.toArray()).toEqual([rightPose.target.x, rightPose.target.y, -rightPose.target.z]);
      expect(leftPose.position.toArray()).toEqual([rightPose.position.x, rightPose.position.y, -rightPose.position.z]);
    }
  });

  it("mirrors procedural geometry, winding, anchors, and resolved footprints without mutating the source pack", () => {
    const sourceStructures = JSON.stringify(lowerLegPack.structures);
    const sourceDirections = JSON.stringify(lowerLegPack.directions);
    const sourceScene = {
      initial: lowerLegPack.scene.initialCamera.toArray(),
      key: lowerLegPack.scene.keyPosition.toArray(),
    };
    const right = lowerLegPack.createAnkle();
    const left = createLeftAnkle();
    const rightTibia = right.parts.get("tibia")!;
    const leftTibia = left.parts.get("tibia")!;
    expectMirrored(leftTibia.anchor.toArray(), rightTibia.anchor.toArray());
    const rightBox = new THREE.Box3().setFromObject(rightTibia.group);
    const leftBox = new THREE.Box3().setFromObject(leftTibia.group);
    expectMirrored(leftBox.min.toArray(), [rightBox.min.x, rightBox.min.y, rightBox.max.z]);
    expectMirrored(leftBox.max.toArray(), [rightBox.max.x, rightBox.max.y, rightBox.min.z]);
    const rightIndex = rightTibia.meshes[0].geometry.index!;
    const leftIndex = leftTibia.meshes[0].geometry.index!;
    expect(leftIndex.getX(0)).toBe(rightIndex.getX(0));
    expect(leftIndex.getX(1)).toBe(rightIndex.getX(2));
    expect(leftIndex.getX(2)).toBe(rightIndex.getX(1));
    expect(leftTibia.meshes[0].geometry.boundsTree).toBeDefined();
    const rightSpring = right.parts.get("spring")!.meshes[0].userData.fromFootprint;
    const leftSpring = left.parts.get("spring")!.meshes[0].userData.fromFootprint;
    expectMirrored(leftSpring.centerMm, rightSpring.centerMm);
    expectMirrored(leftSpring.normal, rightSpring.normal);
    expect(JSON.stringify(lowerLegPack.structures)).toBe(sourceStructures);
    expect(JSON.stringify(lowerLegPack.directions)).toBe(sourceDirections);
    expect(lowerLegPack.scene.initialCamera.toArray()).toEqual(sourceScene.initial);
    expect(lowerLegPack.scene.keyPosition.toArray()).toEqual(sourceScene.key);
  });
});
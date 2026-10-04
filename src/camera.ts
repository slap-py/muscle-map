import * as THREE from "three";
import CameraControls from "camera-controls";

CameraControls.install({ THREE });

/** Match Cell Simulator's CameraRig zoom damping and cursor-centered dolly. */
export function createCameraControls(
  camera: THREE.PerspectiveCamera,
  element?: HTMLElement,
) {
  const controls = new CameraControls(camera, element);
  controls.smoothTime = 0.25;
  controls.draggingSmoothTime = 0.125;
  controls.dollyToCursor = true;
  controls.minDistance = 2;
  controls.maxDistance = 3000;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.mouseButtons.right = CameraControls.ACTION.TRUCK;
  controls.touches.two = CameraControls.ACTION.TOUCH_DOLLY_TRUCK;
  return controls;
}

export function zoomBy(controls: CameraControls, factor: number) {
  // Accumulate rapid clicks against the destination, not an intermediate frame.
  const destination = controls
    .getPosition(new THREE.Vector3(), true)
    .distanceTo(controls.getTarget(new THREE.Vector3(), true));
  void controls.dollyTo(
    THREE.MathUtils.clamp(
      destination * factor,
      controls.minDistance,
      controls.maxDistance,
    ),
    true,
  );
}

export function updateCamera(
  controls: CameraControls,
  camera: THREE.PerspectiveCamera,
  dt: number,
) {
  const changed = controls.update(dt);
  // As in Cell Explorer, maintain depth precision while inspecting small structures.
  camera.near = THREE.MathUtils.clamp(controls.distance * 0.01, 0.05, 100);
  camera.far = camera.near * 1e5;
  camera.updateProjectionMatrix();
  return changed;
}

export { CameraControls };


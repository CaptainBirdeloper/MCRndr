import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraItem } from '../../types';

export interface ManagedCamera {
  id: string;
  name: string;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  helper: THREE.CameraHelper;
  visible: boolean;
}

export interface CameraManager {
  addCamera: () => void;
  cycleCamera: () => void;
  selectCamera: (id: string) => void;
  toggleCameraVisibility: (id?: string) => void;
  deleteCamera: (id: string) => void;
  setCameraFov: (id: string, fov: number) => void;
  getCameraFov: (id: string) => number;
  setPerpetualFov: (fov: number) => void;
  getPerpetualFov: () => number;
  getCameras: () => CameraItem[];
  getActiveCameraId: () => string | null;
  getCameraById: (id: string) => THREE.PerspectiveCamera | null;
  getCameraHelpers: () => THREE.CameraHelper[];
  setCameraChangeListener: (cb: (items: CameraItem[], activeId: string | null) => void) => void;
  removeCameraChangeListener?: (cb: (items: CameraItem[], activeId: string | null) => void) => void;
  destroy: () => void;
}

export function createCameraManager(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  orbitControls: OrbitControls
): CameraManager {
  const cameras: ManagedCamera[] = [];
  let activeCameraId: string | null = null;
  let cameraAnimId = 0;
  const cameraChangeListeners: Array<(items: CameraItem[], activeId: string | null) => void> = [];

  function notifyCameraChange() {
    cameras.forEach((c) => {
      c.helper.visible = c.visible && c.id !== activeCameraId;
    });

    const items: CameraItem[] = cameras.map((c) => ({
      id: c.id,
      name: c.name,
      visible: c.visible,
      fov: Math.round(c.camera.fov),
    }));

    cameraChangeListeners.forEach((cb) => {
      cb(items, activeCameraId);
    });
  }

  function addCamera() {
    const cam = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 0.1, 1000);
    cam.position.copy(camera.position);
    cam.quaternion.copy(camera.quaternion);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();

    // Constant-geometry proxy camera for CameraHelper (fixed 40 deg FOV, 1.2m depth)
    // Ensures frustum wireframe remains crisp, compact, and completely non-responsive to FOV changes
    const helperCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 1.2);
    helperCam.position.copy(cam.position);
    helperCam.quaternion.copy(cam.quaternion);
    helperCam.updateMatrixWorld(true);
    helperCam.updateProjectionMatrix();

    const target = orbitControls.target.clone();
    const helper = new THREE.CameraHelper(helperCam);
    helper.renderOrder = 999;
    helper.visible = true;
    scene.add(helper);

    const id = `cam_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const name = `camera ${cameras.length + 1}`;
    const newCam: ManagedCamera = {
      id,
      name,
      camera: cam,
      target,
      helper,
      visible: true,
    };
    cameras.push(newCam);
    activeCameraId = id;
    notifyCameraChange();
  }

  function transitionToCamera(targetCam: ManagedCamera) {
    if (cameraAnimId) {
      cancelAnimationFrame(cameraAnimId);
      cameraAnimId = 0;
    }

    activeCameraId = targetCam.id;
    notifyCameraChange();

    const startPos = camera.position.clone();
    const startTarget = orbitControls.target.clone();
    const startFov = camera.fov;
    const targetPos = targetCam.camera.position.clone();
    const targetTarget = targetCam.target.clone();
    const targetFov = targetCam.camera.fov;

    const startTime = performance.now();
    const duration = 500;

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      camera.position.lerpVectors(startPos, targetPos, ease);
      orbitControls.target.lerpVectors(startTarget, targetTarget, ease);
      camera.fov = THREE.MathUtils.lerp(startFov, targetFov, ease);
      camera.updateProjectionMatrix();
      orbitControls.update();

      if (progress < 1) {
        cameraAnimId = requestAnimationFrame(step);
      } else {
        cameraAnimId = 0;
      }
    }

    cameraAnimId = requestAnimationFrame(step);
  }

  function cycleCamera() {
    if (cameras.length === 0) return;
    const currentIndex = cameras.findIndex((c) => c.id === activeCameraId);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cameras.length;
    transitionToCamera(cameras[nextIndex]);
  }

  function selectCamera(id: string) {
    const target = cameras.find((c) => c.id === id);
    if (target) {
      transitionToCamera(target);
    }
  }

  function toggleCameraVisibility(id?: string) {
    if (id) {
      const target = cameras.find((c) => c.id === id);
      if (target) {
        target.visible = !target.visible;
        target.helper.visible = target.visible;
        notifyCameraChange();
      }
    } else {
      const anyVisible = cameras.some((c) => c.visible);
      cameras.forEach((c) => {
        c.visible = !anyVisible;
        c.helper.visible = !anyVisible;
      });
      notifyCameraChange();
    }
  }

  function deleteCamera(id: string) {
    const index = cameras.findIndex((c) => c.id === id);
    if (index === -1) return;
    const [removed] = cameras.splice(index, 1);
    scene.remove(removed.helper);
    removed.helper.dispose();

    if (activeCameraId === id) {
      activeCameraId = cameras[Math.max(0, index - 1)]?.id || null;
    }
    notifyCameraChange();
  }

  function setCameraFov(id: string, fov: number) {
    const target = cameras.find((c) => c.id === id);
    if (!target) return;
    const clamped = Math.max(10, Math.min(120, fov));
    target.camera.fov = clamped;
    target.camera.updateProjectionMatrix();

    if (id === activeCameraId) {
      camera.fov = clamped;
      camera.updateProjectionMatrix();
    }
    notifyCameraChange();
  }

  function getCameraFov(id: string): number {
    const target = cameras.find((c) => c.id === id);
    return target ? target.camera.fov : 45;
  }

  let perpetualFov = 38;

  function setPerpetualFov(fov: number) {
    perpetualFov = Math.max(20, Math.min(90, fov));
    if (activeCameraId === null) {
      camera.fov = perpetualFov;
      camera.updateProjectionMatrix();
    }
  }

  function getPerpetualFov(): number {
    return perpetualFov;
  }

  const onOrbitStart = () => {
    if (cameraAnimId) {
      cancelAnimationFrame(cameraAnimId);
      cameraAnimId = 0;
    }
    if (activeCameraId !== null) {
      activeCameraId = null;
      if (Math.abs(camera.fov - perpetualFov) > 0.01) {
        camera.fov = perpetualFov;
        camera.updateProjectionMatrix();
      }
      notifyCameraChange();
    }
  };
  orbitControls.addEventListener('start', onOrbitStart);

  function destroy() {
    orbitControls.removeEventListener('start', onOrbitStart);
    if (cameraAnimId) cancelAnimationFrame(cameraAnimId);
    cameras.forEach((c) => {
      scene.remove(c.helper);
      c.helper.dispose();
    });
  }

  return {
    addCamera,
    cycleCamera,
    selectCamera,
    toggleCameraVisibility,
    deleteCamera,
    setCameraFov,
    getCameraFov,
    setPerpetualFov,
    getPerpetualFov,
    getCameras: () =>
      cameras.map((c) => ({
        id: c.id,
        name: c.name,
        visible: c.visible,
        fov: Math.round(c.camera.fov),
      })),
    getActiveCameraId: () => activeCameraId,
    getCameraById: (id: string) => {
      const found = cameras.find((c) => c.id === id);
      return found ? found.camera : null;
    },
    getCameraHelpers: () => cameras.map((c) => c.helper),
    setCameraChangeListener: (cb: (items: CameraItem[], activeId: string | null) => void) => {
      if (!cameraChangeListeners.includes(cb)) {
        cameraChangeListeners.push(cb);
      }
      notifyCameraChange();
    },
    removeCameraChangeListener: (cb: (items: CameraItem[], activeId: string | null) => void) => {
      const idx = cameraChangeListeners.indexOf(cb);
      if (idx !== -1) cameraChangeListeners.splice(idx, 1);
    },
    destroy,
  };
}

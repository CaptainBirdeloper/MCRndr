import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BodyPartName, TransformMode, PosePreset, CameraItem } from '../../types';
import { MinecraftRig } from '../rig/rig';
import { createCameraManager, ManagedCamera } from '../camera/cameraManager';
import { LightingManager } from '../lighting/lightingManager';
import { createHistoryManager, HistoryAction } from './history';
import { createModalTransformEngine, ModalTransform } from './modalTransform';

export type { ManagedCamera, HistoryAction, ModalTransform };

export interface RigControlsManager {
  selectedPart: BodyPartName | null;
  transformMode: TransformMode;
  space: 'local' | 'world';
  selectPart: (part: BodyPartName | null) => void;
  setMode: (mode: TransformMode) => void;
  toggleSpace: () => void;
  resetSelectedPart: () => void;
  applyPose: (preset: PosePreset, durationMs?: number) => void;
  getCameras: () => CameraItem[];
  getActiveCameraId: () => string | null;
  getCameraById: (id: string) => THREE.PerspectiveCamera | null;
  getCameraHelpers: () => THREE.Object3D[];
  addCamera: () => void;
  cycleCamera: () => void;
  selectCamera: (id: string) => void;
  toggleCameraVisibility: (id?: string) => void;
  deleteCamera: (id: string) => void;
  setCameraFov: (id: string, fov: number) => void;
  getCameraFov: (id: string) => number;
  setPerpetualFov: (fov: number) => void;
  getPerpetualFov: () => number;
  setCameraChangeListener: (cb: (cameras: CameraItem[], activeId: string | null) => void) => void;
  removeCameraChangeListener?: (cb: (cameras: CameraItem[], activeId: string | null) => void) => void;
  wholeBodyMode: boolean;
  setWholeBodyMode: (enabled: boolean) => void;
  getRootTransform: () => { position: [number, number, number]; rotationDeg: [number, number, number] };
  setRootPosition: (axis: 'x' | 'y' | 'z', value: number) => void;
  setRootRotation: (axis: 'x' | 'y' | 'z', valueDeg: number) => void;
  setRootTransformListener: (cb: (pos: [number, number, number], rotDeg: [number, number, number]) => void) => void;
  getPartTransform: (part: BodyPartName) => { position: [number, number, number]; rotationDeg: [number, number, number] };
  setPartPosition: (part: BodyPartName, axis: 'x' | 'y' | 'z', value: number) => void;
  setPartRotation: (part: BodyPartName, axis: 'x' | 'y' | 'z', valueDeg: number) => void;
  setPartTransformListener: (cb: (part: BodyPartName, pos: [number, number, number], rotDeg: [number, number, number]) => void) => void;
  undo: () => void;
  redo: () => void;
  commitPositionHistory: (axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitRotationHistory: (axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitPartPositionHistory: (part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitPartRotationHistory: (part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  setOnTransformListener: (cb: () => void) => void;
  setOnUndoListener: (cb: () => void) => void;
  captureCurrentPose: (id: string, name: string) => PosePreset;
  destroy: () => void;
}

function stripPlanarHandles(gizmoHelper: THREE.Object3D) {
  const gh = gizmoHelper as any;
  ['gizmo', 'picker', 'helper'].forEach((dictName) => {
    const parent = gh[dictName]?.['translate'];
    if (parent && Array.isArray(parent.children)) {
      for (let i = parent.children.length - 1; i >= 0; i--) {
        const child = parent.children[i];
        if (child && (child.name === 'XY' || child.name === 'YZ' || child.name === 'XZ' || child.name === 'XYZ')) {
          parent.remove(child);
        }
      }
    }
  });
}

export function setupRigControls(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  orbitControls: OrbitControls,
  rig: MinecraftRig,
  lightingManager?: LightingManager,
  onSelectionChange?: (part: BodyPartName | null, rotDeg: [number, number, number]) => void
): RigControlsManager {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  let selectedPart: BodyPartName | null = null;
  let transformMode: TransformMode = 'translate';
  let space: 'local' | 'world' = 'local';
  let wholeBodyMode = true;

  // Transform Gizmo
  const gizmo = new TransformControls(camera, domElement);
  gizmo.size = 0.75;
  gizmo.setMode('translate');
  gizmo.setSpace('local');
  const gizmoHelper = gizmo.getHelper();
  stripPlanarHandles(gizmoHelper);
  scene.add(gizmoHelper);

  // Selection outline / box helper
  const boxHelper = new THREE.BoxHelper(rig.root, 0x38bdf8);
  boxHelper.visible = false;
  scene.add(boxHelper);

  // Sync gizmo when light is selected externally (e.g. from WORLD tab)
  lightingManager?.setSelectionListener((id) => {
    if (id) {
      selectedPart = null;
      boxHelper.visible = false;
      onSelectionChange?.(null, [0, 0, 0]);
      const lightGroup = lightingManager.getLightGroupById(id);
      if (lightGroup) {
        gizmo.attach(lightGroup);
        gizmo.getHelper().visible = true;
      }
    } else {
      if (!selectedPart) {
        gizmo.detach();
        gizmo.getHelper().visible = false;
      }
    }
  });

  // Subsystem 1: Camera Manager
  const cameraManager = createCameraManager(scene, camera, orbitControls);

  // Callbacks for UI Synchronization
  let rootTransformCb: ((pos: [number, number, number], rotDeg: [number, number, number]) => void) | null = null;
  let partTransformCb: ((part: BodyPartName, pos: [number, number, number], rotDeg: [number, number, number]) => void) | null = null;

  function notifyRootTransform() {
    const pos: [number, number, number] = [
      Math.round(rig.root.position.x * 100),
      Math.round(rig.root.position.y * 100),
      Math.round(rig.root.position.z * 100),
    ];
    const rot: [number, number, number] = [
      Math.round((rig.root.rotation.x * 180) / Math.PI),
      Math.round((rig.root.rotation.y * 180) / Math.PI),
      Math.round((rig.root.rotation.z * 180) / Math.PI),
    ];
    rootTransformCb?.(pos, rot);
  }

  function notifyAngleChange(part: BodyPartName) {
    const rot = rig.joints[part].group.rotation;
    const deg: [number, number, number] = [
      Math.round((rot.x * 180) / Math.PI),
      Math.round((rot.y * 180) / Math.PI),
      Math.round((rot.z * 180) / Math.PI),
    ];
    onSelectionChange?.(part, deg);
  }

  function notifyPartTransform(part: BodyPartName) {
    const joint = rig.joints[part];
    if (!joint) return;
    const pos: [number, number, number] = [
      Math.round(joint.group.position.x * 100),
      Math.round(joint.group.position.y * 100),
      Math.round(joint.group.position.z * 100),
    ];
    const rot: [number, number, number] = [
      Math.round((joint.group.rotation.x * 180) / Math.PI),
      Math.round((joint.group.rotation.y * 180) / Math.PI),
      Math.round((joint.group.rotation.z * 180) / Math.PI),
    ];
    partTransformCb?.(part, pos, rot);
    notifyAngleChange(part);
  }

  // Subsystem 2: History Engine
  const historyManager = createHistoryManager(rig, boxHelper, {
    notifyRootTransform,
    notifyPartTransform,
    notifyAngleChange,
  });

  // Subsystem 3: Modal Transform Engine (G/R Drag & Axis Lock)
  const modalTransformEngine = createModalTransformEngine(
    scene,
    camera,
    domElement,
    rig,
    orbitControls,
    gizmo,
    boxHelper,
    historyManager,
    {
      notifyRootTransform,
      notifyAngleChange,
    }
  );

  function getRootTransform() {
    return {
      position: [
        Math.round(rig.root.position.x * 100),
        Math.round(rig.root.position.y * 100),
        Math.round(rig.root.position.z * 100),
      ] as [number, number, number],
      rotationDeg: [
        Math.round((rig.root.rotation.x * 180) / Math.PI),
        Math.round((rig.root.rotation.y * 180) / Math.PI),
        Math.round((rig.root.rotation.z * 180) / Math.PI),
      ] as [number, number, number],
    };
  }

  function setRootPosition(axis: 'x' | 'y' | 'z', value: number) {
    rig.root.position[axis] = value / 100;
    boxHelper.setFromObject(rig.root);
    notifyRootTransform();
  }

  function setRootRotation(axis: 'x' | 'y' | 'z', valueDeg: number) {
    rig.root.rotation[axis] = (valueDeg * Math.PI) / 180;
    boxHelper.setFromObject(rig.root);
    notifyRootTransform();
  }

  function getPartTransform(part: BodyPartName) {
    const joint = rig.joints[part];
    if (!joint) {
      return { position: [0, 0, 0] as [number, number, number], rotationDeg: [0, 0, 0] as [number, number, number] };
    }
    return {
      position: [
        Math.round(joint.group.position.x * 100),
        Math.round(joint.group.position.y * 100),
        Math.round(joint.group.position.z * 100),
      ] as [number, number, number],
      rotationDeg: [
        Math.round((joint.group.rotation.x * 180) / Math.PI),
        Math.round((joint.group.rotation.y * 180) / Math.PI),
        Math.round((joint.group.rotation.z * 180) / Math.PI),
      ] as [number, number, number],
    };
  }

  function setPartPosition(part: BodyPartName, axis: 'x' | 'y' | 'z', value: number) {
    const joint = rig.joints[part];
    if (!joint) return;
    joint.group.position[axis] = value / 100;
    boxHelper.setFromObject(joint.group);
    notifyPartTransform(part);
  }

  function setPartRotation(part: BodyPartName, axis: 'x' | 'y' | 'z', valueDeg: number) {
    const joint = rig.joints[part];
    if (!joint) return;
    joint.group.rotation[axis] = (valueDeg * Math.PI) / 180;
    boxHelper.setFromObject(joint.group);
    notifyPartTransform(part);
  }

  const gizmoStartPos = new THREE.Vector3();
  const gizmoStartQuat = new THREE.Quaternion();

  gizmo.addEventListener('dragging-changed', (event) => {
    orbitControls.enabled = !event.value;
    if (event.value) {
      if (selectedPart === 'root') {
        gizmoStartPos.copy(rig.root.position);
        gizmoStartQuat.copy(rig.root.quaternion);
      } else if (selectedPart && rig.joints[selectedPart]) {
        gizmoStartPos.copy(rig.joints[selectedPart].group.position);
        gizmoStartQuat.copy(rig.joints[selectedPart].group.quaternion);
      }
    } else {
      if (selectedPart === 'root') {
        if (!rig.root.position.equals(gizmoStartPos) || !rig.root.quaternion.equals(gizmoStartQuat)) {
          historyManager.pushAction({
            type: 'modal_transform',
            part: 'root' as BodyPartName,
            prevPos: gizmoStartPos.clone(),
            prevQuat: gizmoStartQuat.clone(),
            nextPos: rig.root.position.clone(),
            nextQuat: rig.root.quaternion.clone(),
          });
        }
      } else if (selectedPart && rig.joints[selectedPart]) {
        const joint = rig.joints[selectedPart];
        if (!joint.group.position.equals(gizmoStartPos) || !joint.group.quaternion.equals(gizmoStartQuat)) {
          historyManager.pushAction({
            type: 'modal_transform',
            part: selectedPart,
            prevPos: gizmoStartPos.clone(),
            prevQuat: gizmoStartQuat.clone(),
            nextPos: joint.group.position.clone(),
            nextQuat: joint.group.quaternion.clone(),
          });
        }
      }
    }
  });

  gizmo.addEventListener('change', () => {
    if (selectedPart === 'root') {
      boxHelper.update();
      notifyRootTransform();
    } else if (selectedPart && rig.joints[selectedPart]) {
      boxHelper.update();
      notifyPartTransform(selectedPart);
    }
  });

  function selectPart(part: BodyPartName | null) {
    if (part) {
      lightingManager?.selectLight(null);
    }
    selectedPart = part;
    gizmo.showX = true;
    gizmo.showY = true;
    gizmo.showZ = true;

    if (!part || (part !== 'root' && !rig.joints[part])) {
      gizmo.detach();
      gizmo.getHelper().visible = false;
      boxHelper.visible = false;
      onSelectionChange?.(null, [0, 0, 0]);
      return;
    }

    if (part === 'root') {
      gizmo.attach(rig.root);
      gizmo.getHelper().visible = true;
      boxHelper.setFromObject(rig.root);
      boxHelper.visible = true;
      notifyRootTransform();
      return;
    }

    const joint = rig.joints[part];
    gizmo.attach(joint.group);
    gizmo.getHelper().visible = true;
    boxHelper.setFromObject(joint.innerMesh || joint.group);
    boxHelper.visible = true;
    notifyAngleChange(part);
  }

  function setMode(mode: TransformMode) {
    transformMode = mode;
    gizmo.setMode(mode);
    if (selectedPart) {
      gizmo.getHelper().visible = true;
    }
  }

  function toggleSpace() {
    space = space === 'local' ? 'world' : 'local';
    gizmo.setSpace(space);
  }

  function resetSelectedPart() {
    if (selectedPart && rig.joints[selectedPart]) {
      rig.joints[selectedPart].group.rotation.set(0, 0, 0);
      if (selectedPart === 'root' || selectedPart === 'pelvis') {
        rig.joints[selectedPart].group.position.set(0, selectedPart === 'pelvis' ? 0.75 : 0, 0);
      }
      boxHelper.update();
      notifyAngleChange(selectedPart);
    }
  }

  // Pointer tracking & hit-testing
  let pointerDownPos = { x: 0, y: 0 };

  function onPointerDown(e: MouseEvent) {
    pointerDownPos = { x: e.clientX, y: e.clientY };
    if (modalTransformEngine.handlePointerDown(e, selectedPart)) {
      e.stopPropagation();
    }
  }

  function onPointerMove(e: MouseEvent) {
    modalTransformEngine.handlePointerMove(e, selectedPart);
  }

  function onPointerUp(e: MouseEvent) {
    if (modalTransformEngine.isModalActive()) return;

    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > 5) return;

    const rect = domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    if (lightingManager) {
      const lightTargets = lightingManager.getRaycastTargets();
      const lightIntersects = raycaster.intersectObjects(lightTargets, true);
      if (lightIntersects.length > 0) {
        const hitLightId = lightIntersects[0].object.userData.lightId as string;
        if (hitLightId) {
          selectPart(null);
          lightingManager.selectLight(hitLightId);
          return;
        }
      }
    }

    const meshes: THREE.Object3D[] = [];
    rig.root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.userData.isBodyPart) {
        meshes.push(child);
      }
    });

    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      lightingManager?.selectLight(null);
      if (wholeBodyMode) {
        selectPart('root');
        return;
      }
      const hit = intersects[0];
      const partName = hit.object.userData.partName as BodyPartName;
      if (partName) {
        selectPart(partName);
        return;
      }
    }

    if (!gizmo.dragging) {
      selectPart(null);
      lightingManager?.selectLight(null);
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (isCtrlOrCmd && e.code === 'KeyZ') {
      e.preventDefault();
      (e.target as HTMLElement)?.blur();
      if (e.shiftKey) {
        historyManager.redo();
      } else {
        historyManager.undo();
      }
      return;
    }
    if (isCtrlOrCmd && e.code === 'KeyY') {
      e.preventDefault();
      (e.target as HTMLElement)?.blur();
      historyManager.redo();
      return;
    }

    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (!modalTransformEngine.isModalActive() && e.code === 'KeyC' && e.shiftKey) {
      e.preventDefault();
      cameraManager.addCamera();
      return;
    } else if (!modalTransformEngine.isModalActive() && e.code === 'KeyC' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      cameraManager.cycleCamera();
      return;
    }

    if ((e.code === 'KeyR' && e.altKey) || e.code === 'KeyK') {
      e.preventDefault();
      resetSelectedPart();
    } else if (e.code === 'KeyG') {
      e.preventDefault();
      const activeLightId = lightingManager?.getActiveLightId();
      if (activeLightId) {
        const lightGroup = lightingManager?.getLightGroupById(activeLightId);
        if (lightGroup) {
          setMode('translate');
          modalTransformEngine.startModalObject('translate', lightGroup);
          return;
        }
      }
      if (wholeBodyMode && selectedPart !== 'root') {
        selectPart('root');
      }
      setMode('translate');
      modalTransformEngine.startModal('translate', selectedPart);
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      const activeLightId = lightingManager?.getActiveLightId();
      if (activeLightId) {
        const lightGroup = lightingManager?.getLightGroupById(activeLightId);
        if (lightGroup) {
          setMode('rotate');
          modalTransformEngine.startModalObject('rotate', lightGroup);
          return;
        }
      }
      if (wholeBodyMode && selectedPart !== 'root') {
        selectPart('root');
      }
      setMode('rotate');
      modalTransformEngine.startModal('rotate', selectedPart);
    } else if (e.code === 'KeyX' || e.code === 'KeyY' || e.code === 'KeyZ') {
      const axis = e.code === 'KeyX' ? 'x' : e.code === 'KeyY' ? 'y' : 'z';
      if (modalTransformEngine.isModalActive() || selectedPart) {
        e.preventDefault();
        modalTransformEngine.setAxis(axis, selectedPart, transformMode);
      }
    } else if (e.code === 'KeyQ') {
      toggleSpace();
    } else if (e.code === 'Escape') {
      if (modalTransformEngine.isModalActive()) {
        modalTransformEngine.cancelModal(selectedPart);
      } else if (lightingManager?.getActiveLightId()) {
        lightingManager.selectLight(null);
      } else {
        selectPart(null);
      }
    }
  }

  // Active pose interpolation animation handle
  let poseAnimId: number | null = null;

  function applyPose(preset: PosePreset, durationMs = 280) {
    modalTransformEngine.finishModal(selectedPart);
    if (poseAnimId) {
      cancelAnimationFrame(poseAnimId);
      poseAnimId = null;
    }
    const startTime = performance.now();
    const startQuats: Partial<Record<BodyPartName, THREE.Quaternion>> = {};
    const targetQuats: Partial<Record<BodyPartName, THREE.Quaternion>> = {};

    const prevRotations: Record<string, [number, number, number]> = {};
    Object.keys(rig.joints).forEach((name) => {
      const part = name as BodyPartName;
      const joint = rig.joints[part];
      if (joint) {
        prevRotations[part] = [joint.group.rotation.x, joint.group.rotation.y, joint.group.rotation.z];
      }
    });
    const prevRootPos: [number, number, number] = [
      rig.root.position.x,
      rig.root.position.y,
      rig.root.position.z,
    ];

    historyManager.pushAction({
      type: 'pose',
      prevRotations,
      nextRotations: preset.rotations as Record<string, [number, number, number]>,
      prevRootPos,
      nextRootPos: preset.rootPosition || [0, 0, 0],
    });

    Object.keys(rig.joints).forEach((name) => {
      const part = name as BodyPartName;
      const joint = rig.joints[part];
      if (joint) {
        startQuats[part] = joint.group.quaternion.clone();
        const targetEulerArr = preset.rotations[part] || [0, 0, 0];
        const targetEuler = new THREE.Euler(targetEulerArr[0], targetEulerArr[1], targetEulerArr[2]);
        targetQuats[part] = new THREE.Quaternion().setFromEuler(targetEuler);
      }
    });

    const startRootPos = rig.root.position.clone();
    const targetRootPos = preset.rootPosition ? new THREE.Vector3(...preset.rootPosition) : new THREE.Vector3(0, 0, 0);

    const startRootQuat = rig.root.quaternion.clone();
    const targetRootQuat = new THREE.Quaternion();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease = 1 - Math.pow(1 - progress, 3);

      Object.entries(targetQuats).forEach(([name, targetQuat]) => {
        const part = name as BodyPartName;
        const joint = rig.joints[part];
        const startQuat = startQuats[part];
        if (joint && startQuat && targetQuat) {
          joint.group.quaternion.slerpQuaternions(startQuat, targetQuat, ease);
        }
      });

      rig.root.position.lerpVectors(startRootPos, targetRootPos, ease);
      rig.root.quaternion.slerpQuaternions(startRootQuat, targetRootQuat, ease);
      boxHelper.update();
      notifyRootTransform();

      if (progress < 1) {
        poseAnimId = requestAnimationFrame(step);
      } else {
        poseAnimId = null;
        if (selectedPart) {
          notifyAngleChange(selectedPart);
        }
      }
    }

    poseAnimId = requestAnimationFrame(step);
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);

  function destroy() {
    if (poseAnimId) cancelAnimationFrame(poseAnimId);
    cameraManager.destroy();
    modalTransformEngine.destroy();
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('keydown', onKeyDown);
    gizmo.detach();
    gizmo.dispose();
    scene.remove(gizmo.getHelper());
    scene.remove(boxHelper);
    boxHelper.dispose();
  }

  // Transform gizmo is default on launch
  if (wholeBodyMode) {
    selectPart('root');
  }

  return {
    get selectedPart() {
      return selectedPart;
    },
    get transformMode() {
      return transformMode;
    },
    get space() {
      return space;
    },
    selectPart,
    setMode,
    toggleSpace,
    resetSelectedPart,
    applyPose,
    getCameras: cameraManager.getCameras,
    getActiveCameraId: cameraManager.getActiveCameraId,
    getCameraById: cameraManager.getCameraById,
    getCameraHelpers: cameraManager.getCameraHelpers,
    addCamera: cameraManager.addCamera,
    cycleCamera: cameraManager.cycleCamera,
    selectCamera: cameraManager.selectCamera,
    toggleCameraVisibility: cameraManager.toggleCameraVisibility,
    deleteCamera: cameraManager.deleteCamera,
    setCameraFov: cameraManager.setCameraFov,
    getCameraFov: cameraManager.getCameraFov,
    setPerpetualFov: cameraManager.setPerpetualFov,
    getPerpetualFov: cameraManager.getPerpetualFov,
    setCameraChangeListener: cameraManager.setCameraChangeListener,
    removeCameraChangeListener: cameraManager.removeCameraChangeListener,
    get wholeBodyMode() {
      return wholeBodyMode;
    },
    setWholeBodyMode: (enabled: boolean) => {
      wholeBodyMode = enabled;
      if (enabled) {
        selectPart('root');
      }
    },
    getRootTransform,
    setRootPosition,
    setRootRotation,
    setRootTransformListener: (cb: (pos: [number, number, number], rotDeg: [number, number, number]) => void) => {
      rootTransformCb = cb;
      notifyRootTransform();
    },
    getPartTransform,
    setPartPosition,
    setPartRotation,
    setPartTransformListener: (cb: (part: BodyPartName, pos: [number, number, number], rotDeg: [number, number, number]) => void) => {
      partTransformCb = cb;
      if (selectedPart && selectedPart !== 'root') {
        notifyPartTransform(selectedPart);
      }
    },
    undo: historyManager.undo,
    redo: historyManager.redo,
    commitPositionHistory: historyManager.commitPositionHistory,
    commitRotationHistory: historyManager.commitRotationHistory,
    commitPartPositionHistory: historyManager.commitPartPositionHistory,
    commitPartRotationHistory: historyManager.commitPartRotationHistory,
    setOnTransformListener: historyManager.setOnTransformListener,
    setOnUndoListener: historyManager.setOnUndoListener,
    captureCurrentPose: (id: string, name: string): PosePreset => {
      const rotations: Record<string, [number, number, number]> = {};
      Object.keys(rig.joints).forEach((k) => {
        const part = k as BodyPartName;
        const joint = rig.joints[part];
        if (joint) {
          rotations[part] = [joint.group.rotation.x, joint.group.rotation.y, joint.group.rotation.z];
        }
      });
      return {
        id,
        name,
        description: 'Custom transformed pose',
        rotations: rotations as Record<BodyPartName, [number, number, number]>,
        rootPosition: [rig.root.position.x, rig.root.position.y, rig.root.position.z],
      };
    },
    destroy,
  };
}

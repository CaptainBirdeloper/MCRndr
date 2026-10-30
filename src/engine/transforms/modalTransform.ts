import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BodyPartName } from '../../types';
import { MinecraftRig } from '../rig/rig';
import { HistoryManager } from './history';

export interface ModalTransform {
  mode: 'translate' | 'rotate';
  axis: 'x' | 'y' | 'z' | null;
  startClientX: number;
  startClientY: number;
  startPos: THREE.Vector3;
  startQuat: THREE.Quaternion;
  pivotWorld: THREE.Vector3;
  pivotScreen: THREE.Vector2;
  customTarget?: THREE.Object3D;
}

export interface ModalTransformCallbacks {
  notifyRootTransform: () => void;
  notifyAngleChange: (part: BodyPartName) => void;
}

export interface ModalTransformEngine {
  isModalActive: () => boolean;
  startModal: (mode: 'translate' | 'rotate', selectedPart: BodyPartName | 'root' | null) => void;
  startModalObject: (mode: 'translate' | 'rotate', object: THREE.Object3D) => void;
  finishModal: (selectedPart: BodyPartName | 'root' | null) => void;
  cancelModal: (selectedPart: BodyPartName | 'root' | null) => void;
  handlePointerMove: (e: MouseEvent, selectedPart: BodyPartName | 'root' | null) => void;
  handlePointerDown: (e: MouseEvent, selectedPart: BodyPartName | 'root' | null) => boolean;
  setAxis: (
    axis: 'x' | 'y' | 'z',
    selectedPart: BodyPartName | 'root' | null,
    fallbackMode?: 'translate' | 'rotate'
  ) => void;
  destroy: () => void;
}

export function createModalTransformEngine(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  rig: MinecraftRig,
  orbitControls: OrbitControls,
  gizmo: TransformControls,
  boxHelper: THREE.BoxHelper,
  historyManager: HistoryManager,
  callbacks: ModalTransformCallbacks
): ModalTransformEngine {
  let modal: ModalTransform | null = null;
  let lastPointerPos = { x: 0, y: 0 };

  // 3D Axis Guideline (Red=X, Green=Y, Blue=Z)
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-10000, 0, 0),
    new THREE.Vector3(10000, 0, 0),
  ]);
  const axisMat = new THREE.LineBasicMaterial({
    color: 0xef4444,
    depthTest: false,
    transparent: true,
    opacity: 0.9,
  });
  const axisLine = new THREE.Line(axisGeo, axisMat);
  axisLine.renderOrder = 999;
  axisLine.visible = false;
  scene.add(axisLine);

  function getTarget(part: BodyPartName | 'root' | null): { group: THREE.Object3D } | null {
    if (!part) return null;
    if (part === 'root') return { group: rig.root };
    return rig.joints[part] || null;
  }

  function startModal(mode: 'translate' | 'rotate', selectedPart: BodyPartName | 'root' | null) {
    const target = getTarget(selectedPart);
    if (!target) return;

    // Joint point is always the anatomical pivot
    const pivotWorld = new THREE.Vector3();
    target.group.getWorldPosition(pivotWorld);

    // Project joint pivot to screen coordinates
    const proj = pivotWorld.clone().project(camera);
    const rect = domElement.getBoundingClientRect();
    const pivotScreen = new THREE.Vector2(
      ((proj.x + 1) * rect.width) / 2 + rect.left,
      ((-proj.y + 1) * rect.height) / 2 + rect.top
    );

    modal = {
      mode,
      axis: null,
      startClientX: lastPointerPos.x,
      startClientY: lastPointerPos.y,
      startPos: target.group.position.clone(),
      startQuat: target.group.quaternion.clone(),
      pivotWorld,
      pivotScreen,
    };

    orbitControls.enabled = false;
    gizmo.getHelper().visible = true;
  }

  function startModalObject(mode: 'translate' | 'rotate', object: THREE.Object3D) {
    const pivotWorld = new THREE.Vector3();
    object.getWorldPosition(pivotWorld);

    const proj = pivotWorld.clone().project(camera);
    const rect = domElement.getBoundingClientRect();
    const pivotScreen = new THREE.Vector2(
      ((proj.x + 1) * rect.width) / 2 + rect.left,
      ((-proj.y + 1) * rect.height) / 2 + rect.top
    );

    modal = {
      mode,
      axis: null,
      startClientX: lastPointerPos.x,
      startClientY: lastPointerPos.y,
      startPos: object.position.clone(),
      startQuat: object.quaternion.clone(),
      pivotWorld,
      pivotScreen,
      customTarget: object,
    };

    orbitControls.enabled = false;
    gizmo.getHelper().visible = true;
  }

  function finishModal(selectedPart: BodyPartName | 'root' | null) {
    if (!modal) return;
    if (modal.customTarget) {
      modal = null;
      orbitControls.enabled = true;
      gizmo.getHelper().visible = true;
      gizmo.showX = true;
      gizmo.showY = true;
      gizmo.showZ = true;
      axisLine.visible = false;
      return;
    }
    const target = getTarget(selectedPart);
    if (target && selectedPart) {
      const endPos = target.group.position.clone();
      const endQuat = target.group.quaternion.clone();
      if (!endPos.equals(modal.startPos) || !endQuat.equals(modal.startQuat)) {
        historyManager.pushAction({
          type: 'modal_transform',
          part: selectedPart as BodyPartName,
          prevPos: modal.startPos.clone(),
          prevQuat: modal.startQuat.clone(),
          nextPos: endPos,
          nextQuat: endQuat,
        });
      }
    }

    modal = null;
    orbitControls.enabled = true;
    gizmo.getHelper().visible = true;
    gizmo.showX = true;
    gizmo.showY = true;
    gizmo.showZ = true;
    axisLine.visible = false;
    boxHelper.update();
    if (selectedPart === 'root') {
      callbacks.notifyRootTransform();
    } else if (selectedPart) {
      callbacks.notifyAngleChange(selectedPart as BodyPartName);
    }
  }

  function cancelModal(selectedPart: BodyPartName | 'root' | null) {
    if (!modal) return;
    if (modal.customTarget) {
      modal.customTarget.position.copy(modal.startPos);
      modal.customTarget.quaternion.copy(modal.startQuat);
      finishModal(null);
      return;
    }
    if (!selectedPart) return;
    const target = getTarget(selectedPart);
    if (target) {
      target.group.position.copy(modal.startPos);
      target.group.quaternion.copy(modal.startQuat);
    }
    axisLine.visible = false;
    finishModal(selectedPart);
  }

  function handlePointerMove(e: MouseEvent, selectedPart: BodyPartName | 'root' | null) {
    lastPointerPos = { x: e.clientX, y: e.clientY };
    if (!modal) return;

    const target = modal.customTarget ? { group: modal.customTarget } : getTarget(selectedPart);
    if (!target) return;

    const dx = e.clientX - modal.startClientX;
    const dy = e.clientY - modal.startClientY;

    if (modal.mode === 'translate') {
      const sens = 0.003;
      const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

      if (modal.axis === null) {
        // Free move without axis restriction (camera plane)
        const moveDelta = camRight.clone().multiplyScalar(dx * sens).add(camUp.clone().multiplyScalar(-dy * sens));
        target.group.position.copy(modal.startPos).add(moveDelta);
      } else {
        // Constrained axis move
        const axisVector = new THREE.Vector3(
          modal.axis === 'x' ? 1 : 0,
          modal.axis === 'y' ? 1 : 0,
          modal.axis === 'z' ? 1 : 0
        );
        const proj = (dx - dy) * sens;
        target.group.position.copy(modal.startPos).add(axisVector.multiplyScalar(proj));
      }
    } else if (modal.mode === 'rotate') {
      if (modal.axis === null) {
        // Natural joint-anchored rotation following mouse drag direction
        const dragDist = Math.hypot(dx, dy);
        if (dragDist > 1) {
          const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
          const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
          const dragVector = camRight.clone().multiplyScalar(dx).add(camUp.clone().multiplyScalar(-dy));
          const camForward = camera.getWorldDirection(new THREE.Vector3());
          // Axis perpendicular to drag direction in view plane (drag up -> rotates limb upward)
          const rotAxis = new THREE.Vector3().crossVectors(dragVector, camForward).normalize();
          const angle = dragDist * 0.012;
          const deltaQuat = new THREE.Quaternion().setFromAxisAngle(rotAxis, angle);
          target.group.quaternion.copy(modal.startQuat).premultiply(deltaQuat);
        } else {
          target.group.quaternion.copy(modal.startQuat);
        }
      } else {
        // Constrained single-axis rotation around anatomical joint pivot (corrected direction)
        const angle = (dy - dx) * 0.012;
        const localAxis = new THREE.Vector3(
          modal.axis === 'x' ? 1 : 0,
          modal.axis === 'y' ? 1 : 0,
          modal.axis === 'z' ? 1 : 0
        );
        const axisQuat = new THREE.Quaternion().setFromAxisAngle(localAxis, angle);
        target.group.quaternion.copy(modal.startQuat).multiply(axisQuat);
      }
    }

    boxHelper.update();
    if (selectedPart === 'root') {
      callbacks.notifyRootTransform();
    } else if (selectedPart) {
      callbacks.notifyAngleChange(selectedPart as BodyPartName);
    }
  }

  function handlePointerDown(e: MouseEvent, selectedPart: BodyPartName | 'root' | null): boolean {
    if (modal && e.button === 0) {
      finishModal(selectedPart);
      return true;
    }
    return false;
  }

  function setAxis(
    axis: 'x' | 'y' | 'z',
    selectedPart: BodyPartName | 'root' | null,
    fallbackMode: 'translate' | 'rotate' = 'translate'
  ) {
    if (!selectedPart && !modal?.customTarget) return;
    if (!modal && selectedPart) {
      startModal(fallbackMode, selectedPart);
    }
    if (!modal) return;
    const target = modal.customTarget ? { group: modal.customTarget } : getTarget(selectedPart);
    if (!target) return;

    if (modal.axis === axis) {
      // Toggle off restriction
      modal.axis = null;
      axisLine.visible = false;
      gizmo.showX = true;
      gizmo.showY = true;
      gizmo.showZ = true;
      return;
    }

    modal.axis = axis;
    gizmo.showX = axis === 'x';
    gizmo.showY = axis === 'y';
    gizmo.showZ = axis === 'z';
    modal.startClientX = lastPointerPos.x;
    modal.startClientY = lastPointerPos.y;
    modal.startPos.copy(target.group.position);
    modal.startQuat.copy(target.group.quaternion);

    // Position & align 3D axis guideline at joint socket
    const worldPos = new THREE.Vector3();
    target.group.getWorldPosition(worldPos);
    axisLine.position.copy(worldPos);

    const worldQuat = new THREE.Quaternion();
    target.group.getWorldQuaternion(worldQuat);

    if (axis === 'x') {
      axisMat.color.setHex(0xef4444); // Red
      axisLine.quaternion.copy(worldQuat);
    } else if (axis === 'y') {
      axisMat.color.setHex(0x22c55e); // Green
      axisLine.quaternion.copy(worldQuat).multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
      );
    } else {
      axisMat.color.setHex(0x3b82f6); // Blue
      axisLine.quaternion.copy(worldQuat).multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
      );
    }
    axisLine.visible = true;
  }

  function destroy() {
    scene.remove(axisLine);
    axisGeo.dispose();
    axisMat.dispose();
  }

  return {
    isModalActive: () => modal !== null,
    startModal,
    startModalObject,
    finishModal,
    cancelModal,
    handlePointerMove,
    handlePointerDown,
    setAxis,
    destroy,
  };
}

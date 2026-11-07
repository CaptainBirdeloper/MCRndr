import * as THREE from 'three';
import { BodyPartName, LightSpec } from '../../types';
import { MinecraftRig } from '../rig/rig';

export type HistoryAction =
  | {
      type: 'root_pos_axis';
      axis: 'x' | 'y' | 'z';
      prev: number;
      next: number;
    }
  | {
      type: 'root_rot_axis';
      axis: 'x' | 'y' | 'z';
      prev: number;
      next: number;
    }
  | {
      type: 'part_pos_axis';
      part: BodyPartName;
      axis: 'x' | 'y' | 'z';
      prev: number;
      next: number;
    }
  | {
      type: 'part_rot_axis';
      part: BodyPartName;
      axis: 'x' | 'y' | 'z';
      prev: number;
      next: number;
    }
  | {
      type: 'modal_transform';
      part: BodyPartName;
      prevPos: THREE.Vector3;
      prevQuat: THREE.Quaternion;
      nextPos: THREE.Vector3;
      nextQuat: THREE.Quaternion;
    }
  | {
      type: 'pose';
      prevRotations: Record<string, [number, number, number]>;
      nextRotations: Record<string, [number, number, number]>;
      prevRootPos: [number, number, number];
      nextRootPos: [number, number, number];
    }
  | {
      type: 'light_rig';
      prev: LightSpec[];
      next: LightSpec[];
      prevExposure: number;
      nextExposure: number;
    };

export interface HistoryCallbacks {
  notifyRootTransform: () => void;
  notifyPartTransform: (part: BodyPartName) => void;
  notifyAngleChange: (part: BodyPartName) => void;
  applyLightRig: (specs: LightSpec[], exposure: number) => void;
}

export interface HistoryManager {
  pushAction: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  commitPositionHistory: (axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitRotationHistory: (axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitPartPositionHistory: (part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitPartRotationHistory: (part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitLightHistory: (
    prev: LightSpec[],
    next: LightSpec[],
    prevExposure: number,
    nextExposure: number
  ) => void;
  setOnTransformListener: (cb: () => void) => void;
  setOnUndoListener: (cb: () => void) => void;
}

export function createHistoryManager(
  getRig: () => MinecraftRig,
  boxHelper: THREE.BoxHelper,
  callbacks: HistoryCallbacks
): HistoryManager {
  const undoStack: HistoryAction[] = [];
  const redoStack: HistoryAction[] = [];
  let onTransformCb: (() => void) | null = null;
  let onUndoCb: (() => void) | null = null;

  function pushAction(action: HistoryAction) {
    undoStack.push(action);
    if (undoStack.length > 50) undoStack.shift();
    redoStack.length = 0;
    if (action.type !== 'pose' && action.type !== 'light_rig') {
      onTransformCb?.();
    }
  }

  function commitAxisHistory(
    type: 'root_pos_axis' | 'root_rot_axis',
    axis: 'x' | 'y' | 'z',
    prev: number,
    next: number
  ) {
    if (prev === next) return;
    pushAction({
      type,
      axis,
      prev,
      next,
    });
  }

  function commitPositionHistory(axis: 'x' | 'y' | 'z', prev: number, next: number) {
    commitAxisHistory('root_pos_axis', axis, prev, next);
  }

  function commitRotationHistory(axis: 'x' | 'y' | 'z', prev: number, next: number) {
    commitAxisHistory('root_rot_axis', axis, prev, next);
  }

  function commitPartPositionHistory(part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) {
    pushAction({
      type: 'part_pos_axis',
      part,
      axis,
      prev,
      next,
    });
  }

  function commitPartRotationHistory(part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) {
    pushAction({
      type: 'part_rot_axis',
      part,
      axis,
      prev,
      next,
    });
  }

  function commitLightHistory(
    prev: LightSpec[],
    next: LightSpec[],
    prevExposure: number,
    nextExposure: number
  ) {
    if (prevExposure === nextExposure && JSON.stringify(prev) === JSON.stringify(next)) return;
    pushAction({ type: 'light_rig', prev, next, prevExposure, nextExposure });
  }

  function applyHistoryAction(action: HistoryAction, direction: 'prev' | 'next') {
    const rig = getRig();
    if (action.type === 'root_pos_axis') {
      const val = direction === 'prev' ? action.prev : action.next;
      rig.root.position[action.axis] = val / 100;
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    } else if (action.type === 'root_rot_axis') {
      const val = direction === 'prev' ? action.prev : action.next;
      rig.root.rotation[action.axis] = (val * Math.PI) / 180;
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    } else if (action.type === 'part_pos_axis') {
      const joint = rig.joints[action.part];
      if (joint) {
        const val = direction === 'prev' ? action.prev : action.next;
        joint.group.position[action.axis] = val / 100;
        boxHelper.setFromObject(joint.group);
        callbacks.notifyPartTransform(action.part);
      }
    } else if (action.type === 'part_rot_axis') {
      const joint = rig.joints[action.part];
      if (joint) {
        const val = direction === 'prev' ? action.prev : action.next;
        joint.group.rotation[action.axis] = (val * Math.PI) / 180;
        boxHelper.setFromObject(joint.group);
        callbacks.notifyPartTransform(action.part);
      }
    } else if (action.type === 'modal_transform') {
      const joint = rig.joints[action.part];
      if (joint) {
        joint.group.position.copy(direction === 'prev' ? action.prevPos : action.nextPos);
        joint.group.quaternion.copy(direction === 'prev' ? action.prevQuat : action.nextQuat);
        boxHelper.setFromObject(joint.group);
        if (action.part === 'root') {
          callbacks.notifyRootTransform();
        } else {
          callbacks.notifyAngleChange(action.part);
        }
      }
    } else if (action.type === 'pose') {
      const rotations = direction === 'prev' ? action.prevRotations : action.nextRotations;
      const rootPos = direction === 'prev' ? action.prevRootPos : action.nextRootPos;
      Object.entries(rotations).forEach(([name, targetEulerArr]) => {
        const part = name as BodyPartName;
        const joint = rig.joints[part];
        if (joint && targetEulerArr) {
          // EDGE CASE: targetEulerArr may not have 3 elements, causing NaN rotation angles
          joint.group.rotation.set(targetEulerArr[0], targetEulerArr[1], targetEulerArr[2]);
        }
      });
      // EDGE CASE: prevRootPos spread can pass unexpected array length to Vector3.set
      // EDGE CASE: nextRootPos spread can pass unexpected array length to Vector3.set
      rig.root.position.set(...rootPos);
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    } else if (action.type === 'light_rig') {
      const specs = direction === 'prev' ? action.prev : action.next;
      const exposure = direction === 'prev' ? action.prevExposure : action.nextExposure;
      callbacks.applyLightRig(specs, exposure);
    }
  }

  function undo() {
    const action = undoStack.pop();
    if (!action) return;
    onUndoCb?.();
    applyHistoryAction(action, 'prev');
    redoStack.push(action);
  }

  function redo() {
    const action = redoStack.pop();
    if (!action) return;
    applyHistoryAction(action, 'next');
    undoStack.push(action);
  }

  function reset() {
    undoStack.length = 0;
    redoStack.length = 0;
  }

  return {
    pushAction,
    undo,
    redo,
    reset,
    commitPositionHistory,
    commitRotationHistory,
    commitPartPositionHistory,
    commitPartRotationHistory,
    commitLightHistory,
    setOnTransformListener: (cb: () => void) => {
      onTransformCb = cb;
    },
    setOnUndoListener: (cb: () => void) => {
      onUndoCb = cb;
    },
  };
}

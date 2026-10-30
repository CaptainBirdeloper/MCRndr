import * as THREE from 'three';
import { BodyPartName } from '../../types';
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
    };

export interface HistoryCallbacks {
  notifyRootTransform: () => void;
  notifyPartTransform: (part: BodyPartName) => void;
  notifyAngleChange: (part: BodyPartName) => void;
}

export interface HistoryManager {
  pushAction: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  commitPositionHistory: (axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitRotationHistory: (axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitPartPositionHistory: (part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  commitPartRotationHistory: (part: BodyPartName, axis: 'x' | 'y' | 'z', prev: number, next: number) => void;
  setOnTransformListener: (cb: () => void) => void;
  setOnUndoListener: (cb: () => void) => void;
}

export function createHistoryManager(
  rig: MinecraftRig,
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
    if (action.type !== 'pose') {
      onTransformCb?.();
    }
  }

  function commitPositionHistory(axis: 'x' | 'y' | 'z', prev: number, next: number) {
    if (prev === next) return;
    pushAction({
      type: 'root_pos_axis',
      axis,
      prev,
      next,
    });
  }

  function commitRotationHistory(axis: 'x' | 'y' | 'z', prev: number, next: number) {
    if (prev === next) return;
    pushAction({
      type: 'root_rot_axis',
      axis,
      prev,
      next,
    });
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

  function undo() {
    const action = undoStack.pop();
    if (!action) return;
    onUndoCb?.();

    if (action.type === 'root_pos_axis') {
      rig.root.position[action.axis] = action.prev / 100;
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    } else if (action.type === 'root_rot_axis') {
      rig.root.rotation[action.axis] = (action.prev * Math.PI) / 180;
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    } else if (action.type === 'part_pos_axis') {
      const joint = rig.joints[action.part];
      if (joint) {
        joint.group.position[action.axis] = action.prev / 100;
        boxHelper.setFromObject(joint.group);
        callbacks.notifyPartTransform(action.part);
      }
    } else if (action.type === 'part_rot_axis') {
      const joint = rig.joints[action.part];
      if (joint) {
        joint.group.rotation[action.axis] = (action.prev * Math.PI) / 180;
        boxHelper.setFromObject(joint.group);
        callbacks.notifyPartTransform(action.part);
      }
    } else if (action.type === 'modal_transform') {
      const joint = rig.joints[action.part];
      if (joint) {
        joint.group.position.copy(action.prevPos);
        joint.group.quaternion.copy(action.prevQuat);
        boxHelper.setFromObject(joint.group);
        if (action.part === 'root') {
          callbacks.notifyRootTransform();
        } else {
          callbacks.notifyAngleChange(action.part);
        }
      }
    } else if (action.type === 'pose') {
      Object.entries(action.prevRotations).forEach(([name, targetEulerArr]) => {
        const part = name as BodyPartName;
        const joint = rig.joints[part];
        if (joint && targetEulerArr) {
          joint.group.rotation.set(targetEulerArr[0], targetEulerArr[1], targetEulerArr[2]);
        }
      });
      rig.root.position.set(...action.prevRootPos);
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    }

    redoStack.push(action);
  }

  function redo() {
    const action = redoStack.pop();
    if (!action) return;

    if (action.type === 'root_pos_axis') {
      rig.root.position[action.axis] = action.next / 100;
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    } else if (action.type === 'root_rot_axis') {
      rig.root.rotation[action.axis] = (action.next * Math.PI) / 180;
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    } else if (action.type === 'part_pos_axis') {
      const joint = rig.joints[action.part];
      if (joint) {
        joint.group.position[action.axis] = action.next / 100;
        boxHelper.setFromObject(joint.group);
        callbacks.notifyPartTransform(action.part);
      }
    } else if (action.type === 'part_rot_axis') {
      const joint = rig.joints[action.part];
      if (joint) {
        joint.group.rotation[action.axis] = (action.next * Math.PI) / 180;
        boxHelper.setFromObject(joint.group);
        callbacks.notifyPartTransform(action.part);
      }
    } else if (action.type === 'modal_transform') {
      const joint = rig.joints[action.part];
      if (joint) {
        joint.group.position.copy(action.nextPos);
        joint.group.quaternion.copy(action.nextQuat);
        boxHelper.setFromObject(joint.group);
        if (action.part === 'root') {
          callbacks.notifyRootTransform();
        } else {
          callbacks.notifyAngleChange(action.part);
        }
      }
    } else if (action.type === 'pose') {
      Object.entries(action.nextRotations).forEach(([name, targetEulerArr]) => {
        const part = name as BodyPartName;
        const joint = rig.joints[part];
        if (joint && targetEulerArr) {
          joint.group.rotation.set(targetEulerArr[0], targetEulerArr[1], targetEulerArr[2]);
        }
      });
      rig.root.position.set(...action.nextRootPos);
      boxHelper.setFromObject(rig.root);
      callbacks.notifyRootTransform();
    }

    undoStack.push(action);
  }

  return {
    pushAction,
    undo,
    redo,
    commitPositionHistory,
    commitRotationHistory,
    commitPartPositionHistory,
    commitPartRotationHistory,
    setOnTransformListener: (cb: () => void) => {
      onTransformCb = cb;
    },
    setOnUndoListener: (cb: () => void) => {
      onUndoCb = cb;
    },
  };
}

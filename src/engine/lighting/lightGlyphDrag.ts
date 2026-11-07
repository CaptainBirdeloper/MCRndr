import * as THREE from 'three';
import { LightSpec } from '../../types';
import { LightingManager } from './lightingManager';

export type LightHandleRole = 'body' | 'spot-angle' | 'target' | 'point-distance';

/** Minimum beam length the angle drag may operate on. */
const MIN_AIM = 0.5;
/** Minimum separation between light position and target. */
const MIN_TARGET_SEPARATION = 0.05;
const MIN_DISTANCE = 0.1;
const MAX_DISTANCE = 100;
const MIN_ANGLE = 0.05;
const MAX_ANGLE = 1.4;
const POSITION_LIMIT = 50;
const DRAG_THRESHOLD_PX = 3;

export interface LightGlyphDrag {
  begin: (e: MouseEvent) => boolean;
  move: (e: MouseEvent) => void;
  end: (e: MouseEvent) => boolean;
  cancel: () => void;
  isActive: () => boolean;
  handleSelectionChange: (id: string | null) => void;
  destroy: () => void;
}

export interface LightGlyphDragOptions {
  domElement: HTMLElement;
  camera: THREE.PerspectiveCamera;
  lightingManager: LightingManager;
  isBlocked: () => boolean;
  setNavigationEnabled: (enabled: boolean) => void;
  commitHistory: (
    prev: LightSpec[],
    next: LightSpec[],
    prevExposure: number,
    nextExposure: number
  ) => void;
}

interface DragState {
  pointerId: number;
  id: string;
  role: LightHandleRole;
  type: LightSpec['type'];
  startSpec: LightSpec;
  prevRig: LightSpec[];
  prevExposure: number;
  startClientX: number;
  startClientY: number;
  startHit: THREE.Vector3 | null;
  startPlanePoint: THREE.Vector3;
  startLen: number;
  startDir: THREE.Vector3;
  moved: boolean;
  captured: boolean;
}

function cloneSpec(spec: LightSpec): LightSpec {
  return {
    ...spec,
    position: [...spec.position] as [number, number, number],
    target: [...spec.target] as [number, number, number],
    shadow: { ...spec.shadow },
  };
}

export function createLightGlyphDrag(options: LightGlyphDragOptions): LightGlyphDrag {
  const { domElement, camera, lightingManager } = options;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const forward = new THREE.Vector3();

  let drag: DragState | null = null;
  let pending: MouseEvent | null = null;
  let frameId: number | null = null;

  function rayFromEvent(e: MouseEvent): boolean {
    const rect = domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return true;
  }

  function cameraForward(): THREE.Vector3 {
    camera.getWorldDirection(forward);
    return forward;
  }

  function planeHit(point: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 | null {
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
    const out = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, out) ? out : null;
  }

  function clampVec(v: THREE.Vector3): THREE.Vector3 {
    v.x = THREE.MathUtils.clamp(v.x, -POSITION_LIMIT, POSITION_LIMIT);
    v.y = THREE.MathUtils.clamp(v.y, -POSITION_LIMIT, POSITION_LIMIT);
    v.z = THREE.MathUtils.clamp(v.z, -POSITION_LIMIT, POSITION_LIMIT);
    return v;
  }

  function specVec(spec: LightSpec, key: 'position' | 'target'): THREE.Vector3 {
    const value = spec[key];
    return new THREE.Vector3(value[0], value[1], value[2]);
  }

  function toArr(v: THREE.Vector3): [number, number, number] {
    return [v.x, v.y, v.z];
  }

  function aimDir(spec: LightSpec): THREE.Vector3 {
    const dir = specVec(spec, 'target').sub(specVec(spec, 'position'));
    if (dir.lengthSq() > 1e-8) return dir.normalize();
    const pivot = lightingManager.getLightGroupById(spec.id)?.getObjectByName('glyph_pivot');
    if (pivot) {
      const quat = new THREE.Quaternion();
      pivot.getWorldQuaternion(quat);
      return new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    }
    return new THREE.Vector3(0, 0, 1);
  }

  function hasChanged(spec: LightSpec, start: LightSpec): boolean {
    return (
      spec.position.some((v, i) => v !== start.position[i]) ||
      spec.target.some((v, i) => v !== start.target[i]) ||
      spec.angle !== start.angle ||
      spec.distance !== start.distance
    );
  }

  function applyAngle(e: MouseEvent, state: DragState, spec: LightSpec): void {
    const pos = specVec(spec, 'position');
    const target = specVec(spec, 'target');
    let len = target.distanceTo(pos);
    let seedTarget: [number, number, number] | null = null;

    if (len < MIN_AIM) {
      target.copy(pos).addScaledVector(state.startDir, MIN_AIM);
      len = MIN_AIM;
      seedTarget = toArr(target);
    }

    const dir = target.clone().sub(pos).normalize();
    const base = pos.clone().addScaledVector(dir, len);
    let radius: number;
    const hit = planeHit(base, dir);

    if (hit && Math.abs(raycaster.ray.direction.dot(dir)) > 0.15) {
      radius = hit.distanceTo(base);
    } else {
      const rect = domElement.getBoundingClientRect();
      const ndc = base.clone().project(camera);
      const px = ((ndc.x + 1) / 2) * rect.width;
      const py = ((-ndc.y + 1) / 2) * rect.height;
      const radiusPx = Math.hypot(e.clientX - rect.left - px, e.clientY - rect.top - py);
      const worldPerPx = (2 * len * Math.tan((camera.fov * Math.PI) / 360)) / rect.height;
      radius = radiusPx * worldPerPx;
    }

    const angle = THREE.MathUtils.clamp(Math.atan(radius / len), MIN_ANGLE, MAX_ANGLE);
    const patch: Partial<LightSpec> = { angle };
    if (seedTarget) patch.target = seedTarget;
    lightingManager.updateLight(state.id, patch);
  }

  function apply(e: MouseEvent): void {
    const state = drag;
    if (!state) return;
    if (!rayFromEvent(e)) return;

    const current = lightingManager.getSpecs().find((s) => s.id === state.id);
    if (!current || current.type !== state.type) {
      cancel();
      return;
    }

    const fwd = cameraForward();
    const pos = specVec(current, 'position');

    if (state.role === 'body') {
      const hit = planeHit(state.startPlanePoint, fwd);
      if (!hit || !state.startHit) return;
      const startPos = specVec(state.startSpec, 'position');
      const startTarget = specVec(state.startSpec, 'target');
      const newPos = clampVec(startPos.clone().add(hit.sub(state.startHit)));
      const actual = newPos.clone().sub(startPos);
      const newTarget = clampVec(startTarget.add(actual));
      lightingManager.updateLight(state.id, {
        position: toArr(newPos),
        target: toArr(newTarget),
      });
      return;
    }

    if (state.role === 'target') {
      const hit = planeHit(state.startPlanePoint, fwd);
      if (!hit || !state.startHit) return;
      const startTarget = specVec(state.startSpec, 'target');
      const newTarget = clampVec(startTarget.add(hit.sub(state.startHit)));
      if (newTarget.distanceTo(pos) < MIN_TARGET_SEPARATION) {
        const dir = newTarget.clone().sub(pos);
        if (dir.lengthSq() < 1e-8) dir.copy(state.startDir);
        newTarget.copy(pos).addScaledVector(dir.normalize(), MIN_TARGET_SEPARATION);
        clampVec(newTarget);
      }
      lightingManager.updateLight(state.id, { target: toArr(newTarget) });
      return;
    }

    if (state.role === 'spot-angle') {
      applyAngle(e, state, current);
      return;
    }

    const hit = planeHit(state.startPlanePoint, fwd);
    if (!hit) return;
    const distance = THREE.MathUtils.clamp(hit.distanceTo(pos), MIN_DISTANCE, MAX_DISTANCE);
    lightingManager.updateLight(state.id, { distance });
  }

  function capturePointer(state: DragState): void {
    try {
      domElement.setPointerCapture(state.pointerId);
      state.captured = true;
    } catch {
      // Pointer already released (synthetic or cancelled event): drag still works
      // through the normal pointermove/up listeners.
      state.captured = false;
    }
  }

  function releasePointer(state: DragState): void {
    if (!state.captured) return;
    state.captured = false;
    try {
      domElement.releasePointerCapture(state.pointerId);
    } catch {
      // Capture is already gone; nothing to release.
    }
  }

  function cancel(): void {
    const state = drag;
    if (!state) return;
    drag = null;
    pending = null;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    options.setNavigationEnabled(true);
    releasePointer(state);
    if (!state.moved) return;

    const current = lightingManager.getSpecs().find((s) => s.id === state.id);
    if (!current || current.type !== state.type) return;
    lightingManager.updateLight(state.id, {
      position: [...state.startSpec.position] as [number, number, number],
      target: [...state.startSpec.target] as [number, number, number],
      angle: state.startSpec.angle,
      distance: state.startSpec.distance,
    });
  }

  function begin(e: MouseEvent): boolean {
    if (drag || options.isBlocked()) return false;
    if (e.button !== 0) return false;
    if (!rayFromEvent(e)) return false;

    const hits = raycaster.intersectObjects(lightingManager.getRaycastTargets(), false);
    const hit = hits.find((item) => typeof item.object.userData.lightHandle === 'string');
    if (!hit) return false;

    const role = hit.object.userData.lightHandle as LightHandleRole;
    const id = hit.object.userData.lightId as string | undefined;
    if (!id) return false;

    const specs = lightingManager.getSpecs();
    const spec = specs.find((s) => s.id === id);
    if (!spec) return false;
    if (role !== 'body' && lightingManager.getActiveLightId() !== id) return false;

    const state: DragState = {
      pointerId: (e as PointerEvent).pointerId ?? 0,
      id,
      role,
      type: spec.type,
      startSpec: cloneSpec(spec),
      prevRig: specs,
      prevExposure: lightingManager.getExposure(),
      startClientX: e.clientX,
      startClientY: e.clientY,
      startHit: null,
      startPlanePoint: new THREE.Vector3(),
      startLen: 0,
      startDir: aimDir(spec),
      moved: false,
      captured: false,
    };

    const fwd = cameraForward();
    const pos = specVec(spec, 'position');
    const target = specVec(spec, 'target');

    if (role === 'body' || role === 'point-distance') {
      state.startPlanePoint.copy(pos);
      state.startHit = planeHit(state.startPlanePoint, fwd);
    } else if (role === 'target') {
      state.startPlanePoint.copy(target);
      state.startHit = planeHit(state.startPlanePoint, fwd);
    } else {
      state.startLen = target.distanceTo(pos);
      state.startPlanePoint
        .copy(pos)
        .addScaledVector(state.startDir, Math.max(state.startLen, MIN_AIM));
    }

    if ((role === 'body' || role === 'target' || role === 'point-distance') && !state.startHit) {
      return false;
    }

    drag = state;
    capturePointer(state);
    options.setNavigationEnabled(false);

    if (lightingManager.getActiveLightId() !== id) {
      lightingManager.selectLight(id);
    }
    return true;
  }

  function move(e: MouseEvent): void {
    const state = drag;
    if (!state) return;

    if (!state.moved) {
      const dist = Math.hypot(e.clientX - state.startClientX, e.clientY - state.startClientY);
      if (dist < DRAG_THRESHOLD_PX) return;
      state.moved = true;
    }

    pending = e;
    if (frameId !== null) return;
    frameId = requestAnimationFrame(() => {
      frameId = null;
      const next = pending;
      pending = null;
      if (next) apply(next);
    });
  }

  function end(e: MouseEvent): boolean {
    const state = drag;
    if (!state) return false;

    const last = pending;
    pending = null;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (last) apply(last);

    drag = null;
    options.setNavigationEnabled(true);
    releasePointer(state);

    if (!state.moved) return false;

    const next = lightingManager.getSpecs();
    const current = next.find((s) => s.id === state.id);
    if (current && hasChanged(current, state.startSpec)) {
      options.commitHistory(state.prevRig, next, state.prevExposure, lightingManager.getExposure());
    }
    void e;
    return true;
  }

  function handleSelectionChange(id: string | null): void {
    if (drag && id !== drag.id) cancel();
  }

  function destroy(): void {
    cancel();
  }

  return {
    begin,
    move,
    end,
    cancel,
    isActive: () => drag !== null,
    handleSelectionChange,
    destroy,
  };
}

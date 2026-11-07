import * as THREE from 'three';

// First-person look: left-drag rotates the camera in place (yaw/pitch) instead of
// orbiting a target, so the view moves exactly like a game camera. WASD then moves
// the camera itself, and the wheel dollies along the view axis.
const MIN_PITCH = -1.5; // ~86 degrees down
const MAX_PITCH = 1.5; // ~86 degrees up
const DRAG_DEADZONE_PX = 3; // below this a press is a selection click, not a look
const MIN_TARGET_DISTANCE = 0.9; // keeps the orbit target far enough ahead for the wheel
// OrbitControls turns 2π per viewport height at 1.0x; half of that is a comfortable
// default here, and the slider scales the rest
const SENSITIVITY_SCALE = 0.5;
const SMOOTHING = 18; // exponential ease rate; higher is snappier

export interface LookControlsOptions {
  domElement: HTMLElement;
  camera: THREE.PerspectiveCamera;
  target: THREE.Vector3;
  sensitivity: () => number;
  isBlocked: () => boolean;
  // Fires once per drag as it leaves the deadzone; used to drop camera view before moving
  onStart?: () => void;
}

export interface LookControls {
  setEnabled: (enabled: boolean) => void;
  syncFromCamera: () => void;
  destroy: () => void;
}

export function createLookControls(options: LookControlsOptions): LookControls {
  const { domElement, camera, target, sensitivity, isBlocked, onStart } = options;

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const forward = new THREE.Vector3();

  let enabled = false;
  let armed = false; // pressed, but still inside the deadzone
  let dragging = false;
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;

  // Rendered angles ease toward the drag target so the motion never snaps
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;

  let animId = 0;
  let lastFrameTime = 0;

  function applyAngles() {
    euler.set(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    // Keep the orbit target directly ahead so the wheel dolly still reads as forward/back
    const dist = Math.max(camera.position.distanceTo(target), MIN_TARGET_DISTANCE);
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    target.copy(camera.position).addScaledVector(forward, dist);
  }

  function tick(now: number) {
    animId = 0;
    // EDGE CASE: a backgrounded tab hands back a huge timestamp, which would jump the view
    const dt = lastFrameTime ? Math.min((now - lastFrameTime) / 1000, 0.05) : 1 / 60;
    lastFrameTime = now;

    const ease = 1 - Math.exp(-SMOOTHING * dt);
    yaw += (targetYaw - yaw) * ease;
    pitch += (targetPitch - pitch) * ease;

    const settled = Math.abs(targetYaw - yaw) < 1e-4 && Math.abs(targetPitch - pitch) < 1e-4;
    if (settled) {
      yaw = targetYaw;
      pitch = targetPitch;
      lastFrameTime = 0;
    }
    applyAngles();
    if (!settled) animId = requestAnimationFrame(tick);
  }

  function startEasing() {
    if (animId) return;
    lastFrameTime = 0;
    animId = requestAnimationFrame(tick);
  }

  function syncFromCamera() {
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw = targetYaw = euler.y;
    pitch = targetPitch = Math.min(Math.max(euler.x, MIN_PITCH), MAX_PITCH);
    applyAngles();
  }

  function onPointerMove(e: PointerEvent) {
    if (!armed || e.pointerId !== pointerId) return;
    // EDGE CASE: releasing outside the window fires no pointerup here, so the next hover would look
    if (e.buttons === 0) {
      stopTracking();
      return;
    }

    if (!dragging) {
      if (Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_DEADZONE_PX) return;
      dragging = true;
      onStart?.();
      // Re-base so the deadzone distance does not leak into the first rotation
      lastX = e.clientX;
      lastY = e.clientY;
      return;
    }

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    const sens =
      ((2 * Math.PI) / Math.max(domElement.clientHeight, 1)) * sensitivity() * SENSITIVITY_SCALE;
    // Drag right looks right; drag down looks down
    targetYaw -= dx * sens;
    // EDGE CASE: clamping the target instead of the rendered angle keeps the ease from pushing past straight up/down
    targetPitch = Math.min(Math.max(targetPitch - dy * sens, MIN_PITCH), MAX_PITCH);
    startEasing();
  }

  function stopTracking() {
    armed = false;
    dragging = false;
    pointerId = -1;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
    window.removeEventListener('blur', stopTracking);
  }

  function onPointerUp(e: PointerEvent) {
    if (e.pointerId !== pointerId) return;
    stopTracking();
  }

  function onPointerDown(e: PointerEvent) {
    if (!enabled || e.button !== 0 || isBlocked()) return;
    armed = true;
    dragging = false;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    syncFromCamera();
    // EDGE CASE: listening on window keeps the look alive when the cursor leaves the canvas mid-drag
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    // EDGE CASE: alt-tab mid-drag never delivers pointerup to the page
    window.addEventListener('blur', stopTracking);
  }

  domElement.addEventListener('pointerdown', onPointerDown);

  return {
    setEnabled(next: boolean) {
      enabled = next;
      if (enabled) {
        syncFromCamera();
      } else {
        stopTracking();
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
          lastFrameTime = 0;
        }
      }
    },
    syncFromCamera,
    destroy() {
      stopTracking();
      if (animId) cancelAnimationFrame(animId);
      domElement.removeEventListener('pointerdown', onPointerDown);
    },
  };
}

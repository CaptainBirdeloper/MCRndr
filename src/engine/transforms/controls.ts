import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BodyPartName, TransformMode, PosePreset, CameraItem, LightSpec } from '../../types';
import { MinecraftRig } from '../rig/rig';
import { createCameraManager, ManagedCamera } from '../camera/cameraManager';
import { LightingManager } from '../lighting/lightingManager';
import { createHistoryManager, HistoryAction } from './history';
import { createModalTransformEngine, ModalTransform } from './modalTransform';
import { PlayerManager } from '../players/playerManager';
import { createLookControls, LookControls } from '../camera/lookControls';
import { createLightGlyphDrag, LightGlyphDrag } from '../lighting/lightGlyphDrag';
import { loadSettings, CameraControlMode } from '../../utils/settings';

export type { ManagedCamera, HistoryAction, ModalTransform };

export type ScenePick =
  | { kind: 'light'; id: string }
  | { kind: 'player'; id: string };

export interface RigControlsManager {
  selectedPart: BodyPartName | null;
  transformMode: TransformMode;
  space: 'local' | 'world';
  selectPart: (part: BodyPartName | null) => void;
  setActiveRig: (rig: MinecraftRig) => void;
  setMode: (mode: TransformMode) => void;
  toggleSpace: () => void;
  resetSelectedPart: () => void;
  applyPose: (preset: PosePreset, durationMs?: number) => void;
  getCameras: () => CameraItem[];
  getActiveCameraId: () => string | null;
  getCameraById: (id: string) => THREE.PerspectiveCamera | null;
  getCameraHelpers: () => THREE.Object3D[];
  exitCameraView: () => void;
  addCamera: () => void;
  cycleCamera: () => void;
  selectCamera: (id: string) => void;
  toggleCameraVisibility: (id?: string) => void;
  deleteCamera: (id: string) => void;
  setCameraFov: (id: string, fov: number) => void;
  getCameraFov: (id: string) => number;
  setPerpetualFov: (fov: number) => void;
  getPerpetualFov: () => number;
  setCameraControlMode: (mode: CameraControlMode) => void;
  pickObjectAt: (clientX: number, clientY: number) => ScenePick | null;
  setLightContextListener: (cb: ((id: string) => void) | null) => void;
  pickGroundPoint: (clientX: number, clientY: number) => { x: number; z: number } | null;
  isModalActive: () => boolean;
  framePlayersIfNeeded: () => void;
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
  commitLightHistory: (prev: LightSpec[], next: LightSpec[], prevExposure: number, nextExposure: number) => void;
  setOnTransformListener: (cb: () => void) => void;
  setOnUndoListener: (cb: () => void) => void;
  captureCurrentPose: (id: string, name: string) => PosePreset;
  destroy: () => void;
}

function stripPlanarHandles(gizmoHelper: THREE.Object3D) {
  const gh = gizmoHelper as any;
  ['gizmo', 'picker', 'helper'].forEach((dictName) => {
    // EDGE CASE: accessing private Three.js TransformControls internal hierarchy ('translate') may break across Three.js versions
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
  onSelectionChange?: (part: BodyPartName | null, rotDeg: [number, number, number]) => void,
  playerManager?: PlayerManager
): RigControlsManager {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  let selectedPart: BodyPartName | null = null;
  let transformMode: TransformMode = 'translate';
  let space: 'local' | 'world' = 'local';
  let wholeBodyMode = true;

  const gizmo = new TransformControls(camera, domElement);
  gizmo.size = 0.75;
  gizmo.setMode('translate');
  gizmo.setSpace('local');
  const gizmoHelper = gizmo.getHelper();
  stripPlanarHandles(gizmoHelper);
  scene.add(gizmoHelper);

  const boxHelper = new THREE.BoxHelper(rig.root, 0x38bdf8);
  // EDGE CASE: box edges are coplanar with the part faces, z-fighting renders them as dotted hairlines
  const boxMat = boxHelper.material as THREE.LineBasicMaterial;
  boxMat.depthTest = false;
  boxMat.transparent = true;
  boxMat.opacity = 0.85;
  boxHelper.renderOrder = 996;
  boxHelper.visible = false;
  scene.add(boxHelper);

  let lightDrag: LightGlyphDrag | null = null;

  const lookControls: LookControls = createLookControls({
    domElement,
    camera,
    target: orbitControls.target,
    // Reuse the persisted sensitivity slider so both camera modes feel alike
    sensitivity: () => orbitControls.rotateSpeed,
    isBlocked: () =>
      gizmo.dragging || modalTransformEngine.isModalActive() || (lightDrag?.isActive() ?? false),
    // Dragging to look must drop camera view, otherwise the user stays locked to the camera
    onStart: () => cameraManager.exitCameraView(),
  });

  function setRayFromScreen(clientX: number, clientY: number) {
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
  }

  // Single depth-sorted pass: separate light/player raycasts let a glyph behind a
  // player win purely because it was tested first.
  function raycastScene(
    clientX: number,
    clientY: number
  ): { hit: THREE.Intersection; lightId?: string; playerId?: string } | null {
    setRayFromScreen(clientX, clientY);

    const hits: THREE.Intersection[] = [];
    if (lightingManager) {
      hits.push(...raycaster.intersectObjects(lightingManager.getRaycastTargets(), true));
    }
    const meshes: THREE.Object3D[] = [];
    (playerManager ? playerManager.getAllRigs() : [rig]).forEach((targetRig) => {
      targetRig.root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && child.userData.isBodyPart) meshes.push(child);
      });
    });
    hits.push(...raycaster.intersectObjects(meshes, true));
    if (hits.length === 0) return null;

    hits.sort((a, b) => a.distance - b.distance);
    const hit = hits[0];
    const lightId = hit.object.userData.lightId as string | undefined;
    if (lightId) return { hit, lightId };
    let node: THREE.Object3D | null = hit.object;
    while (node && !node.userData.playerId) node = node.parent;
    const playerId = node?.userData.playerId as string | undefined;
    return playerId ? { hit, playerId } : { hit };
  }

  function pickObjectAt(clientX: number, clientY: number): ScenePick | null {
    const result = raycastScene(clientX, clientY);
    if (result?.lightId) return { kind: 'light', id: result.lightId };
    if (result?.playerId) return { kind: 'player', id: result.playerId };
    return null;
  }

  // Where the right-click landed on the stage floor; null when the ray points at the sky
  function pickGroundPoint(clientX: number, clientY: number): { x: number; z: number } | null {
    setRayFromScreen(clientX, clientY);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, point)) return null;
    const limit = 4.5;
    return { x: THREE.MathUtils.clamp(point.x, -limit, limit), z: THREE.MathUtils.clamp(point.z, -limit, limit) };
  }

  // EDGE CASE: slot positions march right at PLAYER_SPACING, so player 4+ spawns outside
  // the default 38° frame and "+ Add Player" looks like a no-op. Only reframe when the
  // newly active rig is actually off-screen, so a user-placed camera is left alone.
  function framePlayersIfNeeded() {
    const rigs = playerManager ? playerManager.getAllRigs() : [rig];
    const active = playerManager ? playerManager.getActiveRig() : rig;
    camera.updateMatrixWorld();
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    );
    if (frustum.intersectsBox(new THREE.Box3().setFromObject(active.root))) return;

    const all = new THREE.Box3();
    rigs.forEach((r) => all.expandByObject(r.root));
    const center = all.getCenter(new THREE.Vector3());
    const size = all.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y) * 0.5 + 0.4;
    const distance = radius / Math.tan((camera.fov * Math.PI) / 360);
    orbitControls.target.set(center.x, center.y, center.z);
    camera.position.set(center.x, Math.max(center.y, 1.4), center.z + Math.max(distance, 3));
    orbitControls.update();
  }

  function setCameraControlMode(mode: CameraControlMode) {
    // EDGE CASE: leaving rotate enabled would let OrbitControls and the look controller write camera.position in the same frame
    orbitControls.enableRotate = mode === 'orbit';
    lookControls.setEnabled(mode === 'look');
  }

  // Apply the persisted mode immediately so a reload does not require opening Settings
  setCameraControlMode(loadSettings().cameraControlMode);

  lightingManager?.setSelectionListener((id) => {
    lightDrag?.handleSelectionChange(id);
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

  const cameraManager = createCameraManager(scene, camera, orbitControls);
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
    // EDGE CASE: rig.joints[part] may be undefined for unmapped or invalid part names, throwing TypeError on .group
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

  const historyManager = createHistoryManager(() => rig, boxHelper, {
    notifyRootTransform,
    notifyPartTransform,
    notifyAngleChange,
    applyLightRig: (specs, exposure) => {
      if (!lightingManager) return;
      lightingManager.applyRig(specs);
      lightingManager.setExposure(exposure);
    },
  });

  const modalTransformEngine = createModalTransformEngine(
    scene,
    camera,
    domElement,
    () => rig,
    orbitControls,
    gizmo,
    boxHelper,
    historyManager,
    {
      notifyRootTransform,
      notifyAngleChange,
    }
  );

  if (lightingManager) {
    lightDrag = createLightGlyphDrag({
      domElement,
      camera,
      lightingManager,
      isBlocked: () => gizmo.dragging || modalTransformEngine.isModalActive(),
      setNavigationEnabled: (enabled) => {
        orbitControls.enabled = enabled;
      },
      commitHistory: historyManager.commitLightHistory,
    });
  }

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
      lightDrag?.cancel();
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

  function setActiveRig(nextRig: MinecraftRig) {
    if (rig === nextRig) return;
    if (modalTransformEngine.isModalActive()) {
      modalTransformEngine.finishModal(selectedPart);
    }
    gizmo.detach();
    rig = nextRig;    selectedPart = null;
    historyManager.reset();
    boxHelper.setFromObject(rig.root);
    boxHelper.visible = false;
    gizmo.getHelper().visible = false;
    onSelectionChange?.(null, [0, 0, 0]);
    if (wholeBodyMode) {
      selectPart('root');
    }
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

  let pointerDownPos = { x: 0, y: 0 };
  let onLightContextCb: ((id: string) => void) | null = null;

  function onPointerDown(e: MouseEvent) {
    pointerDownPos = { x: e.clientX, y: e.clientY };
    if (lightDrag?.begin(e)) {
      e.stopPropagation();
      return;
    }
    if (modalTransformEngine.handlePointerDown(e, selectedPart)) {
      e.stopPropagation();
    }
  }

  function onPointerMove(e: MouseEvent) {
    lightDrag?.move(e);
    modalTransformEngine.handlePointerMove(e, selectedPart);
  }

  function onPointerUp(e: MouseEvent) {
    if (lightDrag?.end(e)) return;
    if (modalTransformEngine.isModalActive()) return;

    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > 5) return;

    const result = raycastScene(e.clientX, e.clientY);

    // Right-click on a light glyph: select it and open the floating modal here, so
    // the modal never depends on React's contextmenu ordering.
    if (e.button === 2) {
      if (result?.lightId) {
        selectPart(null);
        lightingManager?.selectLight(result.lightId);
        onLightContextCb?.(result.lightId);
      }
      return;
    }
    if (e.button !== 0) return;

    if (result?.lightId) {
      selectPart(null);
      lightingManager?.selectLight(result.lightId);
      return;
    }

    if (result?.playerId) {
      lightingManager?.selectLight(null);
      if (playerManager && result.playerId !== playerManager.getActiveId()) {
        playerManager.selectPlayer(result.playerId);
      }
      if (wholeBodyMode) {
        selectPart('root');
        return;
      }
      const partName = result.hit.object.userData.partName as BodyPartName;
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

  // G/R press twice in a row to grab the cursor; once to just swap the gizmo
  const DOUBLE_PRESS_MS = 320;
  let lastTransformPress: { code: string; time: number } | null = null;

  function isDoublePress(code: string): boolean {
    const now = performance.now();
    const doubled = lastTransformPress?.code === code && now - lastTransformPress.time < DOUBLE_PRESS_MS;
    lastTransformPress = doubled ? null : { code, time: now };
    return doubled;
  }

  function onKeyDown(e: KeyboardEvent) {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (isCtrlOrCmd && e.code === 'KeyZ') {
      e.preventDefault();
      (e.target as HTMLElement)?.blur();
      lightDrag?.cancel();
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
      lightDrag?.cancel();
      historyManager.redo();
      return;
    }

    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (!modalTransformEngine.isModalActive() && e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
    } else if (e.code === 'KeyG' || e.code === 'KeyR') {
      e.preventDefault();
      const mode: TransformMode = e.code === 'KeyG' ? 'translate' : 'rotate';
      // A second press of the same key within the window grabs the cursor;
      // a single press only swaps the gizmo mode
      const doublePress = !e.repeat && isDoublePress(e.code);
      setMode(mode);

      if (doublePress) {
        const activeLightId = lightingManager?.getActiveLightId();
        if (activeLightId) {
          const lightGroup = lightingManager!.getLightGroupById(activeLightId);
          if (lightGroup) {
            modalTransformEngine.startModalObject(mode, lightGroup);
            return;
          }
        }
        if (wholeBodyMode && selectedPart !== 'root') {
          selectPart('root');
        }
        modalTransformEngine.startModal(mode, selectedPart);
        return;
      }

      // Single press: lights have no persistent gizmo drag, so keep the old grab for them
      if (lightingManager?.getActiveLightId()) {
        const activeLightId = lightingManager.getActiveLightId();
        const lightGroup = activeLightId ? lightingManager.getLightGroupById(activeLightId) : null;
        if (lightGroup) modalTransformEngine.startModalObject(mode, lightGroup);
      }
    } else if (e.code === 'KeyX' || e.code === 'KeyY' || e.code === 'KeyZ') {
      const axis = e.code === 'KeyX' ? 'x' : e.code === 'KeyY' ? 'y' : 'z';
      if (modalTransformEngine.isModalActive() || selectedPart) {
        e.preventDefault();
        modalTransformEngine.setAxis(axis, selectedPart, transformMode);
      }
    } else if (e.code === 'KeyQ') {
      toggleSpace();
    } else if (e.code === 'Escape') {
      if (lightDrag?.isActive()) {
        lightDrag.cancel();
      } else if (modalTransformEngine.isModalActive()) {
        modalTransformEngine.cancelModal(selectedPart);
      } else if (lightingManager?.getActiveLightId()) {
        lightingManager.selectLight(null);
      } else {
        selectPart(null);
      }
    }
  }

  let poseAnimId: number | null = null;

  // EDGE CASE: durationMs <= 0 causes division by zero (NaN/Infinity progress), corrupting slerp quaternion interpolation
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
      prevRotations[part] = [joint.group.rotation.x, joint.group.rotation.y, joint.group.rotation.z];
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
      startQuats[part] = joint.group.quaternion.clone();
      // EDGE CASE: preset.rotations may be undefined or limb array truncated, throwing TypeError or creating NaN Euler angles
      const targetEulerArr = preset.rotations[part] || [0, 0, 0];
      const targetEuler = new THREE.Euler(targetEulerArr[0], targetEulerArr[1], targetEulerArr[2]);
      targetQuats[part] = new THREE.Quaternion().setFromEuler(targetEuler);
    });

    const startRootPos = rig.root.position.clone();
    // EDGE CASE: preset.rootPosition with fewer than 3 coordinates will initialize Vector3 axes with undefined/NaN
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

  function onPointerCancel() {
    lightDrag?.cancel();
  }

  function onWindowBlur() {
    lightDrag?.cancel();
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('keydown', onKeyDown);

  function destroy() {
    if (poseAnimId) cancelAnimationFrame(poseAnimId);
    lookControls.destroy();
    cameraManager.destroy();
    modalTransformEngine.destroy();
    lightDrag?.destroy();
    lightDrag = null;
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('pointercancel', onPointerCancel);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('keydown', onKeyDown);
    gizmo.detach();
    gizmo.dispose();
    scene.remove(gizmo.getHelper());
    scene.remove(boxHelper);
    boxHelper.dispose();
  }

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
    setActiveRig,
    setMode,
    toggleSpace,
    resetSelectedPart,
    applyPose,
    getCameras: cameraManager.getCameras,
    getActiveCameraId: cameraManager.getActiveCameraId,
    getCameraById: cameraManager.getCameraById,
    getCameraHelpers: cameraManager.getCameraHelpers,
    exitCameraView: cameraManager.exitCameraView,
    addCamera: cameraManager.addCamera,
    cycleCamera: cameraManager.cycleCamera,
    selectCamera: cameraManager.selectCamera,
    toggleCameraVisibility: cameraManager.toggleCameraVisibility,
    deleteCamera: cameraManager.deleteCamera,
    setCameraFov: cameraManager.setCameraFov,
    getCameraFov: cameraManager.getCameraFov,
    setPerpetualFov: cameraManager.setPerpetualFov,
    getPerpetualFov: cameraManager.getPerpetualFov,
    setCameraControlMode,
    pickObjectAt,
    setLightContextListener: (cb) => {
      onLightContextCb = cb;
    },
    pickGroundPoint,
    isModalActive: () => modalTransformEngine.isModalActive() || (lightDrag?.isActive() ?? false),
    framePlayersIfNeeded,
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
    commitLightHistory: historyManager.commitLightHistory,
    setOnTransformListener: historyManager.setOnTransformListener,
    setOnUndoListener: historyManager.setOnUndoListener,
    captureCurrentPose: (id: string, name: string): PosePreset => {
      const rotations: Record<string, [number, number, number]> = {};
      Object.keys(rig.joints).forEach((k) => {
        const part = k as BodyPartName;
        const joint = rig.joints[part];
        rotations[part] = [joint.group.rotation.x, joint.group.rotation.y, joint.group.rotation.z];
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

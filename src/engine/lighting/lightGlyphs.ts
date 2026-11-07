import * as THREE from 'three';
import { LightSpec, LightType } from '../../types';

const RING_SEGMENTS = 28;
const SUN_RAYS = 8;
const CONE_RIBS = 8;
const MIN_AXIS = 0.001;

/** Screen-space constant widget size: world units per camera-distance unit. */
const SCALE_PER_DISTANCE = 0.04;
const SCALE_MIN = 0.12;
const SCALE_MAX = 3;

/** Compact handle sizes (unit geometry, multiplied by the screen scale). */
const COMPACT_DISC = 0.5;
const COMPACT_RAY_INNER = 0.62;
const COMPACT_RAY_OUTER = 0.85;
const COMPACT_SPOT_RADIUS = 0.35;
const COMPACT_SPOT_LENGTH = 0.9;

export interface LightGlyph extends THREE.Group {
  /** Rotated to face the light target (+Z = beam direction). */
  pivot: THREE.Group;
  /** Small always-on handle (inactive lights). */
  compact: THREE.Group;
  /** Full Blender-style widget (active light only). */
  detail: THREE.Group;
  /** Uniformly screen-scaled handle drawn at the light position. */
  body: THREE.Group;
  /** Non-uniformly scaled spot cone (x/y = base radius, z = length). */
  cone: THREE.Group | null;
  /** Unit-length beam axis along +Z, scaled to the target distance. */
  axis: THREE.Line | null;
  /** Arrowhead at the target. */
  head: THREE.Group | null;
  /** Small cross at the target. */
  cross: THREE.Group | null;
  /** Point-light falloff ring at spec.distance. */
  falloff: THREE.LineLoop | null;
  /** Invisible drag handle on the spot cone base ring (angle). */
  coneHandle: THREE.Mesh | null;
  /** Invisible drag handle at the beam target (aim). */
  targetHandle: THREE.Mesh | null;
  /** Invisible drag handle on the point falloff ring (distance). */
  falloffHandle: THREE.Mesh | null;
}

function circlePoints(
  radius: number,
  segments: number,
  axis: 'xy' | 'xz' | 'yz'
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const c = Math.cos(t) * radius;
    const s = Math.sin(t) * radius;
    if (axis === 'xy') points.push(new THREE.Vector3(c, s, 0));
    else if (axis === 'xz') points.push(new THREE.Vector3(c, 0, s));
    else points.push(new THREE.Vector3(0, c, s));
  }
  return points;
}

function makeLine(
  points: THREE.Vector3[],
  material: THREE.LineBasicMaterial,
  loop = false
): THREE.Line | THREE.LineLoop {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const line = loop ? new THREE.LineLoop(geo, material) : new THREE.Line(geo, material);
  line.renderOrder = 999;
  return line;
}

function circle(
  radius: number,
  axis: 'xy' | 'xz' | 'yz',
  material: THREE.LineBasicMaterial
): THREE.LineLoop {
  return makeLine(circlePoints(radius, RING_SEGMENTS, axis), material, true) as THREE.LineLoop;
}

function rays(
  inner: number,
  outer: number,
  count: number,
  material: THREE.LineBasicMaterial
): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    out.push(
      makeLine(
        [new THREE.Vector3(dx * inner, dy * inner, 0), new THREE.Vector3(dx * outer, dy * outer, 0)],
        material
      )
    );
  }
  return out;
}

function buildSun(material: THREE.LineBasicMaterial): THREE.Group {
  const body = new THREE.Group();
  body.add(circle(1, 'xy', material));
  rays(1.15, 1.5, SUN_RAYS, material).forEach((line) => body.add(line));
  return body;
}

function buildPoint(material: THREE.LineBasicMaterial): THREE.Group {
  const body = new THREE.Group();
  body.add(circle(1, 'xy', material));
  body.add(circle(1, 'xz', material));
  body.add(circle(1, 'yz', material));
  return body;
}

function buildSpotBody(material: THREE.LineBasicMaterial): THREE.Group {
  const body = new THREE.Group();
  body.add(circle(0.32, 'xy', material));
  rays(0.32, 0.52, 4, material).forEach((line) => body.add(line));
  return body;
}

/** Unit cone: apex at origin, base ring radius 1 at z = 1. */
function buildCone(material: THREE.LineBasicMaterial): THREE.Group {
  const cone = new THREE.Group();
  const base = circlePoints(1, RING_SEGMENTS, 'xy').map((p) => p.setZ(1));
  cone.add(makeLine(base, material, true));
  for (let i = 0; i < CONE_RIBS; i++) {
    const a = (i / CONE_RIBS) * Math.PI * 2;
    cone.add(
      makeLine(
        [new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(a), Math.sin(a), 1)],
        material
      )
    );
  }
  return cone;
}

/** Small, clean handle: no beam, no target markers. */
function buildCompact(type: LightType, material: THREE.LineBasicMaterial): THREE.Group {
  const compact = new THREE.Group();
  compact.name = 'glyph_compact';
  if (type === 'directional') {
    compact.add(circle(COMPACT_DISC, 'xy', material));
    rays(COMPACT_RAY_INNER, COMPACT_RAY_OUTER, SUN_RAYS, material).forEach((line) =>
      compact.add(line)
    );
  } else if (type === 'spot') {
    compact.add(circle(COMPACT_SPOT_RADIUS, 'xy', material));
    const cone = buildCone(material);
    cone.scale.set(COMPACT_SPOT_RADIUS, COMPACT_SPOT_RADIUS, COMPACT_SPOT_LENGTH);
    compact.add(cone);
  } else if (type === 'point') {
    compact.add(circle(COMPACT_DISC, 'xy', material));
    compact.add(circle(COMPACT_DISC, 'xz', material));
    compact.add(circle(COMPACT_DISC, 'yz', material));
  }
  return compact;
}

function buildHead(material: THREE.LineBasicMaterial): THREE.Group {
  const head = new THREE.Group();
  const base = circlePoints(0.18, 4, 'xy').map((p) => p.setZ(0));
  head.add(makeLine(base, material, true));
  for (const p of base) {
    head.add(makeLine([p.clone(), new THREE.Vector3(0, 0, 0.45)], material));
  }
  return head;
}

function buildCross(material: THREE.LineBasicMaterial): THREE.Group {
  const cross = new THREE.Group();
  cross.add(makeLine([new THREE.Vector3(-0.3, 0, 0), new THREE.Vector3(0.3, 0, 0)], material));
  cross.add(makeLine([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0, 0.3, 0)], material));
  return cross;
}

export function createLightGlyph(type: LightType, color: string | number = 0xfff3e0): LightGlyph {
  const group = new THREE.Group() as LightGlyph;
  group.name = `light_glyph_${type}`;

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const pivot = new THREE.Group();
  pivot.name = 'glyph_pivot';
  group.add(pivot);
  group.pivot = pivot;

  const compact = buildCompact(type, material);
  pivot.add(compact);
  group.compact = compact;

  const detail = new THREE.Group();
  detail.name = 'glyph_detail';
  pivot.add(detail);
  group.detail = detail;

  const body = new THREE.Group();
  body.name = 'glyph_body';
  detail.add(body);
  group.body = body;

  group.cone = null;
  group.axis = null;
  group.head = null;
  group.cross = null;
  group.falloff = null;
  group.coneHandle = null;
  group.targetHandle = null;
  group.falloffHandle = null;

  if (type === 'directional') {
    body.add(buildSun(material));
  } else if (type === 'spot') {
    body.add(buildSpotBody(material));
    const cone = buildCone(material);
    cone.name = 'glyph_cone';
    detail.add(cone);
    group.cone = cone;
  } else if (type === 'point') {
    body.add(buildPoint(material));
    const falloffMat = material.clone();
    falloffMat.opacity = 0.35;
    const falloff = circle(1, 'xz', falloffMat);
    falloff.name = 'glyph_falloff';
    falloff.visible = false;
    group.add(falloff);
    group.falloff = falloff;
  } else {
    // Ambient has no spatial handle; the manager never adds a glyph for it.
    return group;
  }

  if (type === 'directional' || type === 'spot') {
    const axis = makeLine([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)], material);
    axis.name = 'glyph_axis';
    detail.add(axis);
    group.axis = axis;

    const head = buildHead(material);
    head.name = 'glyph_head';
    detail.add(head);
    group.head = head;

    const cross = buildCross(material);
    cross.name = 'glyph_cross';
    detail.add(cross);
    group.cross = cross;
  }

  const hitMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitMesh.name = 'light_hit_target';
  hitMesh.userData.isLight = true;
  hitMesh.userData.lightHandle = 'body';
  group.add(hitMesh);

  const handleMaterial = new THREE.MeshBasicMaterial({ visible: false });

  if (type === 'spot') {
    const coneHandle = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 32), handleMaterial);
    coneHandle.name = 'light_handle_cone';
    coneHandle.userData.isLight = true;
    coneHandle.userData.lightHandle = 'spot-angle';
    detail.add(coneHandle);
    group.coneHandle = coneHandle;
  }

  if (type === 'directional' || type === 'spot') {
    const targetHandle = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), handleMaterial);
    targetHandle.name = 'light_handle_target';
    targetHandle.userData.isLight = true;
    targetHandle.userData.lightHandle = 'target';
    detail.add(targetHandle);
    group.targetHandle = targetHandle;
  }

  if (type === 'point') {
    const falloffHandle = new THREE.Mesh(new THREE.TorusGeometry(1, 0.04, 6, 32), handleMaterial);
    falloffHandle.name = 'light_handle_falloff';
    falloffHandle.rotation.x = Math.PI / 2;
    falloffHandle.userData.isLight = true;
    falloffHandle.userData.lightHandle = 'point-distance';
    group.add(falloffHandle);
    group.falloffHandle = falloffHandle;
  }

  return group;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmpDir = new THREE.Vector3();

/**
 * Rebuilds orientation/scale from the spec. `active` swaps the compact handle for
 * the full Blender-style widget; only the focused light shows the detailed one.
 */
export function updateLightGlyph(
  glyph: LightGlyph,
  spec: LightSpec,
  cameraDistance: number,
  active: boolean,
  direction?: THREE.Vector3
): void {
  const scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, cameraDistance * SCALE_PER_DISTANCE));
  glyph.body.scale.setScalar(scale);
  glyph.compact.scale.setScalar(scale);
  glyph.compact.visible = !active;
  glyph.detail.visible = active;

  if (direction) {
    tmpDir.copy(direction);
  } else {
    tmpDir.set(
      spec.target[0] - spec.position[0],
      spec.target[1] - spec.position[1],
      spec.target[2] - spec.position[2]
    );
  }
  const len = tmpDir.length();
  if (len > MIN_AXIS) {
    glyph.pivot.quaternion.setFromUnitVectors(Z_AXIS, tmpDir.divideScalar(len));
  } else {
    glyph.pivot.quaternion.identity();
  }

  if (glyph.falloff) {
    const show = active && spec.distance > 0;
    glyph.falloff.visible = show;
    if (show) glyph.falloff.scale.setScalar(spec.distance);
  }

  if (!active) return;

  if (glyph.cone) {
    const angle = Math.min(Math.max(spec.angle, 0.02), 1.45);
    const radius = len > MIN_AXIS ? Math.min(Math.tan(angle) * len, len * 6) : 1;
    glyph.cone.scale.set(radius, radius, Math.max(len, MIN_AXIS));
  }

  if (glyph.axis) glyph.axis.scale.z = Math.max(len, MIN_AXIS);

  if (glyph.head) {
    glyph.head.position.z = len;
    glyph.head.scale.setScalar(scale);
  }

  if (glyph.cross) {
    glyph.cross.position.z = len;
    glyph.cross.scale.setScalar(scale);
  }

  if (glyph.coneHandle) {
    const proxyRadius = Math.max(glyph.cone ? glyph.cone.scale.x : 0.5, scale * 0.2);
    glyph.coneHandle.position.set(0, 0, Math.max(len, MIN_AXIS));
    glyph.coneHandle.scale.setScalar(proxyRadius);
    glyph.coneHandle.visible = true;
  }

  if (glyph.targetHandle) {
    const showTarget = len > 0.45;
    glyph.targetHandle.visible = showTarget;
    if (showTarget) {
      glyph.targetHandle.position.z = len;
      glyph.targetHandle.scale.setScalar(Math.max(scale * 0.22, 0.08));
    }
  }

  if (glyph.falloffHandle) {
    // Only grabbable while the falloff ring is actually drawn.
    const showRing = spec.distance > 0;
    glyph.falloffHandle.visible = showRing;
    if (showRing) glyph.falloffHandle.scale.setScalar(Math.max(spec.distance, 0.25));
  }
}

/** Recolors every line in a glyph without rebuilding its geometry. */
export function setGlyphColor(glyph: THREE.Object3D, color: string): void {
  glyph.traverse((child) => {
    const line = child as THREE.Line;
    if (line.isLine && line.material instanceof THREE.LineBasicMaterial) {
      line.material.color.set(color);
    }
  });
}

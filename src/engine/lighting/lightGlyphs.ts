import * as THREE from 'three';
import { LightType } from '../../types';

const DISC_SEGMENTS = 12;
const RAY_COUNT = 8;
const RING_SEGMENTS = 16;

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

function lineFrom(
  points: THREE.Vector3[],
  material: THREE.LineBasicMaterial,
  loop = false
): THREE.Line | THREE.LineLoop {
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return loop ? new THREE.LineLoop(geo, material) : new THREE.Line(geo, material);
}

export function createLightGlyph(type: LightType, color = 0xfff3e0): THREE.Group {
  const group = new THREE.Group();
  group.name = `light_glyph_${type}`;

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  if (type === 'directional') {
    // Sun: small disc + 8 rays radiating outward
    group.add(lineFrom(circlePoints(0.085, DISC_SEGMENTS, 'xy'), material, true));
    for (let i = 0; i < RAY_COUNT; i++) {
      const a = (i / RAY_COUNT) * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      group.add(
        lineFrom(
          [new THREE.Vector3(dx * 0.13, dy * 0.13, 0), new THREE.Vector3(dx * 0.26, dy * 0.26, 0)],
          material
        )
      );
    }
  } else {
    // Point: three orthogonal great circles read as a bulb from any angle
    group.add(lineFrom(circlePoints(0.13, RING_SEGMENTS, 'xy'), material, true));
    group.add(lineFrom(circlePoints(0.13, RING_SEGMENTS, 'xz'), material, true));
    group.add(lineFrom(circlePoints(0.13, RING_SEGMENTS, 'yz'), material, true));
  }

  const hitGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.name = 'light_hit_target';
  hitMesh.userData.isLight = true;
  group.add(hitMesh);

  group.renderOrder = 998;
  return group;
}

import * as THREE from 'three';
import { LightType } from '../../types';

export function createLightGlyph(type: LightType, color = 0xfff3e0): THREE.Group {
  const group = new THREE.Group();
  group.name = `light_glyph_${type}`;

  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    depthTest: false,
  });

  if (type === 'directional') {
    // Sun ring + directional arrow rays
    const circlePoints: THREE.Vector3[] = [];
    const segments = 16;
    const r = 0.12;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      circlePoints.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, 0));
    }
    const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
    const circle = new THREE.LineLoop(circleGeo, material);
    group.add(circle);

    // Directional ray forward (-Z)
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -0.4),
    ]);
    const ray = new THREE.Line(rayGeo, material);
    group.add(ray);
  } else {
    // Omnidirectional point bulb wireframe
    const sphereGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const wireframe = new THREE.WireframeGeometry(sphereGeo);
    const line = new THREE.LineSegments(wireframe, material);
    group.add(line);
  }

  // Raycastable hit mesh (invisible sphere)
  const hitGeo = new THREE.SphereGeometry(0.22, 8, 6);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.name = 'light_hit_target';
  hitMesh.userData.isLight = true;
  group.add(hitMesh);

  group.renderOrder = 998;
  return group;
}

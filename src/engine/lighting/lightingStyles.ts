import * as THREE from 'three';
import { LightingStyle } from '../../types';

export function applyLightingStyle(renderer: THREE.WebGLRenderer, style: LightingStyle) {
  if (style === 'minecrafty') {
    renderer.shadowMap.type = THREE.BasicShadowMap;
  } else {
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  renderer.shadowMap.needsUpdate = true;
}

import * as THREE from 'three';
import { BodyPartName, ShaderPassMode } from '../../types';
import { MinecraftRig } from '../rig/rig';

// Unique high-contrast colors per limb for Photoshop 1-click magic wand
export const CLOWN_PASS_COLORS: Record<BodyPartName, number> = {
  root: 0x333333,
  pelvis: 0x00ff66,
  torso: 0x00ff66,
  head: 0xff0055,
  rightArm: 0x0088ff,
  leftArm: 0xffcc00,
  rightLeg: 0x9900ff,
  leftLeg: 0x00ffff,
};

// Camera-Space Normal Shader with Alpha-Test for 2nd skin layer
const NormalShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(map, vUv);
      if (tex.a < 0.5) discard;
      vec3 n = normalize(vNormal);
      // Camera-space normal mapped to [0, 1] RGB
      gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
    }
  `,
};

// WEM (White Entities Mask) Shader with Alpha-Test
const WEMShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(map, vUv);
      if (tex.a < 0.5) discard;
      gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
    }
  `,
};

// Clown/Material ID Shader with Alpha-Test
const ClownShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D map;
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      vec4 tex = texture2D(map, vUv);
      if (tex.a < 0.5) discard;
      gl_FragColor = vec4(uColor, 1.0);
    }
  `,
};

export class ShaderPassManager {
  private rig: MinecraftRig;
  private currentMode: ShaderPassMode = 'beauty';
  private texture: THREE.CanvasTexture;

  // Cached materials
  private wemMaterial: THREE.ShaderMaterial;
  private normalMaterial: THREE.ShaderMaterial;
  private clownMaterials: Map<BodyPartName, THREE.ShaderMaterial> = new Map();

  constructor(rig: MinecraftRig, texture: THREE.CanvasTexture) {
    this.rig = rig;
    this.texture = texture;

    this.wemMaterial = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.texture } },
      vertexShader: WEMShader.vertexShader,
      fragmentShader: WEMShader.fragmentShader,
      side: THREE.DoubleSide,
    });

    this.normalMaterial = new THREE.ShaderMaterial({
      uniforms: { map: { value: this.texture } },
      vertexShader: NormalShader.vertexShader,
      fragmentShader: NormalShader.fragmentShader,
      side: THREE.DoubleSide,
    });

    // Initialize clown materials
    (Object.keys(CLOWN_PASS_COLORS) as BodyPartName[]).forEach((part) => {
      const col = new THREE.Color(CLOWN_PASS_COLORS[part]);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          map: { value: this.texture },
          uColor: { value: new THREE.Vector3(col.r, col.g, col.b) },
        },
        vertexShader: ClownShader.vertexShader,
        fragmentShader: ClownShader.fragmentShader,
        side: THREE.DoubleSide,
      });
      this.clownMaterials.set(part, mat);
    });
  }

  public updateTexture(texture: THREE.CanvasTexture) {
    this.texture = texture;
    this.wemMaterial.uniforms.map.value = texture;
    this.normalMaterial.uniforms.map.value = texture;
    this.clownMaterials.forEach((mat) => {
      mat.uniforms.map.value = texture;
    });
  }

  public setPass(mode: ShaderPassMode) {
    this.currentMode = mode;

    Object.values(this.rig.joints).forEach((joint) => {
      if (!joint.innerMesh || !joint.outerMesh) return;

      if (mode === 'beauty') {
        joint.innerMesh.material = this.rig.materials.base;
        joint.outerMesh.material = this.rig.materials.outer;
      } else if (mode === 'wem') {
        joint.innerMesh.material = this.wemMaterial;
        joint.outerMesh.material = this.wemMaterial;
      } else if (mode === 'normal') {
        joint.innerMesh.material = this.normalMaterial;
        joint.outerMesh.material = this.normalMaterial;
      } else if (mode === 'clown') {
        const mat = this.clownMaterials.get(joint.partName) || this.wemMaterial;
        joint.innerMesh.material = mat;
        joint.outerMesh.material = mat;
      }
    });
  }

  public get pass(): ShaderPassMode {
    return this.currentMode;
  }
}

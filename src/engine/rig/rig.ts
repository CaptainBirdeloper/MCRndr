import * as THREE from 'three';
import { BodyPartName, ArmType } from '../../types';
import { setMinecraftBoxUV, SkinBoxUV } from './skin';

export interface RigJoint {
  group: THREE.Group;
  innerMesh: THREE.Mesh;
  outerMesh: THREE.Mesh;
  partName: BodyPartName;
}

export interface MinecraftRig {
  root: THREE.Group;
  joints: Record<BodyPartName, RigJoint>;
  materials: {
    base: THREE.MeshStandardMaterial;
    outer: THREE.MeshStandardMaterial;
  };
  setSkinTexture: (texture: THREE.CanvasTexture) => void;
  setArmType: (type: ArmType) => void;
  armType: ArmType;
  resetPose: () => void;
}

export function createMinecraftRig(initialTexture: THREE.CanvasTexture, initialArmType: ArmType = 'steve'): MinecraftRig {
  const baseMat = new THREE.MeshStandardMaterial({
    map: initialTexture,
    roughness: 0.85,
    metalness: 0.05,
  });

  const outerMat = new THREE.MeshStandardMaterial({
    map: initialTexture,
    roughness: 0.85,
    metalness: 0.05,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.FrontSide,
  });

  const root = new THREE.Group();
  root.position.set(0, 0, 0);

  // Helper to construct a dual-layer box part
  function buildLimb(
    partName: BodyPartName,
    w: number,
    h: number,
    d: number,
    baseUV: SkinBoxUV,
    outerUV: SkinBoxUV,
    meshOffsetY: number,
    meshOffsetX = 0
  ): RigJoint {
    const pivot = new THREE.Group();
    pivot.name = `pivot_${partName}`;
    pivot.userData = { partName, isPivot: true };

    // Base inner mesh
    const innerGeo = new THREE.BoxGeometry(w, h, d);
    setMinecraftBoxUV(innerGeo, baseUV);
    const innerMesh = new THREE.Mesh(innerGeo, baseMat);
    innerMesh.position.set(meshOffsetX, meshOffsetY, 0);
    innerMesh.castShadow = true;
    innerMesh.receiveShadow = true;
    innerMesh.name = `inner_${partName}`;
    innerMesh.userData = { partName, isBodyPart: true };
    pivot.add(innerMesh);

    // Outer second layer mesh (inflated by 1.08x or +0.035 units)
    const inflate = 0.035;
    const outerGeo = new THREE.BoxGeometry(w + inflate, h + inflate, d + inflate);
    setMinecraftBoxUV(outerGeo, outerUV);
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.set(meshOffsetX, meshOffsetY, 0);
    outerMesh.castShadow = true;
    outerMesh.receiveShadow = true;
    outerMesh.name = `outer_${partName}`;
    outerMesh.userData = { partName, isBodyPart: true };
    pivot.add(outerMesh);

    return { group: pivot, innerMesh, outerMesh, partName };
  }

  // --- UV Mappings (Standard Minecraft 64x64) ---
  const uv = {
    headBase: { x: 0, y: 0, w: 8, h: 8, d: 8 },
    headOuter: { x: 32, y: 0, w: 8, h: 8, d: 8 },
    torsoBase: { x: 16, y: 16, w: 8, h: 12, d: 4 },
    torsoOuter: { x: 16, y: 32, w: 8, h: 12, d: 4 },
    rightArmBase: { x: 40, y: 16, w: 4, h: 12, d: 4 },
    rightArmOuter: { x: 40, y: 32, w: 4, h: 12, d: 4 },
    leftArmBase: { x: 32, y: 48, w: 4, h: 12, d: 4 },
    leftArmOuter: { x: 48, y: 48, w: 4, h: 12, d: 4 },
    rightLegBase: { x: 0, y: 16, w: 4, h: 12, d: 4 },
    rightLegOuter: { x: 0, y: 32, w: 4, h: 12, d: 4 },
    leftLegBase: { x: 16, y: 48, w: 4, h: 12, d: 4 },
    leftLegOuter: { x: 0, y: 48, w: 4, h: 12, d: 4 },
  };

  // Dimensions in units (16 units = 1 meter / block)
  const armW = initialArmType === 'alex' ? 3 / 16 : 4 / 16;
  const armOffset = initialArmType === 'alex' ? 0.015 : 0;

  // 1. Pelvis / Hips (Anchor for torso & legs at y = 0.75)
  const pelvis = new THREE.Group();
  pelvis.name = 'pivot_pelvis';
  pelvis.position.set(0, 0.75, 0);
  pelvis.userData = { partName: 'pelvis', isPivot: true };
  root.add(pelvis);

  // 2. Torso (Pivot at base of torso on pelvis)
  const torsoLimb = buildLimb('torso', 8 / 16, 12 / 16, 4 / 16, uv.torsoBase, uv.torsoOuter, 6 / 16);
  torsoLimb.group.position.set(0, 0, 0);
  pelvis.add(torsoLimb.group);

  // 3. Head (Pivot at neck = top of torso, y = 12/16 = 0.75 above pelvis)
  const headLimb = buildLimb('head', 8 / 16, 8 / 16, 8 / 16, uv.headBase, uv.headOuter, 4 / 16);
  headLimb.group.position.set(0, 12 / 16, 0);
  torsoLimb.group.add(headLimb.group);

  // 4. Arms (Pivots at shoulders = top of torso, y = 10/16 above pelvis)
  const rightArmLimb = buildLimb(
    'rightArm',
    armW,
    12 / 16,
    4 / 16,
    uv.rightArmBase,
    uv.rightArmOuter,
    -4 / 16,
    initialArmType === 'alex' ? 0.015 : 0
  );
  rightArmLimb.group.position.set(-(4 / 16 + armW / 2) + armOffset, 10 / 16, 0);
  torsoLimb.group.add(rightArmLimb.group);

  const leftArmLimb = buildLimb(
    'leftArm',
    armW,
    12 / 16,
    4 / 16,
    uv.leftArmBase,
    uv.leftArmOuter,
    -4 / 16,
    initialArmType === 'alex' ? -0.015 : 0
  );
  leftArmLimb.group.position.set(4 / 16 + armW / 2 - armOffset, 10 / 16, 0);
  torsoLimb.group.add(leftArmLimb.group);

  // 5. Legs (Pivots at hips on pelvis, hanging down)
  const rightLegLimb = buildLimb('rightLeg', 4 / 16, 12 / 16, 4 / 16, uv.rightLegBase, uv.rightLegOuter, -6 / 16);
  rightLegLimb.group.position.set(-2 / 16, 0, 0);
  pelvis.add(rightLegLimb.group);

  const leftLegLimb = buildLimb('leftLeg', 4 / 16, 12 / 16, 4 / 16, uv.leftLegBase, uv.leftLegOuter, -6 / 16);
  leftLegLimb.group.position.set(2 / 16, 0, 0);
  pelvis.add(leftLegLimb.group);

  // Joints dictionary
  const dummyJoint = (name: BodyPartName, grp: THREE.Group): RigJoint => ({
    group: grp,
    innerMesh: grp.children[0] as THREE.Mesh,
    outerMesh: grp.children[1] as THREE.Mesh,
    partName: name,
  });

  const joints: Record<BodyPartName, RigJoint> = {
    root: dummyJoint('root', root),
    pelvis: dummyJoint('pelvis', pelvis),
    torso: torsoLimb,
    head: headLimb,
    rightArm: rightArmLimb,
    leftArm: leftArmLimb,
    rightLeg: rightLegLimb,
    leftLeg: leftLegLimb,
  };

  function setSkinTexture(texture: THREE.CanvasTexture) {
    baseMat.map = texture;
    baseMat.needsUpdate = true;
    outerMat.map = texture;
    outerMat.needsUpdate = true;
  }

  let currentArmType: ArmType = initialArmType;

  function setArmType(type: ArmType) {
    currentArmType = type;
    const newArmW = type === 'alex' ? 3 / 16 : 4 / 16;
    const offset = type === 'alex' ? 0.015 : 0;

    // Update Right Arm
    rightArmLimb.innerMesh.geometry.dispose();
    rightArmLimb.innerMesh.geometry = new THREE.BoxGeometry(newArmW, 12 / 16, 4 / 16);
    setMinecraftBoxUV(rightArmLimb.innerMesh.geometry as THREE.BoxGeometry, uv.rightArmBase);

    rightArmLimb.outerMesh.geometry.dispose();
    rightArmLimb.outerMesh.geometry = new THREE.BoxGeometry(newArmW + 0.035, 12 / 16 + 0.035, 4 / 16 + 0.035);
    setMinecraftBoxUV(rightArmLimb.outerMesh.geometry as THREE.BoxGeometry, uv.rightArmOuter);

    rightArmLimb.group.position.set(-(4 / 16 + newArmW / 2) + offset, 10 / 16, 0);

    // Update Left Arm
    leftArmLimb.innerMesh.geometry.dispose();
    leftArmLimb.innerMesh.geometry = new THREE.BoxGeometry(newArmW, 12 / 16, 4 / 16);
    setMinecraftBoxUV(leftArmLimb.innerMesh.geometry as THREE.BoxGeometry, uv.leftArmBase);

    leftArmLimb.outerMesh.geometry.dispose();
    leftArmLimb.outerMesh.geometry = new THREE.BoxGeometry(newArmW + 0.035, 12 / 16 + 0.035, 4 / 16 + 0.035);
    setMinecraftBoxUV(leftArmLimb.outerMesh.geometry as THREE.BoxGeometry, uv.leftArmOuter);

    leftArmLimb.group.position.set(4 / 16 + newArmW / 2 - offset, 10 / 16, 0);
  }

  function resetPose() {
    Object.values(joints).forEach((j) => {
      j.group.rotation.set(0, 0, 0);
    });
    pelvis.position.set(0, 0.75, 0);
    root.position.set(0, 0, 0);
  }

  return {
    root,
    joints,
    materials: { base: baseMat, outer: outerMat },
    setSkinTexture,
    setArmType,
    get armType() {
      return currentArmType;
    },
    resetPose,
  };
}

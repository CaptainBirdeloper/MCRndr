import * as THREE from 'three';

export interface SkinBoxUV {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
}

export function createSteveDefaultCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#00000000';
  ctx.clearRect(0, 0, 64, 64);

  // Helper rect filler
  const fill = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // Head Hair & Skin base
  fill(0, 0, 32, 16, '#27180e'); // Hair top/sides
  fill(8, 8, 8, 8, '#b88365'); // Face base
  fill(8, 6, 8, 2, '#27180e'); // Hair bangs
  fill(9, 10, 2, 1, '#ffffff'); // Left eye white
  fill(10, 10, 1, 1, '#2c377f'); // Left pupil
  fill(13, 10, 2, 1, '#ffffff'); // Right eye white
  fill(13, 10, 1, 1, '#2c377f'); // Right pupil
  fill(10, 11, 4, 1, '#8e583c'); // Nose
  fill(10, 13, 4, 1, '#4a2618'); // Mouth/Beard

  // Torso (Cyan shirt)
  fill(16, 16, 24, 16, '#009ea0');
  fill(20, 16, 4, 2, '#b88365'); // Neck skin

  // Right Arm (Shirt sleeve + skin)
  fill(40, 16, 16, 4, '#009ea0');
  fill(40, 20, 16, 12, '#b88365');

  // Left Arm (for 64x64)
  fill(32, 48, 16, 4, '#009ea0');
  fill(32, 52, 16, 12, '#b88365');

  // Right Leg (Blue jeans + gray shoes)
  fill(0, 16, 16, 12, '#2a347d');
  fill(0, 28, 16, 4, '#565656');

  // Left Leg
  fill(16, 48, 16, 12, '#2a347d');
  fill(16, 60, 16, 4, '#565656');

  return canvas;
}

export function detectSkinModel(source: HTMLImageElement | HTMLCanvasElement): import('../../types').ArmType {
  if (source.height === 32) return 'steve';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);

  // Check the transparent strip in 3px Alex skins
  const p1 = ctx.getImageData(55, 20, 1, 1).data[3];
  const p2 = ctx.getImageData(55, 24, 1, 1).data[3];
  const p3 = ctx.getImageData(55, 28, 1, 1).data[3];
  if (p1 === 0 && p2 === 0 && p3 === 0) {
    return 'alex';
  }
  return 'steve';
}

export function createSkinTexture(source: HTMLCanvasElement | HTMLImageElement): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  if (source.height === 32) {
    // Legacy 64x32: draw top half
    ctx.drawImage(source, 0, 0);
    // Mirror right arm to left arm
    ctx.drawImage(canvas, 40, 16, 16, 16, 32, 48, 16, 16);
    // Mirror right leg to left leg
    ctx.drawImage(canvas, 0, 16, 16, 16, 16, 48, 16, 16);
  } else {
    ctx.drawImage(source, 0, 0);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

/**
 * Maps Minecraft Skin 2D box coordinates to Three.js BoxGeometry UV attributes.
 * Minecraft layout per box:
 * Row 1 (y to y+d): Top: [x+d, y, w, d], Bottom: [x+d+w, y, w, d]
 * Row 2 (y+d to y+d+h): Right: [x, y+d, d, h], Front: [x+d, y+d, w, h], Left: [x+d+w, y+d, d, h], Back: [x+2*d+w, y+d, w, h]
 */
export function setMinecraftBoxUV(
  geo: THREE.BoxGeometry,
  uvBox: SkinBoxUV,
  texWidth = 64,
  texHeight = 64
) {
  const { x, y, w, h, d } = uvBox;
  const uvAttr = geo.attributes.uv;

  // Convert pixel coords to Three.js UV [0..1]
  const toU = (px: number) => px / texWidth;
  const toV = (py: number) => 1.0 - py / texHeight;

  // Quad UV builder: 4 vertices per face (v0: tl, v1: tr, v2: bl, v3: br in box face coords)
  function setFaceUV(faceIdx: number, px: number, py: number, pw: number, ph: number, flipX = false) {
    const u0 = toU(flipX ? px + pw : px);
    const u1 = toU(flipX ? px : px + pw);
    const v0 = toV(py);
    const v1 = toV(py + ph);

    // BoxGeometry vertex order per face:
    // (u0, v0), (u1, v0), (u0, v1), (u1, v1)
    uvAttr.setXY(faceIdx * 4 + 0, u0, v0);
    uvAttr.setXY(faceIdx * 4 + 1, u1, v0);
    uvAttr.setXY(faceIdx * 4 + 2, u0, v1);
    uvAttr.setXY(faceIdx * 4 + 3, u1, v1);
  }

  // Three.js BoxGeometry face order:
  // 0: +X (Right)
  // 1: -X (Left)
  // 2: +Y (Top)
  // 3: -Y (Bottom)
  // 4: +Z (Front)
  // 5: -Z (Back)

  setFaceUV(0, x, y + d, d, h); // Right
  setFaceUV(1, x + d + w, y + d, d, h); // Left
  setFaceUV(2, x + d, y, w, d); // Top
  setFaceUV(3, x + d + w, y, w, d); // Bottom
  setFaceUV(4, x + d, y + d, w, h); // Front
  setFaceUV(5, x + d * 2 + w, y + d, w, h); // Back

  uvAttr.needsUpdate = true;
}

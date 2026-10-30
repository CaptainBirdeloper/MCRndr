# MCRndr

> NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

A high-performance, browser-based 3D Minecraft skin posing, staging, and compositing render engine built with React 19, Three.js, and Tailwind CSS v4.

---

## Overview

![MCRndr Posing Viewport](.github/assets/hero-viewport.png)
<p align="center"><sub>Figure 1: Character staging workspace with real-time limb transform gizmo, numerical pose controls, and world-space camera frustums.</sub></p>

---

## Interface & Camera Staging

| Clean Viewport (Collapsed UI) | Active Camera Lens (Framing Crosshairs) |
| :---: | :---: |
| ![Clean Viewport](.github/assets/clean-viewport.png) | ![Camera View](.github/assets/camera-view.png) |
| <sub>Figure 2: Distraction-free 3D stage featuring ground reference grid and light wireframe glyphs.</sub> | <sub>Figure 3: Dedicated camera perspective rendering through user-configured lens with alignment crosshairs.</sub> |

---

## Compositing Render Passes

MCRndr exports offscreen multi-pass layers at 1080p, 2K, and 4K resolutions with transparent background support for post-production compositing in external editing suites:

| Beauty Pass | Clown ID Pass |
| :---: | :---: |
| ![Beauty Pass](.github/assets/pass-beauty.png) | ![Clown ID Pass](.github/assets/pass-clown-id.png) |
| <sub>Figure 4: Standard beauty pass with directional lighting, skin diffuse maps, and soft contact shadows.</sub> | <sub>Figure 5: Discrete RGB clown masks isolating each anatomical limb for selection clipping.</sub> |
| Normal Pass | White Entities Mask (WEM) |
| ![Normal Pass](.github/assets/pass-normal.png) | ![WEM Pass](.github/assets/pass-wem-mask.png) |
| <sub>Figure 6: Camera-space surface normals mapped to RGB color channels for relighting workflows.</sub> | <sub>Figure 7: High-contrast silhouette matte with jacket and outer sleeve alpha transparency.</sub> |

---

## Features

- Dual-Rig Architecture: Full Steve (4px) and Alex (3px) articulated rigs with anatomical pivot points and dual-layer outer mesh rendering.
- Automatic Skin Model Detection: Inspects uploaded skin textures at runtime to automatically detect and assign Steve or Alex arm geometry.
- Blender-Style Modal Transforms: Grab (G) and Rotate (R) hotkeys with axis constraints (X, Y, Z) and visual projection lines.
- Multi-Camera Staging: Position, track, and switch between multiple perspective cameras with FOV controls and viewport frustum gizmos.
- 3D Lighting Engine: Raycastable Sun and Point light glyphs with customizable intensity, color, and shadow modes (Realistic vs Minecrafty).
- Compositing Render Passes: High-resolution offscreen multi-pass exports at 1080p, 2K, and 4K:
  - Beauty Pass: Full standard shading with diffuse textures and shadows.
  - WEM Pass: White Entities Mask for post-production silhouette clipping.
  - Normal Pass: World/camera-space normals mapped to RGB color channels.
  - Clown ID Pass: Discrete flat RGB limb isolation masks for effortless selection.
- Posing System: Pre-built pose presets and an interactive 60-state undo/redo history engine.

---

## Tech Stack

- Framework: React 19 + TypeScript
- Bundler & Tooling: Vite 6
- 3D Engine: Three.js (r174)
- Styling: Tailwind CSS v4
- Icons: Lucide React

---

## Getting Started

### Prerequisites

Node.js (v18 or higher recommended) and npm.

### Installation

```bash
git clone https://github.com/CaptainBirdeloper/MCRndr.git
cd MCRndr
npm install
```

### Development

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

---

## Disclaimer

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
Minecraft is a trademark of Mojang Synergies AB.

---

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

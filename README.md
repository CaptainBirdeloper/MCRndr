# MCRndr

> NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

A high-performance, browser-based 3D Minecraft skin posing, staging, and compositing render engine built with React 19, Three.js, and Tailwind CSS v4.

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

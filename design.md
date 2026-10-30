# Design Specification: Lunacy UI Architecture (`design.md`)

Calibrated 1:1 to the official Lunacy design artboard (960×540 fixed canvas) and the 5-color studio palette.

---

## 0. Core Philosophy: Intent-Driven Fixed Canvas (Desktop Tool Paradigm)

> **"The least cluttered UI possible. Understanding the intent of the user and locating elements respectively with deterministic, zero-drift fixed geometry."**

### Core Tenets:
1. **Desktop Tool Model (No Responsive Breakpoint Drift)**:
   - UI chrome behaves like professional DCC desktop software (Blockbench, Blender, Figma).
   - Strict ban on responsive utility prefixes (`sm:`, `md:`, `lg:`) or fluid percentage widths on tool panels.
   - Fixed, deterministic pixel coordinates preserve exact artboard alignment across all viewport sizes.
2. **Apple-Grade Tactile Micro-Interactions**:
   - Responsive spring timing (`cubic-bezier(0.16, 1, 0.3, 1)`), 200–350ms transitions.
   - Button press tactile depression (`active:scale-[0.95]`).
   - Drawer toggle handle with smooth cubic ease.
3. **Global HUD Toggle**:
   - Single keypress (`H`) cleanly fades all overlays for uninhibited 3D composition.

---

## 1. Official Studio Color Palette & Depth Hierarchy

| Priority Tier | Token Name | Hex Code | Visual Role & Component Mapping |
| :--- | :--- | :--- | :--- |
| **Surface (60%)** | **Black Night** | `#07050F` | 3D canvas backdrop, inner input fills, unselected skin pill. |
| **Drawer Surface** | **Deep Maroon** | `#360403` | Left sidebar background panel (195px), 3-column input box background. |
| **Structure (30%)** | **Molten Lava** | `#730907` | Top mode strip (195×23), card header banner (183×19), Export button base. |
| **Active Accent (10%)** | **Inferno** | `#AE0D0A` | Active navigation tabs, collapse handle (11×20), active button hover states. |
| **Depth & Bevel** | **Deep Purple** | `#521451` | Tactile inner bevel shadow (`shadow-[inset_0_4px_4px_#521451]`). |
| **Typography** | **White Smoke** | `#F5F5F5` | Primary foreground text, input numbers, active labels. |

---

## 2. Typography Architecture

* **Primary Typeface**: `Rethink Sans` (Bold 700 / SemiBold 600 / Medium 500)
* **Secondary / Display**: `Plus Jakarta Sans`
* **Strict Monospace Ban**: NEVER use `font-mono`, `monospace`, Courier, or Consolas anywhere in the UI. All numbers, transform values, badges, and dimensional labels (`4px`, `3px`) must render in `Rethink Sans`.
* **Hierarchy**:
  * Mode Tabs (`BODY`, `POSE`): `9px` `RethinkSans-Bold` uppercase tracking-wider
  * Card Header: `11px` `RethinkSans-Bold` uppercase tracking-wider (`#AD0D0A`)
  * Section Titles (`TRANSLATE`, `ROTATE`): `9px` `RethinkSans-Bold` tracking-wider (`#F5F5F5/60`)
  * Axis Input Values: `18px` `RethinkSans-Bold` (`#F5F5F5`)
  * Bottom Toolbar Labels: `10px` bold (Import) / `11px` semibold (Export)

---

## 3. Geometry & Layout Mapping (Responsive Dock Architecture)

### A. Collapsible Left Drawer (`LeftSidebar.tsx`)
* **Dimensions**: Width `214px`, height `100%` (`top-0 bottom-0 left-0`)
* **Fill**: `#360403` (Deep Maroon), `border-0`, `shadow-none`, `overflow-hidden`
* **Collapse Handle**:
  * Position: `left: 214px` (or `0px` when collapsed), `top: 50%` (`-translate-y-1/2`)
  * Dimensions: `11px × 20px`, corner radius `rounded-r-md`
  * Fill: `#AE0D0A` (Inferno)
* **Top Mode Header Strip (Sliding Segmented Control)**:
  * Dimensions: `w-full h-[26px]`, `p-[3px]`, fill `#730907` (Molten Lava)
  * Sliding Pill Indicator: `w-[calc((100%-6px)/3)] h-full bg-[#AE0D0A] rounded-full transition-transform duration-300 ease-spring`
  * Tabs: `BODY` (hotkey `1`, `translateX(0%)`), `POSE` (hotkey `2`, `translateX(100%)`), `WORLD` (hotkey `3`, `translateX(200%)`)
  * Text Labels: `relative z-10 flex-1 h-full text-[9px] RethinkSans-Bold uppercase tracking-wider`

### B. Transform & Camera Cards (`TransformCard.tsx` & `CameraCard.tsx`)
* **Dimensions**: Responsive width `mx-auto mt-3.5 w-[calc(100%-16px)]` (8px symmetrical margins), minimum height `267px`
* **Fill**: `rgba(115, 9, 7, 0.40)` (`#730907/40`), corner radius `rounded-[9px]`, `border-0 shadow-none`
* **Header Banner**: `w-full h-[19px]`, `#730907`, text: `TRANSFORM`, active limb name, or `CAMERA` (`11px RethinkSans-Bold` `#AD0D0A` uppercase tracking-wider)
* **3-Column Unified Input Box**:
  * Dimensions: `w-full h-[42px]`, fill `#360403`, corner radius `rounded-[15px]`
  * Columns: `X`, `Y`, `Z` (`flex-1 h-full`) separated by `1px` subtle divider lines
  * Spin buttons stripped (`[appearance:textfield]`, webkit spinners hidden)
  * Strict Ban: Never hardcode `w-[167px]` or `w-[183px]`; interior elements must always fill `w-full`.
* **Empty State**: When in `POSE` mode with no limb selected, displays muted icon + prompt: *"Select a limb on the character to pose"*.

### C. Pose Presets Grid (`PosePresets.tsx`)
* **Layout**: 2-column responsive grid (`grid grid-cols-2 gap-1.5 w-full`) mounted below rotation inputs in `POSE` mode
* **Preset Buttons**: `h-[22px]`, corner radius `rounded-[15px]`, fill `#07050F`, active `#AE0D0A`
* **AutoFitText**: Dynamically measures preset label string to prevent truncation

### D. Bottom Action Toolbar
* **Container**: Width `100%` (`214px`), padding `px-2.5 py-3`, `flex items-center gap-2 overflow-hidden box-border`
* **Skin Uploader Pill**:
  * Dimensions: `flex-1 min-w-0`, height `24px`, corner radius `rounded-full`
  * Fill: `#07050F`, text `#FFFFFF` `text-[10px]` bold, icon `12px` (`w-3 h-3`), padding `px-2.5`
  * Loaded State: Truncates skin filename cleanly with red image badge icon
* **Export Button**:
  * Dimensions: Width `68px` (`shrink-0`), height `24px`, corner radius `rounded-[12px]`
  * Fill: `#730907` (hover `#AE0D0A`), text `#F5F5F5` `text-[11px]` semibold
* **Curvature Bounding Guarantee**:
  $$\text{Padding}_{\text{horizontal}} \ge \frac{H}{2} \implies \text{Padding} \ge 12\text{px}$$
  Guarantees that upload icons and text labels never collide with or clip against the curved endcaps across all display scaling ratios (100%–200% DPI).

---

## 4. Camera System & Export Modal

* **Constant-Scale DCC Camera Model**:
  - Replaces Three.js CameraHelper. Zero splaying frustum rays.
  - Constant footprint: compact 0.14m wireframe body box, front lens cone pointing `-Z`, top orientation notch pointing `+Y`. Never obscures scene or expands on high FOV.
* **Camera FOV Isolation**:
  - High/custom FOV (10°–120°) is isolated to camera view (`activeCameraId !== null`) and offscreen export snapshots.
  - OrbitControls start event immediately restores free viewport perspective to default workspace `38°` FOV.
* **Camera Dropdown**: Fixed at `top-3 right-6 z-40`, compact pill showing active camera index or `FREE VIEW`, quick cycle (`C`), and save camera (`Shift+C`).
* **Export Modal**: Fixed center dialog with resolution pills (`1080p`, `2K`, `4K`), pass selector (`Beauty`, `WEM`, `Normal`, `Clown`), alpha transparency toggle, and multi-camera batch export.

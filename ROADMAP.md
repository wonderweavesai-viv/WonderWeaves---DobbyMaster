
# WonderWeaves: Strategic Evaluation & Roadmap 2025

> **Status**: Active Development (v2.1)
> **Goal**: To bridge the gap between digital textile design, artisanal craft, and industrial production.

---

## 1. Application Evaluation (Length to Breadth)

### 1.1 UI/UX & Usability Analysis
*   **Desktop Experience**: The current "Cockpit" layout (Left Inputs, Center Grid, Right Tools) is standard for CAD but can become overwhelming.
    *   *Critique*: Information density is high. New users might find the sheer number of sliders and buttons intimidating.
    *   *Solution*: Implement "Workspaces" (e.g., *Drafting Workspace*, *Color Workspace*, *Production Workspace*) to hide irrelevant tools.
*   **Mobile & Tablet Experience**:
    *   *Current State*: Functional but cramped. Complex grids (e.g., 120 ends) are hard to edit on touchscreens.
    *   *Challenge*: Precision tapping on a 10x10px cell is difficult.
    *   *Strategy*:
        *   **Tablet**: Introduce a "Loom Side Companion" mode. Large buttons for "Next Pick", current treadling display, and annotations. No editing, just viewing/tracking.
        *   **Mobile**: "Sketch Mode". Simplified pattern algebra (striped generation) and color selection. View-only for drafts.
*   **Accessibility**:
    *   High-contrast modes for structure view are implemented.
    *   Need to ensure WCAG compliance for color-blind users (pattern symbols overlay on colored cells).

### 1.2 User Persona Coverage

| Persona | Needs | Current Status | Missing Features |
| :--- | :--- | :--- | :--- |
| **Fashion Designer** | Visualizing drape, Colorways, Trend matching, Moodboards. | Good visual simulation. | **Colorway Manager** (Compare 3 versions side-by-side), **Drape Simulation** (on a model), **Pantone Connect**. |
| **Hobby Weaver** | WIF import/export, Library of standard weaves, Yarn count conversions. | Excellent. Library is robust. | **Project/Stash Organizer** (Inventory of yarns), **Community Sharing**. |
| **Textile Student** | Learning structure, analyzing interlacement, reverse engineering. | Good. "Structure View" helps. | **Theory overlays** (Visualizing floats, stitching points), **Interlacement 3D Slice** (Cross-section view is 2D currently). |
| **Mill Design Lab** | Accuracy, Costing, Industrial formats, Speed. | Production Calc is solid. | **JC5/EP File Export** (Stäubli/Bonas), **Machine Config** (Hook counts, Repeats), **ERP Integration**. |
| **Electronic Dobby** | Direct Loom Control. | WIF export exists. | **Serial/USB Connectivity** (WebSerial API) to drive sampling looms directly. |

---

## 2. Feature Roadmap

### Phase 1: The "Loom Engine" & Physics (Immediate)
*   [x] **Physics-Based Yarns**: Tex/Denier/Nm conversion and rendering.
*   [x] **Pattern Algebra**: Ombre, Fibonacci, Random generators.
*   [x] **Production Module**: Costing, Weight, Ticket generation.
*   [ ] **Multi-Beam Support**: Separate tension and drafting for Warp Beam A vs Warp Beam B (essential for Seersucker, Piqué).
*   [ ] **Variable Density**: Drag-and-drop zones for cramming/spacing in the reed.

### Phase 2: Professional & Industrial (Short Term)
*   **Industrial Export**: Support for Stäubli JC5, Bonas EP, and bitmap formats for Jacquard controllers.
*   **Colorway Studio**: A dedicated interface to instantly swap palette indexes without changing the weave structure. "Remap Color A -> Red" across the whole design.
*   **Yarn Inventory**: Local database of "My Yarns" with photos and physical specs, selectable in the Yarn Studio.

### Phase 3: Mobile & Tablet Optimization (Mid Term)
*   **"Loom Driver" Mode (Tablet)**:
    *   A simplified, high-contrast UI designed to be placed on the loom castle.
    *   Connects via Bluetooth/WebSockets to the desktop design.
    *   Highlights the current pick and active levers.
    *   Voice commands ("Next Pick", "Go Back").

---

## 3. Future Vision: The 3D Rendering Pipeline

To serve high-end fashion (CLO3D, Browzwear) and Gaming/VFX (Unreal, Unity), we must treat the fabric not just as an image, but as a **Physical Material**.

### 3.1 PBR Map Generation (Physically Based Rendering)
Instead of a single "preview image", the app will generate a ZIP containing 4K textures:
1.  **Albedo (Base Color)**: The visual color map, devoid of lighting/shadows.
2.  **Normal Map**: Captures the angle of every fiber twist. Crucial for how light bounces off the yarn surface.
3.  **Height/Displacement Map**: A 16-bit greyscale map representing the actual depth of the weave (warp over weft). Allows 3D engines to physically displace geometry.
4.  **Roughness/Microsurface**: Derived from yarn "hairiness" and "sheen" settings.
5.  **Opacity/Alpha**: For open weaves (gauze, leno), defining transparency.

### 3.2 Physical Behavior Data (JSON/XML)
Export a sidecar file describing the physics for cloth simulation engines:
*   **Bend Force (Weft/Warp)**: Derived from Yarn Count + Structure floats. (Satin drapes more than Plain weave).
*   **Shear Stiffness**: Resistance to diagonal distortion.
*   **Mass**: Exact GSM (Grams per Square Meter) calculated in the Production Module.
*   **Friction**: Derived from yarn roughness.

### 3.3 Implementation Strategy
*   **Headless Renderer**: Decouple the `fabricRenderer.ts` so it can run in a Service Worker or Cloud Function to generate 4k/8k maps without freezing the UI.
*   **WebGL/WebGPU**: Move the current Canvas 2D rendering to a custom WebGL shader pipeline for real-time lighting previews (e.g., seeing the sheen change as you rotate the fabric).

---

## 4. Technical Debt & Maintenance
*   **State Management**: Refactor `DobbyMaster.tsx` (currently monolithic) into a Redux Toolkit or Zustand store.
*   **Performance**: Implement `OffscreenCanvas` for the fabric simulation to prevent main-thread blocking during complex renders.
*   **Testing**: Add unit tests for the `wifParser` and `weaveGenerator` to ensure industrial accuracy.

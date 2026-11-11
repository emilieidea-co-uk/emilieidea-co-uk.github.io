# EmilieIdea Studio — Embroidery Alpha Development Plan

**Project:** From Drawing to Animated Embroidery\
**Website:** [https://emilieidea-co-uk.github.io](https://emilieidea-co-uk.github.io)\
**Route:** `/studio/embroidery/`\
**Technology:** Inkscape + Python Harness + MicroArtisan World/Player + Astro\
**Deployment:** GitHub Pages\
**Architecture:** Offline Authoring + Mobile Showcase\
**Backend:** None

---

## 1. Project Goal

Create an animated 3D embroidery showcase that transforms one of Emily's existing drawings into a visually convincing embroidery experience.

The complete workflow is:

**Drawing → Stitch Geometry → Animated MA World → MA Web Player → Mobile Showcase**

The primary development focus is **MicroArtisan Player**.

Existing software and scripts handle geometry preparation. MA Player handles 3D rendering, animation and interactive playback.

### Alpha Completion Goal

Convert one of Emily's drawings into ordered embroidery stitches, generate a 3D embroidery scene, animate the stitching process using MA Player, and publish the result on EmilieIdea Studio.

The finished showcase must work on mobile Safari and Chrome.

---

## 2. Alpha Scope

Alpha demonstrates four capabilities:

1. Visually convincing fabric and thread rendering.
2. Stitch-by-stitch embroidery construction animation.
3. MA World publishing and Web Player integration.
4. Interactive mobile presentation.

### Required Features

| Feature                          | Alpha    |
| -------------------------------- | -------- |
| One predefined drawing           | Required |
| External SVG tracing             | Required |
| Python stitch-generation harness | Required |
| 3D fabric and thread geometry    | Required |
| Needle animation                 | Required |
| Progressive stitch reveal        | Required |
| Simplified machine simulation    | Required |
| Play / pause / replay / seek     | Required |
| Basic camera interaction         | Required |
| Mobile WebGL2 rendering          | Required |
| Astro website integration        | Required |

The application is a showcase, not an embroidery editor.

---

## 3. Website Integration

Add `Studio` to the main navigation immediately after `Embroideries`.

```
EmilieIdea
│
├── Artworks
├── ScrapingBy
├── Embroideries
├── Studio
│   └── Embroidery
├── Blog
├── About
└── Contact
```

Routes:

```
/studio/
/studio/embroidery/
```

### Studio Landing Page

Introduce Studio as a place for interactive creative experiments.

Alpha contains one project:

**From Drawing to Embroidery**

### Embroidery Showcase Page

The page contains:

- Project title and short description
- Original drawing
- MA Player interactive embroidery scene
- Animation controls
- Original versus finished embroidery comparison

The page should follow EmilieIdea's existing visual identity.

---

## 4. Technical Architecture

```
Emily's Drawing
       |
       v
Offline Authoring
├── Inkscape: SVG tracing
├── Python: stitch generation
└── MA scripting: scene construction
       |
       v
Embroidery World
├── Fabric geometry
├── Thread geometry
├── Needle geometry
├── Stitch sequence
├── Animation timeline
└── Camera
       |
       v
MA World Publishing
       |
       v
MA Web Player
├── 3D rendering
├── Stitch reveal
├── Needle animation
├── Playback
└── Camera interaction
       |
       v
EmilieIdea Studio
Mobile Showcase
```

### Component Responsibilities

| Component      | Responsibility                                     |
| -------------- | -------------------------------------------------- |
| Inkscape       | Trace the original drawing into SVG curves         |
| Python harness | Generate ordered stitches and animation data       |
| MA scripting   | Construct and publish the World scene              |
| MA Player      | Render and animate the prepared embroidery         |
| Astro          | Embed the player and provide the website interface |

Inkscape and Python are offline development tools.

The published website only requires the prepared scene and MA Web Player.

---

## 5. Stage A1 — Prepare Embroidery Geometry

**Goal:** Convert one drawing into an ordered stitch sequence.

### Reference Artwork

[https://emilieidea-co-uk.github.io/artwork/instagram-DIMcj7mobvyqJGrLzHd6CALfcRwfWbV0dXgs000-01/](https://emilieidea-co-uk.github.io/artwork/instagram-DIMcj7mobvyqJGrLzHd6CALfcRwfWbV0dXgs000-01/)

### Workflow

1. Import the drawing into Inkscape.
2. Trace the important outlines.
3. Correct and simplify SVG paths.
4. Export SVG.
5. Read SVG paths using Python.
6. Sample curves into stitch positions.
7. Assign physical dimensions and thread colours.

Alpha uses simple running stitches along the drawing outlines.

Automatic image tracing and browser-based authoring are unnecessary.

### Stitch Data

```
class Stitch:
    x: float
    y: float
    color_index: int
    operation: str  # "stitch" or "jump"
```

Coordinates use millimetres.

The sequence distinguishes visible stitches from movements between disconnected paths.

### Deliverables

```
authoring/
├── source.webp
├── traced.svg
├── generate_stitches.py
└── stitches.json
```

### Acceptance Criteria

- One drawing is converted into usable SVG curves.
- Curves are sampled into ordered stitch positions.
- Stitch spacing can be configured in the script.
- Disconnected paths are handled using jumps.
- Generated geometry preserves the original drawing.

---

## 6. Stage A2 — Build the MA World Scene

**Goal:** Create the 3D embroidery scene using MA scripting.

### Scene Structure

```
EmbroideryWorld
├── Fabric
├── ThreadGeometry
├── Needle
├── Camera
└── Playback
```

### Fabric

Use a flat rectangular surface.

Visual properties:

- Natural linen colour
- Subtle woven texture
- Consistent physical dimensions
- Simple shading

No cloth deformation is required.

### Thread Geometry

Convert stitch segments into raised 3D thread geometry.

Possible representations:

- Thin tubes
- Rounded ribbons

Visual properties:

- Small but visible diameter
- Slight elevation above the fabric
- Subtle highlights
- Thread colour
- Smooth appearance at phone resolution

The finished geometry should resemble actual embroidery rather than coloured lines.

### Needle

Use a simple 3D needle mesh.

It should be visually recognisable without requiring a detailed sewing-machine model.

### Camera

Provide:

- Initial composition view
- Close-up view
- Basic orbit
- Zoom
- Reset

### Acceptance Criteria

- Fabric renders correctly.
- Thread geometry appears raised above the fabric.
- Thread geometry visually resembles embroidery.
- Needle geometry is visible.
- Camera framing works on desktop and mobile.
- Scene publishes successfully through MA World.

---

## 7. Stage A3 — Stitch Animation

**Goal:** Animate the embroidery construction process using MA Player.

This is the central technical requirement of Alpha.

### Animation Data

The Python harness generates ordered stitch events.

```
interface StitchEvent {
  start: [number, number, number];
  end: [number, number, number];

  startTime: number;
  endTime: number;

  colorIndex: number;
  operation: "stitch" | "jump";
}
```

The complete stitch sequence and its timeline are prepared before playback.

MA Player does not calculate embroidery stitches.

### Animation Sequence

Each stitch contains four phases.

**1. Position**

Move the needle/fabric to the next stitch position.

**2. Penetrate**

Move the needle vertically through the fabric.

**3. Form Stitch**

Reveal the corresponding thread segment.

**4. Advance**

Continue to the next stitch.

Completed stitches remain visible.

### Simplified Machine Simulation

Alpha uses machine-style embroidery animation:

- Needle remains horizontally fixed.
- Fabric moves in the XY plane.
- Needle repeatedly moves vertically.
- Thread appears progressively.
- Jump commands reposition without revealing thread.

No complete sewing-machine model is needed.

### Thread Reveal

Prefer precomputed geometry with timeline-based visibility.

Possible implementations:

1. Geometry reveal index.
2. Batched stitch geometry with progress control.
3. Shader-based progressive reveal.

Use existing MA World/Player capabilities where possible.

Avoid regenerating geometry every animation frame.

### Playback

Required controls:

- Play
- Pause
- Replay
- Seek

Optional:

- Playback speed
- Camera reset

### Acceptance Criteria

- Needle motion follows stitch order.
- Fabric motion remains synchronised.
- Stitches appear in the correct sequence.
- Jump operations do not create visible thread.
- Completed stitches remain visible.
- Pause and replay are deterministic.
- Seeking produces the correct intermediate state.
- Animation works in MA Web Player.

---

## 8. Stage A4 — MA Player Visual Quality

**Goal:** Produce a convincing embroidery experience on a phone.

This stage focuses on rendering quality and performance.

### Thread Rendering

Investigate:

- Thread diameter
- Tube/ribbon cross-section
- Highlights
- Colour appearance
- Anti-aliasing
- Thread/fabric contact

Use lightweight geometry and materials.

### Fabric Rendering

Investigate:

- Linen texture
- Surface colour
- Texture scale
- Shading
- Contrast

The fabric should provide context without visually competing with the thread.

### Needle Rendering

Use simple geometry and shading.

The needle should remain visible during animation without dominating the composition.

### Performance

- Precompute geometry.
- Batch stitches.
- Avoid one draw call per stitch.
- Minimise tube subdivisions.
- Use appropriately sized textures.
- Avoid unnecessary per-frame updates.
- Keep the scene lightweight.

### Acceptance Criteria

- Finished result resembles embroidery at normal phone size.
- Thread thickness is visible.
- Close-up appearance is acceptable.
- Fabric texture is subtle.
- Animation runs smoothly on mobile.
- No unnecessary geometry recalculation occurs during playback.

---

## 9. Stage A5 — Mobile Showcase Integration

**Goal:** Publish the animated embroidery scene on EmilieIdea Studio.

### Page Layout

```
+---------------------------+
|         EmilieIdea        |
|           Studio          |
+---------------------------+
|                           |
|    From Drawing           |
|      to Embroidery        |
|                           |
+---------------------------+
|                           |
|       MA Web Player       |
|                           |
|    Animated Embroidery    |
|                           |
+---------------------------+
|                           |
|    Play / Pause / Replay  |
|    Timeline               |
|                           |
+---------------------------+
|                           |
|    Original Drawing       |
|                           |
+---------------------------+
```

### Mobile Interaction

- Touch-friendly playback controls
- Natural vertical page scrolling
- Camera rotation within the viewer
- Pinch zoom
- Reset camera
- Replay animation

### Loading Strategy

- Display a static preview before loading.
- Lazy-load MA Player.
- Load only the required resources.
- Show a fallback image if WebGL2 is unavailable.
- Respect reduced-motion settings.

### Acceptance Criteria

- Studio navigation works.
- Embroidery page loads correctly.
- MA Player works in mobile Safari.
- MA Player works in mobile Chrome.
- Playback controls work with touch.
- Camera interaction is usable.
- Page scrolling is not obstructed.
- Static preview fallback works.

---

## 10. Suggested File Organisation

### Offline Authoring

```
embroidery-alpha/
├── authoring/
│   ├── source.webp
│   ├── traced.svg
│   ├── generate_stitches.py
│   ├── stitches.json
│   └── build_world.py
│
└── world/
    └── embroidery.wrj
```

### Astro Website

```
src/
└── pages/
    └── studio/
        ├── index.astro
        └── embroidery/
            └── index.astro

public/
└── studio/
    └── embroidery/
        ├── preview.webp
        └── player-assets/
```

These paths are illustrative and should be adjusted to the existing project structure.

---

## 11. Engineering Principles

### 11.1 Focus on MA Player

The Alpha is an MA Player demonstration.

Do not introduce embroidery-specific systems into MA's core.

Reuse the existing mechanisms for:

- Scene geometry
- Object transforms
- Animation playback
- Geometry reveal
- Camera control
- World publishing

Any new Player capability should be general-purpose.

### 11.2 Authoring Is External

Use Inkscape and scripts to prepare the source data.

Do not build image-processing or embroidery-editing interfaces.

The authoring harness only needs to work reliably for one reference drawing.

### 11.3 Precompute Geometry and Animation

Generate the finished stitch geometry and animation sequence before publishing.

MA Player should only load, render and animate prepared resources.

Avoid repeated geometric construction during playback.

### 11.4 Share the Same Geometry

The finished embroidery and the animation must use the same prepared stitch geometry.

The animation progressively reveals the finished result rather than constructing an independent approximation.

### 11.5 Preserve Emily's Drawing

Avoid excessive smoothing, simplification or stylisation.

The embroidery should remain recognisably based on the original drawing.

### 11.6 Mobile First for Showcase

Development and testing should regularly include actual phone-sized rendering.

Prioritise clear composition, smooth playback, legible thread geometry and simple controls.

---

## 12. Explicit Alpha Exclusions

Do not implement:

- Browser image upload
- Automatic vectorisation interface
- Curve editing interface
- Embroidery editor
- Stitch editor
- Hand embroidery simulation
- Cross-stitch generation
- DST export
- PDF instructions
- Physical embroidery validation
- Cloth physics
- Thread physics
- Detailed embroidery-machine models
- User accounts
- Backend services
- Cloud storage
- General project management
- Multiple-design publishing workflow

These features are not required to demonstrate the Alpha.

---

## 13. Alpha Release Checklist

### Authoring

- Reference drawing prepared.
- SVG paths generated.
- Ordered stitch sequence generated.
- MA World scene built.
- Animation data prepared.
- Scene published successfully.

### Rendering

- Fabric visible.
- Thread geometry visually convincing.
- Needle visible.
- Correct physical proportions.
- Appropriate camera framing.

### Animation

- Stitch-by-stitch reveal works.
- Needle animation works.
- Fabric movement is synchronised.
- Jump movements handled.
- Play/pause/replay works.
- Seeking works.

### Website

- Studio navigation added.
- Embroidery page implemented.
- MA Player embedded.
- Original drawing displayed.
- Mobile Safari tested.
- Mobile Chrome tested.
- Touch controls tested.
- Static preview fallback implemented.

---

## 14. Alpha Definition of Done

Alpha is complete when:

1. One of Emily's drawings is converted into ordered embroidery geometry using external authoring tools.
2. MA Player renders fabric, thread and needle convincingly.
3. The needle and fabric animate the stitching process.
4. Thread geometry is progressively revealed in stitch order.
5. Playback supports play, pause, replay and seeking.
6. The animation is published on EmilieIdea Studio.
7. Visitors can watch and inspect the embroidery comfortably on a phone.

## Final Objective

**Use an offline authoring harness to prepare one animated embroidery scene, and demonstrate that MicroArtisan Player can render it beautifully and efficiently on a phone.**

The Alpha is a focused MA Player showcase, not an embroidery authoring product.

Add a staged implementation orderSeparate must-have from stretch features
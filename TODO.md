# TODO

should have a scale key for images's w:h
<https://emilieidea-co-uk.github.io/artwork/instagram-CTk2dN5M9qF-01>

# EmilieIdea Studio — Animated Fabric Horse

## Development Plan V1

**Project:** From Embroidery to Soft Toy  
**Website:** https://emilieidea-co-uk.github.io  
**Route:** `/studio/fabric-horse/`  
**Technology:** Three.js + dst-format rendering + Ammo.js  
**Deployment:** GitHub Pages  
**Target:** Mobile-first interactive showcase  
**Architecture:** Three independent development stages  
**Backend:** None

---

## 1. Project Goal

Create an interactive digital version of Emily's handmade fabric horse.

The experience consists of three sequential stages:

1. **Embroidery Animation** — A flat fabric horse is gradually embroidered.
2. **Volume Inflation** — The completed flat fabric horse inflates into a soft, stuffed object.
3. **Touch Interaction** — Visitors can press the inflated horse and watch it deform and recover.

Each stage is developed, tested and accepted independently.

**Do not implement all three stages simultaneously.**

The output of one stage becomes the starting point for the next.

### Final Experience

```text
Stage 1
2D Embroidery Animation
        |
        v
Completed Flat Fabric Horse
        |
        v
Stage 2
Inflation Animation
        |
        v
Inflated Soft Toy
        |
        v
Stage 3
Mouse / Touch Interaction
        |
        v
Interactive Fabric Horse
```

The emphasis is on visual quality, simple interaction and a pleasant experience on phones.

This is an artistic showcase, not an embroidery editor or a general-purpose physics engine.

---

# Stage 1 — 2D Embroidery Animation

## 2. Goal

Create a flat embroidered version of Emily's fabric horse using the rendering techniques demonstrated by `dst-format`.

The viewer watches the horse's embroidery appear stitch by stitch.

**Stage 1 does not require any soft-body simulation or inflation.**

## 3. Technology

Use:

- Three.js for rendering.
- `dst-format` as a reference for textured stitch quads and progressive reveal.
- SVG and simple scripts for geometry preparation.
- An orthographic camera for 2D presentation.

We can reproduce the small rendering technique independently without requiring DST files.

### Rendering Method

Each stitch is represented by a textured quad:

```text
Stitch A ───────── Stitch B
         2 triangles
         Thread texture
         Normal map
```

All stitches are combined into batched geometry.

Thread appearance uses:

- Thread colour
- Thread texture
- Normal map
- Lightweight shading

Progressive reveal uses `BufferGeometry.drawRange`.

## 4. Authoring

Prepare the horse geometry offline.

Required assets:

- Outer silhouette of the horse
- Embroidery outline paths
- Fill-stitch paths
- Decorative details
- Fabric colour

Use Inkscape or scripts to create the paths.

The silhouette should preserve the recognisable proportions of Emily's original horse.

### Stitch Ordering

Generate the embroidery in a predefined sequence:

1. Outline stitches
2. Interior fill stitches
3. Decorative stitches

The exact order may be adjusted for visual presentation.

The stitch sequence must be deterministic.

## 5. Animation

Use a normalised progress parameter:

```js
progress = 0.0; // No stitches visible
progress = 1.0; // Completed embroidery
```

For each frame:

```js
const visible = Math.floor(
  progress * stitchCount
);

geometry.setDrawRange(
  0,
  visible * 6
);
```

Assume six indices per stitch.

The animation reveals complete stitches rather than partial triangles.

### Playback Controls

- Play
- Pause
- Replay
- Progress slider

### Initial State

Display the completed embroidery when the page loads.

The user can select **Watch it stitched** to start the animation from the beginning.

No autoplay.

## 6. Stage 1 Deliverables

```text
stage1/
├── horse-outline.svg
├── horse-stitches.json
├── thread-texture.png
├── thread-normal.png
└── embroidery-demo/
```

### Stage 1 Acceptance Criteria

- [ ] Horse silhouette prepared.
- [ ] Outline stitches generated.
- [ ] Fill stitches generated.
- [ ] Thread texture and shading work.
- [ ] Stitches appear progressively.
- [ ] Play, pause, replay and seek work.
- [ ] Finished result resembles the reference artwork.
- [ ] Runs on mobile Safari and Chrome.
- [ ] No inflation or physics code is required.

**Stage 1 completion:** A visually convincing, animated, flat embroidered horse.

---

# Stage 2 — Volume Inflation

## 7. Goal

Transform the completed flat embroidered horse into an inflated soft toy.

The inflation should resemble a fabric object being filled with soft stuffing.

**Stage 2 does not require mouse or touch deformation.**

It only needs a controlled inflation animation.

## 8. Technology

Use:

- Three.js for rendering.
- Ammo.js SoftBody for pressure inflation.
- Bullet SoftBody's internal pressure and elastic constraints.

Reference:

https://threejs.org/examples/physics_ammo_volume.html

### Basic Algorithm

For each simulation step:

1. Apply internal pressure.
2. Solve elastic constraints.
3. Update mesh vertices.
4. Update surface normals.
5. Render the deformed fabric.

The result should settle into a stable inflated shape.

## 9. Fabric Mesh Construction

The flat embroidered silhouette is used to generate a closed mesh.

### Geometry

1. Triangulate the front fabric surface.
2. Create a corresponding back surface.
3. Separate front and back by a small initial thickness.
4. Connect their boundaries.
5. Construct a closed manifold mesh.

```text
Front Fabric
     |
     +-- Boundary Seam
     |
Back Fabric
     |
     v
Closed Manifold Mesh
```

### Mesh Requirements

- Shared vertices
- Consistent triangle orientation
- No degenerate triangles
- Non-zero initial volume
- Sufficient resolution for deformation

The horse's legs, neck and head require suitable mesh density to preserve their shapes.

### Seam Behaviour

The boundary seam should resist stretching more strongly than the fabric interior.

Start with simple mesh topology and uniform elastic parameters.

Introduce specialised seam constraints only if the result visibly requires them.

## 10. Inflation Simulation

Use Ammo SoftBody:

```js
const softBody =
  softBodyHelpers.CreateFromTriMesh(
    physicsWorld.getWorldInfo(),
    vertices,
    indices,
    indices.length / 3,
    true
  );

const config = softBody.get_m_cfg();

config.set_kPR(pressure);
config.set_piterations(40);
config.set_kDP(0.03);
```

The pressure value is increased gradually during the inflation sequence.

### Animation Phases

**Phase A — Flat**

The horse has a small initial thickness.

**Phase B — Inflation**

Pressure increases and the surfaces expand.

**Phase C — Settling**

Pressure reaches its target and the shape stabilises.

### Important Constraint

Pressure inflation alone does not guarantee the correct stuffed-toy shape.

If the result becomes excessively spherical or distorts the horse silhouette, adjust mesh construction and elastic constraints before adding more visual effects.

## 11. Embroidery Attachment

The completed Stage 1 embroidery must remain attached to the front fabric during inflation.

Do not simulate every thread as a separate soft body.

Instead:

1. Associate each embroidery vertex with a triangle on the front fabric.
2. Store its barycentric coordinates.
3. During deformation, evaluate its position from the corresponding triangle.
4. Update the embroidered surface.

```text
Fabric Triangle
    |
    +-- Stitch vertices
    |   (barycentric coordinates)
    |
    v
Deformed Fabric
    |
    v
Deformed Embroidery
```

This preserves the decorative pattern as the fabric changes shape.

The stitch rendering method from Stage 1 should be reused.

## 12. Stage 2 Deliverables

```text
stage2/
├── horse-mesh.json
├── horse-surface-mapping.json
├── inflation-demo/
└── physics-config.json
```

### Stage 2 Acceptance Criteria

- [ ] Closed manifold horse mesh generated.
- [ ] SoftBody simulation initialises.
- [ ] Inflation can be started and completed.
- [ ] The horse silhouette remains recognisable.
- [ ] The final shape resembles a stuffed fabric object.
- [ ] Inflation reaches a stable state.
- [ ] Embroidery remains attached to the fabric.
- [ ] Animation works on a phone.
- [ ] No touch interaction is required.

**Stage 2 completion:** A flat embroidered horse that inflates into a stable soft toy.

---

# Stage 3 — Mouse and Touch Interaction

## 13. Goal

Allow visitors to interact with the inflated horse by pressing its surface.

The horse should deform locally and recover when released.

**Stage 3 begins only after Stage 2 has a stable inflation result.**

## 14. Interaction Design

### Desktop

- Move mouse to target the fabric.
- Press and hold to deform.
- Drag slightly to change the pressing position.
- Release to recover.

### Mobile

- Touch the fabric to press.
- Move the finger to change the contact point.
- Release to recover.

The interaction should feel gentle and playful.

Do not add complex gesture controls or a full physics editor.

## 15. Contact Algorithm

Use a virtual collision sphere to simulate a finger pressing the soft body.

### Interaction Pipeline

```text
Mouse / Touch
      |
      v
Raycast to Horse
      |
      v
Contact Position
      |
      v
Virtual Collision Sphere
      |
      v
Ammo SoftBody Collision
      |
      v
Local Deformation
      |
      v
Elastic Recovery
```

### Implementation

1. Raycast against the horse mesh.
2. Determine the contact point and surface normal.
3. Position a small collision sphere near the surface.
4. Move the sphere inward while pressing.
5. Update the soft-body simulation.
6. Remove or retract the sphere when released.

The sphere is invisible in the final presentation.

### Interaction Limits

Apply limits to:

- Maximum penetration depth
- Contact radius
- Pressing speed
- Maximum force or displacement

These limits prevent unstable or extreme deformation.

### Recovery

After release:

- Remove the contact force.
- Continue the physics simulation.
- Let the elastic constraints and internal pressure restore the shape.
- Apply sufficient damping to prevent excessive oscillation.

## 16. Stage 3 Deliverables

```text
stage3/
├── touch-controller.js
├── collision-controller.js
└── interactive-demo/
```

### Stage 3 Acceptance Criteria

- [ ] Mouse pressing works.
- [ ] Touch pressing works.
- [ ] Surface deforms locally.
- [ ] Embroidery follows the deformation.
- [ ] Releasing restores the shape.
- [ ] Deformation remains stable.
- [ ] Normal page scrolling is preserved outside the interactive area.
- [ ] Interaction is responsive on mobile Safari and Chrome.

**Stage 3 completion:** A soft fabric horse that visitors can gently press and release.

---

# Website Integration

## 17. Studio Page

Create:

`/studio/fabric-horse/`

The final page contains three sequential experiences.

### Experience 1 — Embroidery

Watch the flat horse being embroidered.

### Experience 2 — Inflation

Watch the completed embroidery transform into a stuffed object.

### Experience 3 — Touch

Interact with the inflated fabric horse.

Each stage has its own entry and completion state.

The user advances explicitly to the next stage.

**Do not automatically launch the next stage when the previous animation finishes.**

### Suggested Controls

| Stage | Controls |
|---|---|
| Embroidery | Play, Pause, Replay, Seek |
| Inflation | Inflate, Reset |
| Touch | Press, Release, Reset |

The mobile interface should remain simple and visually focused.

---

# Engineering Rules

## 18. Keep the Three Stages Independent

Each stage must run and be tested independently.

Do not implement touch interaction while developing stitch animation.

Do not introduce soft-body physics until the completed 2D embroidery visualisation works.

Reuse prepared geometry and data between stages.

## 19. Reuse Existing Libraries

Use Three.js for rendering.

Use `dst-format`'s rendering approach for stitched quads and progressive reveal.

Use Ammo.js for pressure inflation and soft-body interaction.

Do not develop a custom physics solver for V1.

## 20. Keep Geometry Consistent

The horse silhouette is the common source for:

- Embroidery outlines
- Fabric surface
- Closed soft-body mesh
- Embroidery attachment mapping

Avoid independently redrawing the horse for every stage.

## 21. Mobile Performance

Optimise for phone browsers:

- Batch stitch geometry.
- Keep thread meshes lightweight.
- Use low-resolution fabric textures initially.
- Limit soft-body mesh complexity.
- Avoid unnecessary GPU updates.
- Use a stable simulation timestep.
- Provide a static image fallback.

Test each stage on mobile before advancing.

## 22. Explicit Exclusions

Do not implement:

- Browser embroidery authoring
- DST export
- PDF instructions
- Multiple embroidery projects
- Detailed needle simulation
- Realistic fabric fibre physics
- Individual thread physics
- Sewing-machine simulation
- Full hand or finger models
- General-purpose soft-body modelling tools
- Backend services
- User accounts
- Cloud storage

The project is one interactive artwork.

---

# Development Order

| Milestone | Deliverable | Release Gate |
|---|---|---|
| **Stage 1** | Animated 2D embroidered horse | Visual stitching works on phone |
| **Stage 2** | Pressure-inflated fabric horse | Stable inflated shape |
| **Stage 3** | Interactive soft toy | Touch deformation and recovery |
| **Integration** | EmilieIdea Studio page | Three experiences work sequentially |

Each stage should produce a standalone working demo before integration.

---

# Definition of Done

The project is complete when visitors can:

1. Open EmilieIdea Studio on a phone.
2. Watch Emily's fabric horse appear through animated embroidery.
3. Advance to inflation and watch the flat fabric become a soft toy.
4. Advance to interaction and gently press the horse.
5. Observe the soft body deform and return toward its original shape.
6. Reset or replay each stage independently.

The visual identity should remain connected to Emily's handmade work, not resemble a generic physics demonstration.

## Final Objective

**EmilieIdea Studio — From Embroidery to Soft Toy**

Three independent stages:

**1. Stitch it.**  
**2. Inflate it.**  
**3. Touch it.**

A small interactive artwork built with existing browser technologies, progressing from a flat embroidery pattern to a playful, touch-responsive fabric object.
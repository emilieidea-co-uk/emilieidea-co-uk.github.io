# EmilieIdea Studio — Interactive Fabric Horse

## Development Plan — Prototype

- **Website:** <https://emilieidea-co-uk.github.io>
- **Reference artwork:** <https://emilieidea-co-uk.github.io/artwork/instagram-Cw78VrTsdij-01>
- **Platform:** Browser, mobile-first
- **Technology:** TypeScript + Three.js + a custom XPBD soft-body solver
- **Deployment:** Astro + GitHub Pages

## 1. Goal

Build an interactive visual simulation based on Emily's handmade fabric horse, so students can see how a flat piece of fabric becomes an embroidered, stuffed, touch-responsive object.

### Core principle: Change → Simulate → Observe**

The project has four stages: Cut → Stitch → Inflate → Touch. Each stage must produce a working browser demo and be proven before the next one is relied on. The immediate goal is to prove that these four simulations work on a phone, not to build a full application architecture or educational platform.

## 2. Technology References

| Technology | Purpose | Link |
| --- | --- | --- |
| Three.js | Rendering, SVGLoader, Raycaster | <https://threejs.org> |
| XPBD | Soft-body algorithm (Macklin et al., 2016) | Research paper |
| Ten Minute Physics (Matthias Müller) | Reference for inflatable soft bodies and volume constraints | <https://matthias-research.github.io/pages/tenMinutePhysics/> |
| cdt2d / earcut | Outline triangulation and constrained Delaunay meshing | npm |
| dst-format | Embroidery rendering reference (stitch-sequence approach only) | <https://github.com/manthrax/dst-format> |
| Inkscape | Prepare the horse SVG silhouette | <https://inkscape.org/> |
| Astro | Website integration | <https://astro.build/> |

## 3. Development Strategy

**Prototype first. Architecture later.**

1. Build each stage as a small, standalone browser demo.
2. Use existing libraries and examples wherever possible; the soft-body solver is the one custom component.
3. Verify the visual result and interaction on a real phone at every milestone.
4. Share geometry between stages through fixed JSON files.
5. Integrate the stages into EmilieIdea Studio only after they work.

Do not design a general-purpose framework at this stage. Do not involve MicroArtisan Player.

## 4. Data Flow and Stage Dependencies

The stages form a pipeline, but each demo can start from a fixed data file in `public/data/` without running the earlier stages first.

| Stage | Depends on | Input (a fixed file can stand in) | Output |
| --- | --- | --- | --- |
| Stage 1 Cut | None | horse.svg, fabric texture | `outline.json`, `mesh.json` |
| Stage 2 Stitch | Stage 1 outline | `outline.json` | `stitches.json` |
| Stage 3 Inflate | Stage 1 mesh | `mesh.json` | Per-frame vertex positions |
| Embroidery attachment | Stage 2 + Stage 3 | `stitches.json` + mesh | Barycentric bindings |
| Stage 4 Touch | Stage 3 solver | Solver instance | Interaction |

```ts
// outline.json: horse outline, normalised to unit scale
interface Outline {
  polyline: [number, number][];   // closed, evenly resampled
  bbox: { w: number; h: number };
}

// mesh.json: Stage 1 output, Stage 3 input
interface FabricMesh {
  restPos: Float32Array;          // flat 2D rest coordinates (x, y) per vertex
  uv: Float32Array;               // texture coordinates derived from restPos
  tris: Uint32Array;              // triangle indices (one panel)
  boundary: Uint32Array;          // ordered boundary vertex indices
  // Front and back panels share one topology:
  // boundary vertices are welded, interior vertices exist once per side.
}

// stitches.json: Stage 2 output
interface StitchPath {
  side: 'front' | 'back';
  points: [number, number][];     // polyline in flat rest coordinates
  kind: 'outline' | 'decor';
}
```

## 5. The Four Stages

### Stage 1 — Cut

**Goal:** Cut a horse-shaped piece from a flat, textured fabric.

- Display a 2D fabric texture.
- Parse the horse SVG with `SVGLoader` and place it over the fabric.
- Let users move and scale the pattern (this only changes UV offset and scale, not geometry).
- Animate the cut along the outline with a shader progress parameter or a progressive outline trace.
- Generate front and back pieces; the back is a mirror of the front.
- **Mesh generation:** resample the outline at even spacing, add interior Steiner points, then run constrained Delaunay triangulation. Aim for near-equilateral triangles with roughly uniform edge length.

**Mesh size:** about 800–1,500 vertices per panel, 2,000–3,000 particles after welding.

**Technology:** Three.js, SVGLoader, cdt2d (or earcut plus refinement).

**Result:** Two textured 2D fabric pieces, plus `outline.json` and `mesh.json`.

### Stage 2 — Stitch

**Goal:** Animate embroidery on the flat fabric.

- Offset the outline inward to generate outline stitch paths at even stitch length.
- Decorative stitches in the prototype are limited to a few simple types: parallel lines, zigzag and dotted lines. Satin fill is out of scope.
- Render each stitch as a textured ribbon segment (instanced), lifted slightly along the surface normal.
- Animate stitches appearing one by one, with a needle animation.
- Let users adjust stitch spacing; changing it regenerates the paths.

**Technology:** Three.js, using the dst-format idea of rendering an ordered stitch-point sequence. Internally the project uses its own polyline structure.

**Result:** A flat embroidered fabric horse, plus `stitches.json`.

### Stage 3 — Inflate

**Goal:** Turn the flat fabric horse into a soft, inflated object.

- Build a closed mesh from the front and back panels (boundary vertices welded).
- Run the XPBD pressure simulation described in Section 6.
- Let users change the pressure with a slider.
- Keep the embroidery attached to the deforming fabric: for each stitch sample point, store (triangle index, barycentric coordinates) in the rest state. Each frame, interpolate the current position and lift it slightly along the normal to avoid z-fighting.

**Technology:** TypeScript XPBD solver + Three.js.

**Result:** A stable, recognisable inflated fabric horse with embroidery that follows the cloth.

### Stage 4 — Touch

**Goal:** Let users interact with the inflated soft toy.

- Press the surface with a mouse or finger.
- Observe the local dent, then release and watch the shape recover.
- Optionally adjust material stiffness.

**How it works:** a Raycaster finds the contact point and places a small fingertip sphere there. The sphere acts as a collision constraint that pushes penetrating particles outward. Moving the sphere deeper creates the dent, and internal pressure restores the shape on release.

**Technology:** Three.js Raycaster + the same XPBD solver.

**Result:** An interactive soft toy.

## 6. Inflation Solver Design (XPBD)

The horse is inflated by a custom position-based solver (XPBD) written in TypeScript. It has no WASM dependency, works on typed arrays only, and exposes every parameter for tuning.

### 6.1 Data layout

All state lives in `Float32Array` buffers, so no objects are allocated per frame and mobile garbage collection stays quiet.

- `pos`, `prev`, `vel`: particle position, previous sub-step position and velocity (3 components each).
- `invMass`: inverse mass per particle (0 pins a particle; the prototype pins none).
- Constraint arrays: edges (`edgeA`, `edgeB`, `restLen`), bending pairs (opposite vertices of adjacent triangles) and the triangle list used by the volume constraint.

### 6.2 Time step

Each frame is split into `n` sub-steps (8–12 in the prototype), with `h = dt / n`:

1. **Predict:** `prev = pos`, `vel += g·h` (gravity can be small), `pos += vel·h`.
2. **Solve constraints** with compliance `α̃ = α / h²`: distance, bending, volume, then collisions.
3. **Update velocity:** `vel = (pos − prev) / h`, then apply light damping.

More sub-steps with one iteration each is more stable than fewer sub-steps with many iterations.

### 6.3 Constraints

**Distance (every edge).** Keeps the fabric nearly inextensible; use a very small compliance α.

```ts
C  = |xi - xj| - L0
dλ = (-C - α̃·λ) / (wi + wj + α̃)
xi += wi · dλ · n,   xj -= wj · dλ · n
```

**Bending.** Fabric resists folding; without this the mesh crumples. The prototype adds a distance constraint between the two opposite vertices of each pair of adjacent triangles, with a compliance several orders of magnitude larger than the edge constraint. If that is not enough, upgrade to dihedral-angle constraints.

**Volume (pressure).** The enclosed volume of the closed mesh is:

```latex
V = \frac{1}{6}\sum_{t}\,(x_1 \times x_2)\cdot x_3
```

The constraint is `C = V − p·V0`, where `V0` is the volume after pre-inflation and `p` is the user-controlled inflation ratio (pressure slider, roughly 0.8–2.5). For each triangle the vertex gradients are:

```text
∇x1 V = (x2 × x3) / 6
∇x2 V = (x3 × x1) / 6
∇x3 V = (x1 × x2) / 6
```

There is one global volume constraint, but it loops over every triangle, so it is the main per-step cost. Its compliance sets how firm the air feels: a small value behaves like a rigid balloon, a larger value gives a softer toy that dents more under a press.

**Collisions.**

- Ground: project particles with `y < 0` back to 0, optionally with friction.
- Fingertip sphere (Stage 4): push any particle inside the sphere out along the radial direction.
- Self-collision: not implemented in the prototype; the pre-inflation gap between front and back panels prevents interpenetration.

### 6.4 Pre-inflation

When the two panels lie on top of each other, V ≈ 0 and the volume constraint is numerically unstable. When the closed mesh is built, offset each interior vertex in z according to its distance `d` to the boundary:

```text
z = ± H · sqrt(d / dmax)
```

The front panel takes +z, the back panel takes −z, and boundary vertices stay at z = 0. This gives a flat pillow with a clearly positive volume, which becomes the reference for `V0`.

### 6.5 Keeping the horse recognisable

Uniform internal pressure on inextensible fabric rounds off thin parts: legs, neck and tail become cylinders and can pinch. This is physically correct, and real toys rely on uneven stuffing to avoid it. Countermeasures, in order:

1. Design the silhouette without very thin parts; legs and neck need a minimum width.
2. Cap the inflation ratio so the toy stays about three-quarters full.
3. Optional: split the mesh into regions (head, neck, body, legs), each with its own volume constraint and inflation ratio, to imitate uneven stuffing. This needs region labels in `mesh.json`.
4. Optional: add a narrow side gusset between the panels to change the cross-section.

The acceptance target is a recognisable, rounded soft-toy horse, not an exact copy of the flat silhouette.

### 6.6 Rendering

- Write `pos` into the `BufferGeometry` position attribute every frame and recompute vertex normals (acceptable for about 3,000 vertices).
- Use the rest-state UVs from Stage 1 so the fabric texture deforms with the mesh.
- Add an optional fabric normal map for surface detail.

### 6.7 Performance budget

| Metric | Target |
| --- | --- |
| Particle count | 2,000–3,000 |
| Sub-steps per frame | 8–12 |
| Solver time per frame | Under 8 ms on a phone |
| Frame rate | 30 fps or more on phones, 60 fps on desktop |
| Allocation | None per frame in steady state |

If the budget is missed, apply these in order: reduce particle count, reduce sub-steps, move the solver into a Web Worker with transferable `Float32Array` buffers, then reduce the normal-update rate.

### 6.8 Tuning panel

During development, expose a lil-gui panel (removed in the release build) with inflation ratio, edge compliance, bending compliance, volume compliance, damping, sub-step count and gravity. Parameter tuning is the main workload of Stage 3, so leave time for it.

## 7. Project Structure

Keep it minimal.

```bash
src/
  common/     # shared types, JSON loading, Three.js scene boilerplate
  cut/        # SVG parsing, mesh generation, cut animation
  stitch/     # stitch path generation, ribbon rendering
  xpbd/       # solver (constraints, integration, collisions); no Three.js dependency
  inflate/    # closed-mesh construction, pre-inflation, embroidery binding
  touch/      # raycasting, fingertip sphere, pointer events
public/data/  # outline.json, mesh.json, stitches.json, horse.svg, textures
demos/        # one standalone entry page per stage
```

The `xpbd/` module depends only on typed arrays, which makes it easy to test on its own and to move into a Worker later.

## 8. Milestones and Deliverables

Durations are rough single-developer estimates, used for ordering only.

| Milestone | Scope | Deliverable | Acceptance | Estimate |
| --- | --- | --- | --- | --- |
| **M0 Risk validation** (parallel) | (a) XPBD inflation of a procedural two-panel disc mesh; (b) minimal SVG-to-UV-mesh demo | Two minimal pages | Disc inflates into a stable pillow at 30 fps; horse outline yields a uniform mesh | 3–5 days |
| **M1 Cut demo** | Move and scale pattern, cut animation, export mesh JSON | `cut.html`, `outline.json`, `mesh.json` | Texture is cut into the horse shape; triangle quality passes (minimum angle above 20°) | 3–4 days |
| **M2 Stitch demo** | Stitch path generation, sequential animation, spacing slider | `stitch.html`, `stitches.json` | Convincing animated stitches on the flat fabric | 3–4 days |
| **M3 Inflate demo** | Load M1 mesh, close it, pre-inflate, pressure slider | `inflate.html` | Horse inflates into a stable, recognisable soft shape; 30 fps or more on a phone | 5–8 days (including tuning) |
| **M4 Embroidery attachment** | Bind M2 stitches to the M3 mesh | Updated `inflate.html` | Stitches stay on the fabric as it deforms, with no visible floating or flicker | 2–3 days |
| **M5 Touch demo** | Fingertip sphere, dent and recovery, stiffness slider | `touch.html` | Press makes a dent, release restores the shape; touch does not conflict with camera rotation | 3–4 days |
| **M6 Integration** | Astro page, lazy loading of solver and assets, mobile UI polish | Live on GitHub Pages | Full Cut → Stitch → Inflate → Touch flow works on a phone | 3–5 days |

**Key checkpoint:** at the end of M0 the inflation spike must be stable. If it is not, debug the volume constraint and pre-inflation before moving on.

## 9. Main Technical Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| Horse inflates into a balloon; legs or neck thin out or collapse | Medium-high | Adjust the silhouette, cap the inflation ratio, use region-based volume constraints if needed |
| Front and back panels interpenetrate | Medium | Pre-inflation gap, welded boundary, simplified minimum-distance check if needed |
| Volume constraint is numerically unstable | Medium | Sub-steps instead of iterations, non-zero compliance, `V0` measured after pre-inflation |
| Phone performance is too low | Medium | Limit particle count, use a Web Worker, reduce render load |
| Poor mesh quality gives unnatural fabric behaviour | Medium | Generate a uniform mesh in Stage 1; track minimum triangle angle |
| Embroidery floats or distorts in stretched areas | Low | Barycentric binding plus normal offset; ignore stitch thickness changes in the prototype |
| Touch conflicts with camera rotation | Low | Pointer events; one finger presses, two fingers rotate |

## 10. Prototype Acceptance

| Stage | Success condition |
| --- | --- |
| Cut | A fabric texture is clipped into the horse silhouette with good triangle quality (minimum angle above 20°) |
| Stitch | The horse displays convincing animated stitches with adjustable spacing |
| Inflate | The horse inflates into a stable, recognisable soft shape with embroidery attached; 30 fps or more on a phone |
| Touch | Users can press the horse, see a local dent and watch it recover |

Each stage must produce a standalone browser demo that has been verified on a real phone.

## 11. Out of Scope

The following are not part of the prototype:

- A general-purpose soft-body or physics framework
- Complex embroidery such as satin fill
- Full self-collision handling
- Realistic physics of cutting, tearing or sewing
- MicroArtisan Player or any educational platform features

## 12. Final Objective

### EmilieIdea Studio — Interactive Craft Simulations

### Cut → Stitch → Inflate → Touch

One handmade fabric horse, four interactive experiments. The immediate goal is to prove that these four simulations run in a phone browser and look and feel good, not to build a complete application architecture or educational platform.

# Studio — drawing to hand stitches

Use **Prev**, **Next** and **Reset** to test each step manually at
`http://localhost:4321/studio/drawing-to-stitches/`.
The steps are standalone, beginning with **← Studio**. Only the step title,
current controls, drawing or stitch image, and navigation appear. The drawing
selector's label and select stay on one line. Instructions, descriptions and
routine status text are omitted; errors still appear when necessary. Canvas
panels fill the available browser width, without a fixed maximum width.
Each step's image shrinks to keep its navigation buttons in the visible window.
The introductions below the buttons remain available by scrolling down.

## Add or edit a drawing

Each drawing is one JSON file in `src/data/studio/` and one SVG file in
`src/assets/studio/`. Copy an existing pair, then edit the JSON:

```json
{
  "id": "petals",
  "name": "Petal medallion",
  "hasOutline": true,
  "hasFill": true,
  "source": "petals.svg",
  "defaults": {
    "length": 6,
    "gap": 4,
    "lineWidth": 1.35,
    "fillLineWidth": 0.5,
    "pattern": "petals",
    "spacing": 28,
    "angle": 0
  }
}
```

- Keep `id` permanent: existing shared links use it. Use a unique lowercase ID
  with letters, numbers and hyphens. `name` is the drawing selector label.
- `source` is the SVG filename, without a directory path.
- `hasOutline: false` skips the outline step; `hasFill: false` skips the fill step.
  At least one must be true. Step numbers, Preview and Back to edit follow the
  available steps automatically.
- Selecting a different drawing applies that drawing's `defaults`. Prev/Next keep
  edits. Reset selects Petal medallion and its defaults again. If it is removed,
  the first drawing alphabetically is used instead.
- Shared URL parameters override the selected drawing's defaults. Omitted or
  invalid parameters use its defaults. Existing parameter names remain valid.

Accepted defaults are the dropdown values in `src/studio/options.mjs`:
length 2–14; gap 1–12; line widths 0.5, 1, 1.35, 2, 3 or 4;
pattern petals, rows or crosshatch; spacing 12, 18, 24, 28, 36 or 48;
angle 0, 15, 30, 45, 60 or 90.

The SVG must have a `viewBox` and **only direct `<path>` children**:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path fill="none" d="M10 10 L90 90"/>
  <path fill="#ccc" fill-rule="evenodd"
        d="M10 10 H90 V90 H10 Z M35 35 H65 V65 H35 Z"/>
</svg>
```

`fill="none"` means a line; a filled path defines an area that can receive a
pattern. A compound filled path must use `fill-rule="evenodd"` so holes remain
empty. Separate `M` subpaths stay separate, without connecting stitches. Filled
paths close automatically. Paths may use relative or absolute commands and
curves; other SVG elements, groups, styles and transforms are not supported.
Convert shapes to paths and flatten transforms in your drawing editor first.
Drawings scale proportionally into the 600 × 440 stitch canvas, keeping their
viewBox origin and aspect ratio.

New pairs appear automatically in local development and production builds.
`scripts/studio-catalog.mjs` validates the JSON and SVG, then uses SVGO's
[convertPathData](https://svgo.dev/docs/plugins/convertPathData/) at build time to
normalize commands. It generates the ignored `.astro/studio/catalog.json` cache;
do not edit or commit that file. SVGO is not shipped to the browser. Invalid
files produce an error naming the drawing rather than silently dropping it.

## Step 1 — choose a drawing

Choose Petal medallion, Flower or Horse silhouette. Only the drawing and its
selector appear: no stitch preview or stitch controls yet. Filled areas are
neutral grey. Next advances to the outline; Prev is disabled at the beginning.

## Step 2 — stitch the outline

Only the stitched preview appears in Steps 2 and 3. The original drawing and its
selector are only shown in Step 1; the chosen drawing is kept in later steps.
Use Prev to return to Step 1 if you want to change it.
Try the Stitch length, Gap between stitches and Line width dropdowns. Larger
lengths make longer marks, larger gaps leave more empty space, and larger widths
make thicker lines. Separate paths should never gain connecting lines. The
medallion's centre stays open. Prev returns to the drawing; Next opens fill.

## Step 3 — add a pattern fill

Try Rows, Crosshatch and Petals on all drawings. Change Pattern spacing and
Direction. Fill stitches are grey, outlines are darker, and holes stay empty.
The outline from Step 2 remains visible; there is no outline selector in Step 3.
Only Pattern, Pattern spacing, Direction and Fill line width appear in Step 3.
Fill line width starts at the thinnest option, 0.5, independently of the outline.
Stitch length, gap and line width stay applied from Step 2; use Prev to adjust them.
Increase spacing if a dense combination exceeds the limit.
Prev returns to the outline while keeping settings. The Next button becomes
**Preview** and opens a separate animation page with the current settings.

## Preview — watch the stitches

1. In Step 3, choose **Preview**. The animation opens at
   `/studio/drawing-to-stitches/preview/<drawing-id>/` with your settings in its URL.
   This standalone page shows Back to edit, title, short description, two
   playback buttons, Share link, canvas, progress status and an original-post link,
   with no site sidebar or footer.
2. Check that the dark outline stitches appear before the grey fill. The small
   dot marks the current stitch; separate paths should not gain connecting lines.
3. Try **Pause / Play** and **Restart**. Both buttons should stay on one row.
4. Check that playback uses the fixed slow speed and progress appears in the
   status below the canvas. There are no Speed or Progress dropdowns.
   Outline and fill use the same thread distance per second; longer fill
   segments must not cause an apparent speed-up.
5. Choose **Back to edit**. Step 3 should reopen with the exact drawing, pattern,
   spacing, direction, stitch length, gap, outline width and fill width you chose.
6. Refresh or copy the preview URL: the same settings should be retained.
7. With reduced motion enabled, the design starts complete and paused. You can
   explicitly press Play to watch it. Switching away from the page pauses it.
8. Try keyboard controls, a phone, both themes and Safari 15.
   The preview fits the visible browser height: its canvas shrinks to keep the
   heading, controls, status and original-post link visible. Resize the window
   or rotate the phone and check again. Oversized accessibility text can still
   scroll rather than being clipped.
9. Choose **Share** and check for **Link copied**. The copied URL should open the same drawing and every
   selected setting. It uses the current site's address: a local preview copies
   a local URL, and the published website copies a public URL. If copying is
   blocked, a hidden selection-based copy is tried. No URL box is shown; if both
   methods fail, the message asks you to copy the browser address. The
   original-post link is at the end of the page.

## Start again and device checks

Reset from any step returns to Step 1 with the medallion, length 6, gap 4, width
1.35, fill width 0.5, Petals, spacing 28 and direction 0°. Try going backwards and
forwards to confirm settings are preserved until Reset. Check keyboard control,
both themes, phone layout and Safari 15. Numbers are relative drawing units, not
millimetres or textile recommendations.

## Later exercises — pending manual review

Complete-design SVG/PNG downloads remain a later exercise. Use the same segment
data and line widths for preview and export. No DST or machine files. The
separate fabric-horse simulation remains a future tutorial.

## Code and dependencies

- `src/data/studio/*.json`: drawing names, stable IDs, supported steps and defaults.
- `src/assets/studio/*.svg`: prepared path-only source drawings.
- `scripts/studio-catalog.mjs`: build-time validation, discovery and path normalization.
- `src/studio/studies.ts`: typed drawing catalog and SVG preview.
- `src/studio/navigation.ts`: available steps and dynamic titles.
- `src/studio/sample-svg.ts`: browser sampling of SVG curves.
- `src/studio/stitches.ts`: independent stitch geometry and pattern helpers.
  Pattern controls appear in Step 3. Export helpers are prepared and tested;
  downloads are not exposed yet.
- `src/studio/canvas.ts`: native Canvas 2D initialization and step controls.
- `src/studio/preview.ts`: preview animation and playback controls.
- `src/studio/settings.ts`: bounded URL settings shared by editor and preview.
- `src/studio/render-canvas.ts`: rendering independent stitch segments.
- `src/studio/drawing-selection.ts`: immediately available drawing selection.
- `src/components/studio/StitchStudy.astro`: controls and preview layout.

Runtime: **TypeScript and native Canvas 2D**. No rendering library, external
startup lifecycle or typings submodule is needed. Drawing selection is initialized
before the stitch renderer. The canvas backing resolution is capped at 2× for
high-density screens while drawing coordinates remain 600 × 440. Only control
changes trigger rendering in the editor. The preview runs animation frames only
while playing, stops when complete, and pauses when the page is hidden.
`vendor/dst_format` remains a conceptual reference, not a runtime dependency.

```sh
npm run check:studio
npm run test:studio
npm run build
npm run test:artwork-build
```

## Drawing-specific social sharing

Each drawing gets its own static preview page and 1200 × 630 PNG card during the
Astro build. The card uses that drawing's default pattern, spacing, direction,
stitch lengths and widths, and honors `hasOutline` / `hasFill`. It is metadata
only and does not add an image to the visible page. The title remains
**EmilieIdea - Stitch**; the card also names the drawing.

The drawing ID in a new preview URL takes precedence over a conflicting
`drawing` query parameter so the card and animation always refer to the same
shape. Other query parameters still restore the visitor's choices. Old query-only
URLs forward visitors to the corresponding drawing page; social crawlers reading
those old URLs still receive a generic card. Re-share using the Share button to
get the drawing-specific card. No external image service is needed.

Use `npm run gen:studio-share` to inspect cards in `.astro/studio/share/`.
Production PNGs are emitted automatically at each drawing page's `share.png` URL.

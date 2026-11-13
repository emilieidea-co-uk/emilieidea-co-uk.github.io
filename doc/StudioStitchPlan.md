# Studio — drawing to hand stitches

Use **Prev**, **Next** and **Reset** to test each step manually at
`http://localhost:4321/studio/drawing-to-stitches/`.

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
   `/studio/drawing-to-stitches/preview/` with your settings in its URL.
   This standalone page shows Back to edit, title, short description, two
   playback buttons, Share link, canvas, progress status and an original-post link,
   with no site sidebar or footer.
2. Check that the dark outline stitches appear before the grey fill. The small
   dot marks the current stitch; separate paths should not gain connecting lines.
3. Try **Pause / Play** and **Restart**. Both buttons should stay on one row.
4. Check that playback uses the fixed slow speed and progress appears in the
   status below the canvas. There are no Speed or Progress dropdowns.
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

- `src/studio/studies.ts`: curated SVG study drawings.
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

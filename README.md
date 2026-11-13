# EmilieIdea

An artist portfolio for pottery, printmaking, scratchboard, and embroidery, built
with Astro and published at **https://emilieidea-co-uk.github.io/**.

Navigation: **Artworks · ScrapingBy · Embroideries · Studio · Blog · About · Contact**.
Artworks is the home page. Each gallery has light/dark branding and a lightbox.
Published images from the same Instagram post share one gallery tile and carousel;
every image retains its own permanent URL and share preview.

## Run locally

Use Node.js **22.12 or newer**; `.nvmrc` and GitHub Actions use Node 22.
Python 3 is needed for the optional CSV importer and some test suites.

```bash
npm ci
npm run dev
```

Open **http://localhost:4321/**. For phone testing, join the same Wi-Fi and open
Astro’s printed **Network** URL on your phone. Use the computer’s IP address,
not `localhost`. Development listens on `0.0.0.0:4321` and supports hot reload.

If a background server needs restarting:

```bash
npm exec astro dev stop
npm run dev
```

Check the production build separately:

```bash
npm run build
npm run preview -- --port 4322
```

Open **http://localhost:4322/**. Add `--host 0.0.0.0` to the preview command to
check that build on your phone too. Production CSS targets Safari 15 so older
iPhones retain the mobile menu and single-column gallery. Keep `cssTarget` in
[astro.config.mjs](astro.config.mjs) when changing build settings.

## Update website content

For adding images and descriptions, editing blog posts, and changing page text,
follow [HowToUpload.md](HowToUpload.md). It is written for the person maintaining
the artwork and does not require a local development environment.

## Import selected Instagram posts

Use the [local Chrome extension and ZIP importer](import_tool/README.md) to choose
posts from a profile, preview and capture their photos one by one, review the
numbered thumbnails and shared caption, and add new images as unpublished.
Automatic scanning is optional. The tool guide explains the Console diagnostics
for checking Instagram layouts.

```bash
npm run import:instagram -- ~/Downloads/instagram-export.zip --dry-run
npm run import:instagram -- ~/Downloads/instagram-export.zip
```

The importer preserves existing IDs and edits and skips duplicates. Real Instagram
extraction still needs the live acceptance check described in the tool guide.

## Optional CSV import

For an existing reviewed selection and a local Instagram CSV archive:

```bash
python3 scripts/import-embroideries.py --collection artworks \
  --selection src/data/artworks.json
```

Use `scrapingby` or `embroideries` with the matching selection file for other
projects. `--csv path/to/export.csv` overrides the default archive CSV; downloaded
images must sit beside it with their exported filenames. Archives are excluded
from Git and must be supplied locally. `--limit` checks the selected count; it
does not choose additional images. Without `--selection`, the script reuses the
existing manifest.

The CSV importer refreshes captions, dates, and source URLs, preserves existing
IDs and publication settings by filename, and sorts newest first. It can replace
manually edited captions; the ZIP importer above skips existing records entirely.

## Advanced blog images

For posts with images, use `.mdx`. The existing
[post](src/content/blog/a-line-through-thread-clay-and-print.mdx) demonstrates
`Photo` (one column) and `Gallery` (two columns, one on mobile). Import these
components from `../../components/`, specify the project with `collection`, and
use the exact filename in `src`. Project references reuse captions and respect
publication settings. Blog-only images go in `src/assets/blog/` and omit
`collection`. Routine text editing is covered only in the user guide.

## Studio development

The first tutorial is at `/studio/drawing-to-stitches/`. The three steps use
TypeScript and native Canvas 2D: choose a drawing, stitch its outline, then add an open pattern fill.
**Prev** and **Next** preserve settings; **Reset** starts again at Step 1.
Step 3's **Preview** button opens the stitch animation on a separate page;
**Back to edit** restores all settings. Follow the
[manual test checklist](doc/StudioStitchPlan.md) to review each step and preview.

Drawings are JSON/SVG pairs in `src/data/studio/` and `src/assets/studio/`.
Their names, defaults and available steps come from JSON. Only SVG `<path>`
elements are supported; new pairs are discovered automatically. See
[adding a Studio drawing](doc/StudioStitchPlan.md#add-or-edit-a-drawing).

Run `npm run check:studio` and `npm run test:studio` to check the Canvas controls,
rendering and stitch geometry. No drawing library or submodule is required.

Each drawing has a social sharing image generated automatically from its SVG,
JSON defaults and outline/fill flags during the build. Sharing uses drawing-specific
URLs such as `/studio/drawing-to-stitches/preview/flower/?length=6&gap=4…`.
Images appear only in sharing metadata; selected settings still control playback.
Old `/preview/?drawing=…` links forward visitors to the matching drawing page.
Old links retain a generic social card because their HTML is static; use the new
Share button to copy a link with the matching drawing's card.

Run `npm run gen:studio-share` to inspect all cards locally in
`.astro/studio/share/`. Those files are generated and should not be committed.
The build publishes each image at `/studio/drawing-to-stitches/preview/<id>/share.png`.

## Refresh logos and sharing artwork

The source logo is `src/assets/ei_logo.jpg`; category lettering is generated
from `scripts/ei-logo-template.svg`.

```bash
npm run gen:brand
npm run gen:icons
npm run gen:placeholders -- --og-only
```

These refresh `ei-<category>-light.png` / `ei-<category>-dark.png`, favicons, and
the share image. Artworks is the
default brand; ScrapingBy and Embroideries use their category logos on their pages.

## Deploy to GitHub Pages

Repository: [emilieidea-co-uk/emilieidea-co-uk.github.io](https://github.com/emilieidea-co-uk/emilieidea-co-uk.github.io).

1. In [Settings → Pages](https://github.com/emilieidea-co-uk/emilieidea-co-uk.github.io/settings/pages),
   set the publishing source to **GitHub Actions**.
2. Commit and push changes to `master`.
3. Wait for **Deploy to GitHub Pages** in the
   [Actions tab](https://github.com/emilieidea-co-uk/emilieidea-co-uk.github.io/actions) to finish.

The workflow runs `npm run build` on Node 22 and deploys `dist/`. Do not commit
`dist/` or the original archives. The site uses the domain root, with no Astro
`base` path. GitHub Pages does not apply the optional `public/_headers` file.

## Licensing

The template code is covered by the [MIT license](LICENSE). Artwork, photographs,
and writing retain their own rights; see the [site’s licensing page](src/pages/license.astro).

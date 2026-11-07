# EmilieIdea

An artist portfolio for pottery, printmaking, scratchboard, and embroidery, built
with Astro and published at **https://emilieidea-co-uk.github.io/**.

Navigation: **Artworks · ScrapingBy · Embroideries · Blog · About · Contact**.
Artworks is the home page. Each gallery has light/dark branding and a lightbox.

## Run locally

Use Node.js **22.12 or newer**; `.nvmrc` and GitHub Actions use Node 22.
Python 3 is needed only for the optional CSV importer.

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

## Manage project images

Each collection uses `src/assets/<collection>/` for images and
`src/data/<collection>.json` for its reviewed selection. Original archives are
also under `src/assets/`, but are excluded from Git and development polling.

| Gallery | Page | Collection | Original archive |
| --- | --- | --- | --- |
| Artworks | `/` | `artworks` | `ei_original_3_ar/` |
| ScrapingBy | `/scrapingby/` | `scrapingby` | `ei_original_2_sc/` |
| Embroideries | `/embroideries/` | `embroideries` | `ei_original_1_em/` |

Manifest entries contain `file`, `publish`, `caption`, `date` (UTC), and `postUrl`.

- Set `publish: false` to hide an image from the gallery and any blog references.
- Only listed images appear; copying a file into the folder alone does not publish it.
- The JSON array controls display order. Captions show three lines in galleries,
  with the full text available in the lightbox.
- To add an image manually, copy it into its collection folder and add its metadata
  to the matching JSON file.

The importer requires the original archive and its CSV export, which are not
included in a fresh clone. To refresh a reviewed selection, for example:

```bash
python3 scripts/import-embroideries.py --collection artworks \
  --selection src/data/artworks.json --limit 50
```

Use `scrapingby` or `embroideries` with their matching manifests for the other
collections. `--limit` checks the selected count; it does not choose extra images.
`--csv path/to/export.csv` overrides the source export. Imports copy originals,
refresh captions and dates, preserve existing `publish` values by filename, and
sort by post date newest first, then carousel sequence. Without `--selection`,
the importer reuses the existing manifest rather than selecting unrelated posts.

Builds generate responsive WebP images and remove unreferenced source images
from `dist/`. Images committed to this public repository remain accessible in Git.

## Edit the blog and pages

Posts live in [src/content/blog/](src/content/blog/). Add a `.md` or `.mdx` file;
its filename becomes `/blog/<filename>/`. Posts are listed newest first.

```yaml
---
title: 'A new piece'
description: 'Notes on the materials and process.'
pubDate: 2026-11-07
draft: false
---
```

Use `draft: true` to exclude a post from production; drafts remain visible in dev.
For images, use MDX: `Photo` provides a full-width image and `Gallery` provides
two columns, collapsing to one on phones. Their optional `collection` property
reuses published project images and captions. See the
[current post](src/content/blog/a-line-through-thread-clay-and-print.mdx) for examples.

Edit [src/config.ts](src/config.ts) for the name, navigation, and social URLs.
About, Contact, Privacy, and Licensing are editable files in `src/pages/`.
Layout and responsive styles are in [src/styles/global.css](src/styles/global.css).

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

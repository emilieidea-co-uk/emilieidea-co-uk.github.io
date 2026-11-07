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

## How to upload images and related descriptions

See [HowToUpload.md](HowToUpload.md#add-images-and-descriptions) for the steps to
copy images into a project, add captions, and control which images are published.

| Gallery | Image folder | Description file |
| --- | --- | --- |
| Artworks (home page) | `src/assets/artworks/` | `src/data/artworks.json` |
| ScrapingBy | `src/assets/scrapingby/` | `src/data/scrapingby.json` |
| Embroideries | `src/assets/embroideries/` | `src/data/embroideries.json` |

Each image needs an entry in its description file. Set `publish: false` to hide
it. Run `npm run assign:ids` after adding entries to save their permanent IDs.
Each published image has an individual `/artwork/<id>/` page; **Copy Link** in
the lightbox shares that image. The guide also explains the optional CSV importer.

## Import from Instagram

Use the [local Chrome extension and ZIP importer](import_tool/README.md) to choose
posts from a profile, review photos and captions, and add new images as unpublished.

```bash
npm run import:instagram -- ~/Downloads/instagram-export.zip --dry-run
npm run import:instagram -- ~/Downloads/instagram-export.zip
```

The importer preserves existing IDs and edits and skips duplicates. Real Instagram
extraction still needs the live acceptance check described in the tool guide.

## Edit the blog and pages

Posts live in [src/content/blog/](src/content/blog/). About, Contact, Privacy, and
Artwork & Image Use live in `src/pages/`. Site name, navigation, and social URLs
are in [src/config.ts](src/config.ts).

See [the blog guide](HowToUpload.md#edit-the-blog) for a post template and image
examples, and [the page guide](HowToUpload.md#edit-pages) for the files to edit.

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

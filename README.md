

# Photography Portfolio + Blog — Astro Template

A minimal, fast photography portfolio with a blog and a fixed left-hand
navigation (**Artworks · ScrapingBy · Embroideries · Blog · About ·
Contact**) and responsive photo galleries. Built with
[Astro](https://astro.build) and output as a fully static site you can deploy to
any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3/CDN, …).

It ships with **tasteful, generated placeholder images and example posts**, so it
looks complete the moment you run it. Swap in your own name, links, and photos
and you have a finished site.

- **Embroideries** is the home page; **ScrapingBy** and **Artworks** are separate galleries.
- **Blog** combines the existing Markdown/MDX posts in one chronological list with a share button.
- **About / Contact / License / Privacy** are simple, editable pages.
- Layout adapts from a sidebar (desktop) to a top bar + menu (tablet & phone).
- Click any photo for a full-screen lightbox (arrow keys / swipe-friendly).
- Light/dark theme toggle, privacy-friendly by default, strong SEO out of the box.

> **Everything you see is a placeholder.** The photos are generated gradients,
> the name is "EmilieIdea", and the blog post is an example. The steps below
> walk you through making it your own. Also, check this template in production https://xdqin.com/,
> how to deploy the site on cloudflare https://xdqin.com/blog/tech/building-and-deploying-xdqin-com-on-cloudflare/ 

---

## 1. Quick start

**Requirements:** Node **≥ 22.12** (required by Astro 7; this repo's `.nvmrc`
pins major `22`).

```bash
# Use this repo as a GitHub template (green "Use this template" button), or clone:
git clone https://github.com/XD-QIN/astro-photo-folio.git my-site
cd my-site
npm install
npm run dev
```

Open **http://localhost:4321/**. Edits to pages, styles, `src/config.ts`, and
photos in `src/assets/**` hot-reload instantly. Press `Ctrl+C` to stop.

For a phone preview, connect your phone to the same Wi-Fi as your computer.
`npm run dev` also listens on your local network at port `4321`. Open the
**Network** URL printed by Astro on your phone and add `/artworks/` to preview
that gallery. Use your computer's Wi-Fi IP address, rather than `localhost`,
on the phone. Hot reload works through this address too.

To preview the **real production build** (optimized WebP, sitemap, etc.):

```bash
npm run build
npm run preview
```

> Security headers in `public/_headers` are applied by your static host (e.g.
> Netlify or Cloudflare Pages), so they won't appear under `npm run preview` —
> that's expected.

---

## 2. Make it yours

Work top to bottom; each step is independent.

### 2.1 Name, links & description → `src/config.ts`

This one file drives the brand, page titles, SEO, JSON-LD, and `llms.txt`:

```ts
export const site = {
  name: 'EmilieIdea',
  nameZh: '',                 // optional second-script name (see §4); '' hides it
  title: 'EmilieIdea',
  description: 'A minimal photography portfolio and blog…',
};

export const social = {
  instagram: 'https://www.instagram.com/yourusername',
  github:    'https://github.com/yourusername',
};
```

To change the social icons themselves, edit the `<Icon>` list in
`src/components/Sidebar.astro` and the `links` array in `src/pages/contact.astro`
(both reference `social`). An unused icon (`scholar`) is included if you'd rather
swap one out.

### Project images

The three project folders and their reviewed manifests are:

| Gallery | Images | Manifest | Original archive |
| --- | --- | --- | --- |
| Embroideries | `src/assets/embroideries/` | `src/data/embroideries.json` | `src/assets/ei_original_1_em/` |
| ScrapingBy | `src/assets/scrapingby/` | `src/data/scrapingby.json` | `src/assets/ei_original_2_sc/` |
| Artworks | `src/assets/artworks/` | `src/data/artworks.json` | `src/assets/ei_original_3_ar/` |

Embroideries retains its existing 20 images and publication choices. ScrapingBy
contains 30 reviewed scratchboard images; Artworks contains 50 reviewed pottery,
embroidery/mending, and printmaking images. Multiple images from one post are
allowed. Selections exclude unrelated personal photographs and are ordered by
post date, newest first, then carousel sequence. Work-in-progress images are
included alongside finished pieces.

Each entry has `file`, `publish` (boolean), `caption`, `date` (UTC), and `postUrl`.
Set `publish: false` to hide it from the gallery, lightbox, and gallery metadata.
Missing `publish` defaults to visible. Only listed, published images appear;
unlisted files can remain in the project folders without appearing on the site.
Captions show up to three lines, with full text available in the lightbox.

Reimport the reviewed selections with:

```bash
python3 scripts/import-embroideries.py --collection embroideries --selection src/data/embroideries.json --limit 20
python3 scripts/import-embroideries.py --collection scrapingby --selection src/data/scrapingby.json --limit 30
python3 scripts/import-embroideries.py --collection artworks --selection src/data/artworks.json --limit 50
```

`--selection` accepts a JSON array of entries containing `file`, using the same
shape as a gallery manifest. Captions and dates are refreshed from the CSV;
existing `publish` values are preserved by filename. New entries default to
published. Without `--selection`, an existing manifest is reused rather than
replaced with unreviewed recent posts. `--csv path/to/export.csv` overrides the
source export. Originals are preserved and excluded from Git and dev polling.

Embroideries opens at `/`, ScrapingBy at `/scrapingby/`, and Artworks at
`/artworks/`. The old `/embroideries2/` address redirects to `/scrapingby/`.

The **Blog** sidebar link opens `/blog/`, listing posts from
`src/content/blog/`, newest first. Posts use `/blog/<slug>/` URLs.
The former Tech Blog content and pages are removed. The former Digital and
Analog pages are removed.
Licensing remains linked in the footer.

### 2.2 Project photos

Project images live in `src/assets/embroideries/`, `src/assets/scrapingby/`,
and `src/assets/artworks/`. See **Project images** above for captions,
publication controls, and importing the CSV sample.

### 2.3 About / Contact / License / Privacy pages

- `src/pages/about.astro` — your biography and introduction to the work.
- `src/pages/contact.astro` — the social links shown as cards.
- `src/pages/license.astro` — image-usage terms shown to visitors.
- `src/pages/privacy.astro` — a privacy-friendly starting policy. **Review it
  before publishing** (it's a sensible default, not legal advice) and update the
  `lastUpdated` date.

### 2.4 Blog posts → `src/content/blog/`

The blog is a folder of Markdown files. **Drop in a `.md` (or `.mdx`) file and
it appears** — newest first, with the filename becoming the URL slug
(`my-post.md` → `/blog/my-post/`). The current post is
`a-line-through-thread-clay-and-print.mdx`; the former example post was removed.
Until the blog has a post, it shows *"Please wait patiently for the first post."*

Start every file with frontmatter:

```yaml
---
title: 'A clear, specific title'
description: 'One or two sentences — shown on the index and as the meta description.'
pubDate: 2026-06-01
tags: ['astro', 'web']                    # optional
cover: '../../assets/blog/my-cover.jpg'   # optional lead image
coverAlt: 'Describe the image for screen readers.'
draft: false                              # true = hidden from the production build
---
```

- **Code blocks** are highlighted with **Prism** via CSS classes; theme colors
  live in `global.css` under *"Prism syntax theme."*
- **In-post photos & galleries** (same responsive WebP pipeline + lightbox as the
  galleries): put images in `src/assets/blog/` and use the `.mdx` extension so
  you can drop in components — no `import` of the image needed, just reference by
  filename:

  ```mdx
  import Photo from '../../components/Photo.astro';
  import Gallery from '../../components/Gallery.astro';

  <Photo src="lake-fog.jpg" caption="Lake, fog" />
  <Gallery photos={["01-ridge.jpg", "02-coast.jpg"]} />
  ```

  For existing project images, add `collection="embroideries"`,
  `collection="scrapingby"`, or `collection="artworks"`. The filename must be
  listed in that project's JSON manifest. Captions default to the project caption,
  and `publish: false` hides the image from blog posts as well as the gallery.
  `<Photo>` is full width; `<Gallery>` uses its existing two-column layout on
  larger screens and one column on phones. The post
  above demonstrates single images and a two-column pottery/printmaking pair.

### 2.5 Your domain → `astro.config.mjs`

This repository is configured for its GitHub Pages organization URL:

```js
site: 'https://emilieidea-co-uk.github.io',
trailingSlash: 'always',
```

Canonical tags, Open Graph, sitemap links, `llms.txt`, and JSON-LD use this
origin. No `base` is needed because the site is served at the domain root.
Internal links use the shared helpers in `src/lib/urls.ts`.
For a custom domain at the domain root, update `site`.

### 2.6 Your logo (optional)

The logo source is `src/assets/ei_logo.jpg`. To change it, replace that file,
then run `npm run gen:brand` and `npm run gen:icons`. The light logo preserves
the original artwork; the dark logo uses transparent white areas and inverted
light ink (`max(0, 225 - channel)`). Refresh the share image with
`npm run gen:placeholders -- --og-only`.

Artworks is the main site logo on general pages, favicons, and the share image.
The Embroideries home page uses the embroidery seal, and ScrapingBy uses its
own seal on `/scrapingby/`.
Both themes use matching sizes.
`npm run gen:brand` creates all three source pairs using the original artwork
and the lower-ring lettering template in `scripts/category-seal.svg`;
`npm run gen:icons` creates the six display logos and the default app icons.

---

## 3. How photos are served (web-resolution only)

The site **never serves your full-resolution original**. At build time every
photo is converted to responsive **WebP** and capped at **`MAX_WEB` = 3840px**
(4K) on the long edge — crisp on high-res displays, but a downscaled,
recompressed derivative rather than your printable original. A post-build step
(`scripts/strip-unreferenced-assets.mjs`) then deletes any source originals Astro
copies out while transforming, so only the web renditions ship.

- **Sharper 8K viewing:** raise `MAX_WEB` in `src/lib/photos.ts` (e.g. `5120`).
  Lower it for more protection.
- Right-click, drag-to-save, and selection are disabled on photos (a deterrent —
  screenshots are always possible). **No watermark.**
- Note: the full-resolution files you place in `src/assets/**` live in your Git
  repo (not on the website). If the repo is public and you don't want originals
  there either, keep a private repo or store originals elsewhere.

---

## 4. Regenerating the bundled placeholders & brand

These scripts produce everything the template ships with — handy if you change
your name, tweak the logo, or want fresh placeholders. They need no network and
use the `sharp` that ships with Astro.

```bash
npm run setup              # runs all three of the steps below, in order
# — or individually —
npm run gen:brand          # converts ei_logo.jpg into the two source seals
npm run gen:icons          # derives seal.png/seal-dark.png + favicons from them
npm run gen:placeholders   # rebuilds gallery/blog placeholders + og.jpg
```

- The **OG share image** (`public/og.jpg`) reads your name from `src/config.ts`,
  so re-run `npm run gen:placeholders -- --og-only` after a name change to refresh
  just that image.
- Once you've added your own photos and logo, you can delete the `scripts/` you no
  longer need.

### A second-script name (optional)

If you set `site.nameZh` (e.g. a Chinese 中文名), it shows under the brand and on a
couple of pages, using your system's CJK serif. For pixel-identical rendering on
every device, self-host a tiny font subset containing just your characters:

```bash
pip install fonttools brotli
pyftsubset NotoSerifCJKsc-Regular.otf --text="你的名字" \
  --flavor=woff2 --output-file=public/fonts/name.woff2
```

Then add an `@font-face` (and a `unicode-range` for just those characters) in
`src/styles/global.css` and put its family first in `--serif-cjk`. See the
comments at the top of `global.css`.

---

## 5. Blog: sharing & comments

### Share button

Every post has a **Share** button using the device's native share sheet where
available, otherwise copying the link to the clipboard — entirely client-side, no
third-party script.

### Comments (not wired up)

There's a placeholder slot in `src/layouts/BlogPost.astro` marked
`── Comments ──`. Free options: **[Giscus](https://giscus.app)** (GitHub
Discussions — best for a tech blog), [utterances](https://utteranc.es) (GitHub
Issues), [Cusdis](https://cusdis.com) (self-hosted, anonymous), or
[Cactus Comments](https://cactus.chat) (Matrix). Any embedded widget loads a
third-party script, so also add its domain to the `Content-Security-Policy` in
`public/_headers`.

---

## 6. Discoverability (search engines & AI)

Built to be **found and cited** by search engines and AI answer engines, while
staying **out of AI training sets**.

- **Crawler stance** (`src/pages/robots.txt.ts`): search + AI *search/citation*
  crawlers are allowed; AI *training* / bulk crawlers (`GPTBot`, `CCBot`,
  `ClaudeBot`, …) are blocked. Edit the `ALLOW` / `BLOCK` lists to change it.
  `robots.txt` is advisory; if your host or CDN can block by User-Agent, you can
  additionally enforce the block list there. (Search engines, incl. Google Images,
  aren't on the list and pass through untouched.)
- **Sitemap** via `@astrojs/sitemap`, linked from `robots.txt`.
- **`llms.txt`** (`src/pages/llms.txt.ts`): a curated Markdown index for AI tools
  (see https://llmstxt.org/).
- **Structured data (JSON-LD):** a `Person` + `WebSite` graph on every page, plus
  an `ImageGallery` of `ImageObject`s per gallery.
- **Per-page** `<title>`, meta description, Open Graph + Twitter card, and a
  branded share image at `public/og.jpg`.
- **Photo SEO is text-driven** — name files descriptively (`lake-fog.jpg`, not
  `IMG_2451.jpg`): the name becomes the image's `alt` text.

> `robots.txt` is advisory. The `Cross-Origin-Resource-Policy` header (in
> `public/_headers`) also blocks other sites from hot-linking your images on hosts
> that apply it.

---

## 7. Security & privacy

- **Content-Security-Policy** served as an HTTP header from `public/_headers`:
  `default-src 'self'` locks scripts/styles/images/fonts to the same origin, with
  no third-party allowances.
- Security headers in `public/_headers`: `X-Frame-Options`,
  `Cross-Origin-Resource-Policy` (anti-hotlinking), HSTS, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`. These apply once served by a host that
  honors `_headers` (e.g. Netlify, Cloudflare Pages), or once you translate them
  into your web server's config.
- **Privacy policy** at `src/pages/privacy.astro` — a sensible, cookieless
  default. Review and adjust it for your jurisdiction before publishing.

---

## 8. Commands

| Command                    | Action                                            |
| -------------------------- | ------------------------------------------------- |
| `npm run dev`              | Start the dev server                              |
| `npm run build`            | Build into `dist/` (also strips orphaned sources) |
| `npm run preview`          | Preview the production build locally              |
| `npm run gen:brand`        | Regenerate the placeholder logo "seal" sources    |
| `npm run gen:icons`        | Derive seal/favicons from the seal sources        |
| `npm run gen:placeholders` | Regenerate placeholder photos + the OG image      |

---

## 9. Deploy

`npm run build` outputs a plain, fully static site to `dist/` — deploy that
directory to any static host. There's no server runtime, database, or
host-specific configuration to maintain.

### GitHub Pages — this repository

The site publishes to **https://emilieidea-co-uk.github.io/** from the
`emilieidea-co-uk/emilieidea-co-uk.github.io` repository.

1. In [repository Pages settings](https://github.com/emilieidea-co-uk/emilieidea-co-uk.github.io/settings/pages),
   select **GitHub Actions** as the **Source** under **Build and deployment**.
2. Commit and push the site changes, including `.github/workflows/deploy.yml`
   and `package-lock.json`, to `master`.
3. Check the **Deploy to GitHub Pages** workflow in the repository's **Actions**
   tab. Once deployment succeeds, open the URL above.

Every push to `master` builds and deploys automatically. You can also run the
workflow manually from **Actions → Deploy to GitHub Pages → Run workflow**.
The workflow uses Node 22 and runs `npm run build`, including the cleanup of
unreferenced source images, before uploading `dist/`. Do not commit `dist/`.

Local development still works with `npm run dev` at
**http://localhost:4321/**, including hot reload. For a production check,
run `npm run build` followed by `npm run preview` and open the root URL
printed by Astro.

GitHub Pages does not apply `public/_headers`. The site works there, but the
custom HTTP security headers documented below are not enabled by that file.

### Connect your Git repo (recommended)

Most static hosts can build straight from GitHub. Push this repository, then
point your host at it with these settings:

- **Build command:** `npm run build`
- **Output / publish directory:** `dist`
- **Node version:** `22` (matches `.nvmrc`)

Every push then rebuilds and redeploys automatically. This works on Netlify,
Vercel, Cloudflare Pages, GitHub Pages (via an action), and similar.

### Build locally and upload

```bash
npm run build         # → dist/
```

Then publish `dist/` however you like — drag-and-drop to a host, `rsync` to a
server, or sync to an object store (e.g. S3) behind a CDN.

### Response headers (optional)

`public/_headers` carries the Content-Security-Policy and other security headers.
Hosts such as Netlify and Cloudflare Pages apply it automatically; on Nginx,
Apache, or S3/CloudFront, translate those rules into the server/CDN config (see
§7). The site works without them — they're hardening, not a requirement.

### Custom domain

Add your domain in your host's dashboard, then set `site` in `astro.config.mjs`
to that URL (see §2.5). After deploying, submit
`https://your-domain/sitemap-index.xml` to Google Search Console and Bing
Webmaster Tools.

---

## 10. Project structure

```
src/
├── assets/
│   ├── embroideries/   # ← Embroidery images
│   ├── scrapingby/     # ← ScrapingBy project images
│   ├── artworks/       # ← Artwork project images
│   └── blog/           # ← Blog photos (referenced by <Photo> / <Gallery>)
├── components/         # Sidebar, PhotoGrid, Lightbox, Logo, Icon,
│                       #   Photo, Gallery, ShareButton, PostCard, BaseSchema
├── content/            # ← Blog posts (Markdown / MDX)
│   └── blog/           #     Blog posts → /blog/<slug>/
├── content.config.ts   # ← Blog collections + frontmatter schema
├── data/
│   ├── embroideries.json # ← Embroidery publication settings and captions
│   ├── scrapingby.json # ← Curated scratchboard selection
│   └── artworks.json   # ← Artworks captions, dates, and publish controls
├── lib/photos.ts       # web-resolution image rendering (MAX_WEB)
├── layouts/            # Layout.astro, BlogPost.astro
├── pages/              # index (Embroideries), scrapingby, artworks, blog/*
├── styles/global.css
└── config.ts           # ← name, nav, social links  (START HERE)
scripts/
├── generate-brand.mjs            # placeholder logo "seal" sources
├── generate-icons.mjs            # derives seal + favicons from the sources
├── generate-placeholders.mjs     # placeholder photos + OG share image
└── strip-unreferenced-assets.mjs # post-build: removes orphaned originals
```

---

## License

The template **code** is released under the [MIT License](./LICENSE) — use it
freely, including for commercial projects.

Once you add your own work, **your photographs and writing are yours** — MIT
covers the template, not your content. The visitor-facing
[image-licensing page](src/pages/license.astro) defaults to "all rights
reserved"; edit it to suit you.

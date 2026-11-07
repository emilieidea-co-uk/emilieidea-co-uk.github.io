# Weekly update — implementation status

## Stage 1: permanent image IDs and individual pages

Implemented using the existing three collections and `publish` field:

- Every image has a persisted `id`, `postId`, and `imageIndex`.
- Instagram IDs use `instagram-<shortcode>-<two-digit image index>`.
  Images without an Instagram URL receive a saved generated ID.
- Published images have a category-independent URL: `/artwork/<id>/`.
  Each carousel image gets its own page.
- Detail pages include the full caption, date, category, original post link
  when available, responsive image, and individual social preview metadata.
- Galleries and blog project images retain the existing lightbox with a
  **Copy Link** action and a selectable URL fallback.
- Unpublished images have no detail page or sitemap entry.
- The CSV importer preserves IDs. `npm run assign:ids` assigns IDs to manually
  added entries; repeat runs keep existing IDs.

Maintenance: [HowToUpload.md](HowToUpload.md).
Checks: `npm run test:artworks` and `npm run build`.

## Next stage: local Chrome extension and weekly import

Still to implement. Use a locally installed Chrome extension in place of the
original Tampermonkey proposal. Export a ZIP of new Instagram images and metadata,
then merge it with a local import command. Recognise existing images by their
saved post ID and carousel index, preserve manual edits, and default new entries
to `publish: false`. Keep the current folders and JSON files.

Instagram caption and complete carousel extraction needs a live feasibility
check before committing to fully automatic collection. No credentials stored in
the extension, unattended background scraper, paid service, or backend is planned.

The original reference proposal is retained below. Its `public` field, single
manifest, post-level URLs, and `public/images/` storage are superseded by the
stage-one decisions above.

---

Development Plan — Astro Artwork Gallery
Project: Emilie Idea · GitHub Pages · Astro Photo Folio
1. Objective
Extend the existing Astro artwork website with two capabilities:
1. Individual artwork URLs — Every published artwork has a permanent, shareable page with its own image, caption and social-media preview.
2. Weekly Instagram import — A small Chrome userscript imports new Instagram pictures and captions into the website's JSON data, without requiring a paid service or always-running backend.
Keep the existing Astro gallery, image layout, lightbox, and GitHub Pages deployment.
Design principle: Automatic importing, manual publishing.
2. Architecture
Instagram
Pictures + captions
Existing artworks
JSON + local images

Chrome userscript + local import
Download new posts, deduplicate and merge
artworks.json
Stable IDs · Metadata · Public visibility
Astro build
Gallery + detail pages + social metadata
GitHub Pages
emilieidea-co-uk.github.io/scrapingby/
No database, cloud storage service, server-side API or scheduled GitHub Actions job is required.
3. Feature A — Individual artwork pages
3.1 URL structure
Keep the current category galleries and add static artwork detail pages.
Page	Example URL
Gallery	/scrapingby/
Artwork	/scrapingby/artwork/CncgbN7todm/
Another artwork	/scrapingby/artwork/Cxyz123/
Use the original Instagram shortcode as the artwork ID where available. For imported items without one, generate a stable ID once.
IDs must not depend on gallery position, filenames or captions.
3.2 Gallery behaviour
Preserve the existing browsing experience:
* Clicking a thumbnail opens the existing lightbox.
* Next/previous navigation continues working.
* Each lightbox has a Share/Copy Link action pointing to its artwork detail page.
* Opening a shared link displays the specific artwork rather than the whole gallery.
The artwork detail page should contain the image or carousel, complete caption, date, category, and a link back to the gallery.
3.3 Static page generation
Use Astro's getStaticPaths() to generate pages from artworks.json.
Only records with public: true generate pages.
Each detail page should have:
* Unique HTML title and description.
* Canonical URL.
* Open Graph og:title, og:description, og:image, og:url.
* Twitter/X card metadata.
* An absolute HTTPS image URL for link previews.
* Sitemap entry.
This enables a shared link to show the artwork's own preview on platforms such as WhatsApp and Facebook.
Avoid breaking any existing gallery URLs.
4. Feature B — Artwork JSON data
Use one JSON data source for the gallery and artwork pages.
[
  {
    "id": "CncgbN7todm",
    "source": "instagram",
    "instagramUrl": "https://www.instagram.com/p/CncgbN7todm/",
    "title": "Untitled Artwork",
    "caption": "Original Instagram caption.",
    "date": "2026-11-01",
    "category": "ScrapingBy",
    "images": [
      "/images/artworks/CncgbN7todm-01.jpg",
      "/images/artworks/CncgbN7todm-02.jpg"
    ],
    "public": true
  }
]
Data rules
* id is immutable.
* public defaults to false for new imported posts.
* title, category, caption and public can be edited manually.
* Instagram imports never overwrite these manually edited fields.
* Multiple images from one Instagram carousel remain grouped under a single artwork ID.
* Importing the same post twice must not create duplicates.
* Image filenames should be deterministic and stable.
For a straightforward implementation, keep the JSON file in src/data/artworks.json and the publishable images in public/images/artworks/.
Privacy rule: Do not commit unpublished image files or metadata to a public repository if they must remain private. public: false prevents Astro from generating artwork pages, but it is not access control for files already committed publicly. The simplest policy for this project is to import only material already public on Instagram.
5. Feature C — Weekly Instagram import
5.1 Approach
Use a small Tampermonkey userscript running inside Chrome.
The script operates when the user visits the relevant Instagram profile.
No Instagram login credentials or tokens should be stored inside the script.
5.2 User interaction
Add a small interface:
Instagram Artwork Export
Local browser helper — proposed interface
Manual sync
Previously imported
142 posts
New posts found
5 posts
Export new postsIllustrative UI only; the Chrome script will implement the actual export action.
5.3 Export procedure
1. Visit Emilie's Instagram profile in Chrome.
2. Run the userscript using an Export New Posts button.
3. Find available post IDs and compare them with a supplied manifest of previously imported IDs.
4. Retrieve new images, carousel images, captions, dates and post URLs where accessible.
5. Download a ZIP containing media files and a JSON manifest.
6. Run a local import script to merge the ZIP into the Astro project.
The script should not assume Instagram exposes all captions or carousel images directly from the profile grid. It may need to inspect individual opened posts.
The implementation should avoid undocumented private API endpoints, automatic login, bypassing rate limits or anti-bot protections. If Instagram changes its interface, return a clear error instead of silently importing incomplete records.
5.4 Weekly operation
The user performs the sync once per week, manually.
Open Instagram
    ↓
Click "Export New Posts"
    ↓
Download ZIP
    ↓
Run local import command
    ↓
Review artworks.json
    ↓
Set public: true where desired
    ↓
Git push
    ↓
GitHub Pages rebuild
This is not an unattended background task. Weekly operation means the workflow is available whenever the user runs it.
6. Feature D — Local importer
Suggested command:
npm run import:instagram -- ~/Downloads/instagram-export.zip
The importer should:
1. Validate the ZIP and metadata.
2. Match posts by stable Instagram ID.
3. Skip existing posts.
4. Copy new images to the artwork assets directory.
5. Append new records to artworks.json.
6. Default new records to public: false.
7. Report imported, skipped and failed posts.
Example result:
Instagram Import

Existing artworks: 142
New posts found:     5
Imported:            5
Skipped:             0
Errors:              0

Updated artworks.json
Added 7 image files
The importer must be idempotent: processing the same export twice leaves the data and images unchanged on the second run.
7. Suggested source structure
project/
├── src/
│   ├── data/
│   │   └── artworks.json
│   ├── pages/
│   │   └── artwork/
│   │       └── [id].astro
│   └── components/
│       ├── ArtworkGallery.astro
│       ├── ArtworkDetail.astro
│       └── ArtworkLightbox.astro
├── public/
│   └── images/
│       └── artworks/
├── scripts/
│   ├── instagram-export.user.js
│   └── import-instagram.mjs
└── astro.config.mjs
Adapt the component names and paths to the existing Astro Photo Folio project rather than replacing its working gallery implementation.
8. Development stages
Implementation checklist
0 / 19 completed

Stage 1 — JSON data model
Define artwork IDs and fields
Create JSON loading/validation
Preserve current gallery layout

Stage 2 — Shareable artwork pages
Generate detail pages with getStaticPaths()
Add artwork-specific Open Graph metadata
Add Share/Copy Link to the lightbox
Verify shared links and browser navigation

Stage 3 — Local Instagram importer
Implement ZIP + metadata parser
Deduplicate by post ID
Preserve manually edited fields
Add npm import command

Stage 4 — Chrome userscript
Export selected/new Instagram posts
Include captions, dates and carousel images when available
Generate structured ZIP
Handle missing data and interface changes

Stage 5 — Deployment and acceptance
Test local and GitHub Pages base paths
Test mobile image previews and lightbox
Verify no unpublished page generation
Verify repeat import causes no changes
9. Acceptance criteria
The work is complete when:
* Every public artwork has a permanent URL and a correct social-media preview.
* The existing gallery and lightbox remain functional.
* A weekly Chrome export can capture new Instagram posts with their available captions and images.
* The importer creates no duplicates and preserves manual edits.
* New artworks default to unpublished.
* GitHub Actions publishes the updated static website.
* No paid Instagram service, dedicated backend or database is required.
Scope boundary: Do not build a content management system, automated Instagram login, server-side scraper, or custom cloud service. The whole solution should remain a small extension of the existing Astro site.
The priority is Stage 1–2 first (shareable artwork pages), followed by Stage 3–4 (incremental Instagram import).

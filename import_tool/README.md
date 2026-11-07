# Instagram import tool

A local Chrome extension collects selected Instagram photos and reviewed captions.
The local ZIP importer adds them to Artworks, ScrapingBy, or Embroideries with
`publish: false`. Existing images, permanent IDs, captions, and publication settings
are preserved. No publishing or Git push happens automatically.

The tools and automated fixture tests are implemented. **A live Instagram test is still required**: Instagram's
rendered interface can vary by account, language, and site changes. No private
Instagram API or stored login token is used.

## Install locally in Chrome

Use Chrome 116 or newer.

1. Run `npm ci` in the repository root, using Node.js 22.12 or newer.
2. Open `chrome://extensions/` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and choose this folder:
   `astro_photo/import_tool/extension/` (not the repository root).
4. Pin **EmilieIdea Instagram Import** from Chrome's Extensions menu.
5. Click its toolbar icon. The capture workspace opens in a normal tab and stays
   open while you move between Instagram posts. It needs no Chrome Web Store upload.

After changing extension code, click **Reload** on its card at
`chrome://extensions/`, then reload the capture workspace.

The extension requests `storage` for your local selection, `scripting` to read
Instagram when you click, and `downloads` to save the ZIP. Host access is limited
to Instagram and its image CDNs. Image URLs and reviewed metadata stay in Chrome's
local extension storage until cleared. No account passwords or login tokens are
read or stored by this tool.

## Weekly workflow

### 1. Choose posts from a profile

Open a profile in Chrome; log in normally if Instagram requires it:

| Profile | Default project |
| --- | --- |
| https://www.instagram.com/emilie_idea_embroideries/ | Embroideries |
| https://www.instagram.com/eco_zhonglaise/ | ScrapingBy |
| https://www.instagram.com/emilieidea_zugou/ | Artworks |

In the extension workspace, select the Instagram tab and click **Read Instagram
tab**. The workspace lists photo-post links already loaded on that profile. Click
**Open post** beside one you want. Once it has loaded in Instagram, return to the
workspace and click **Read Instagram tab** again to read that post.

This is a selection tool, not an automatic weekly scan. It does not know which
profile posts were already imported; the local importer skips existing images.
Pinned posts may appear first. To see more links, scroll the profile yourself and
read it again. You can also open an individual `/p/<shortcode>/` link directly.

### 2. Review and capture each image

Check the displayed photo, choose its project, and review:

- **Photo position in post**: `1` for a single photo; the original Instagram slide
  position for a carousel.
- **Total photos in post**: `1` for a single photo, or the full carousel count.
- **Full caption**: expand Instagram's caption first and compare it. Paste the
  complete caption if the extractor could not find it or it is incomplete. Empty
  captions are allowed when intentional. Instagram-generated image alt text is
  not used as a substitute for the caption.
- **Post date and time**: an ISO timestamp with a timezone, such as
  `2026-11-07T12:00:00Z`. Enter it manually if it is unavailable on the page.

If several candidate photos are listed, use **Visible photo** to select the one
that belongs at the current position. Tick the review confirmation, then click
**Add this image to export**.

For a carousel, switch back to Instagram, advance to the next photo, return to
this workspace, and read the tab again. Repeat for every photo. The extension
cannot see unloaded slides and does not automatically click through them.

The export requires all positions from `1` through the total you declared. It
rejects repeated positions and identical captured media at different positions.
It cannot independently prove the total or order: checking these against Instagram
is part of the review. Do not label a single carousel slide as a single-photo post.

Editing caption, category, date, or total while adding another slide updates the
queued metadata for that whole post. To correct an already captured image or its
position, click **Remove post** and capture that post again.

Version 1 supports photo-only posts. Reels, videos, and mixed photo/video carousels
are unsupported. If a video appears, skip the whole post. Supported downloads are
JPEG, PNG, and WebP, up to 25 MB and 40 megapixels per photo. A ZIP may contain at
most 200 photos and must be under 200 MB.

### 3. Download the ZIP

Click **Download ZIP** and save it as `instagram-export.zip`, for example in
Downloads. Keep the workspace open until the download completes. Media are fetched
only at this point, not when captured. Export soon because Instagram CDN URLs
expire. If a download returns an error or login page, remove and recapture the
post after reopening it; incomplete exports do not produce a ZIP.

The selection remains in Chrome after export, so you can retry. Clear it after a
successful local import when ready to start another batch. Downloaded ZIPs are
not affected by clearing the selection.

### 4. Import locally

From the repository root, first preview the changes:

```bash
npm run import:instagram -- ~/Downloads/instagram-export.zip --dry-run
```

Then import:

```bash
npm run import:instagram -- ~/Downloads/instagram-export.zip
npm run dev
```

The command reports imported and skipped **photos**, not just posts. It uses each
post's shortcode and original image position to recognise an existing photo across
all three projects, including renamed files and manually changed IDs. Existing
records are skipped entirely: captions, dates, categories, `publish`, IDs, and file
contents are not overwritten.

New images go to `src/assets/<project>/` and entries go to the matching
`src/data/<project>.json`. New entries are prepended newest first; existing entries
retain their order. Each new image receives its permanent ID immediately and
`publish: false`. Running the same import twice leaves site data and media unchanged
on the second run. There is no separate `assign:ids` step for these imports.

### 5. Review and publish

Check the new JSON entries and captions. To preview a new image in its gallery,
set its `publish` to `true` locally, then check `http://localhost:4321/` and the
matching project gallery. Unpublished records are hidden in development as well
as production. To keep an image hidden, leave or return its setting to `false`.

Run `npm run build`, then commit the selected project images and JSON changes and
push to `master` when ready. GitHub Actions rebuilds GitHub Pages. The new permanent
page will be at `/artwork/<id>/`. See [HowToUpload.md](../HowToUpload.md) for the
rest of the publishing workflow.

This is a public repository: `publish: false` hides an image from generated pages,
but committed files and metadata remain visible in Git. Keep private material out
of the repository. ZIPs should stay in Downloads or the ignored
`import_tool/exports/` folder; they are not needed by the site build.

## Failures and recovery

Validation failures leave project files unchanged. The importer checks ZIP paths,
CRC and SHA-256 checksums, complete declared carousels, duplicate identities, valid
metadata, and actual image decoding before writing. It refuses existing file
collisions, even for files not listed in JSON. Use `--dry-run` to investigate first.

A lock at `.import-tool.lock/` prevents simultaneous imports. Ordinary write errors
roll back changes and remove temporary files. An abrupt process or computer shutdown
can leave the lock and a `.import-tool-…/` staging directory. These are ignored by Git.

If an interrupted import left a lock:

1. Confirm no importer is still running. Do not delete another running import's lock.
2. Inspect `git diff -- src/data` and the affected image folders. Staging directories
   contain `<project>.original.json` backups for collections involved in the import.
3. If needed, restore those original JSON files and remove only media created by the
   interrupted import. Preserve unrelated local edits.
4. Remove the stale lock and staging directory after confirming the site data are
   consistent, then rerun a dry-run. Do not blindly reset the repository.

## Tests and live acceptance

```bash
npm run test:import
npm run test:artworks
npm run build
npm run test:artwork-build
```

Python 3 is required by the test suite's independent ZIP compatibility checks.
The importer itself requires Node.js and Sharp (installed by `npm ci`).

Automated tests cover profile/post DOM fixtures, caption review data, photo host
restrictions, carousel completion, ZIP export and interoperability, malformed
archives, real image decoding, unchanged duplicate imports, preserved manual edits,
no-op dry runs, collisions, and rollback after an injected write failure.

Before relying on this for weekly updates, perform this manual acceptance check:

1. Read one real profile and open one real single-photo post; confirm its preview,
   caption, category, and date in the workspace.
2. Capture one full photo carousel and compare every position and the total to
   Instagram. Confirm an incomplete selection cannot export.
3. Download a ZIP; dry-run, import, and repeat the import. The repeat should report
   zero new photos, with unchanged JSON and media.
4. Publish one new image locally and check its gallery, lightbox, caption, and
   permanent page. Leave the others unpublished.

## Export format and Chrome references

ZIPs contain `manifest.json` plus `images/instagram-<postId>-<index>.<extension>`.
The manifest uses `format: "emilieidea-instagram-export"`, `version: 1`, and a `posts`
array. Posts include `postId`, `postUrl`, `category`, `caption`, ISO `date`, declared
`imageCount`, and `images` with `imageIndex`, `path`, and lowercase SHA-256 `sha256`.
The exporter writes standard uncompressed ZIPs; the importer also accepts ordinary
DEFLATE entries. Encrypted, ZIP64, symlink, and unsafe-path archives are rejected.

Implementation references: Chrome's [local extension installation](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked),
[content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts),
[extension cross-origin requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests),
and [downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads).

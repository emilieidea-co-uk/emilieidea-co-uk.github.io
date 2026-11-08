# Instagram import tool

A local Chrome extension reads and previews the current Instagram photo without
moving its carousel. Capture each photo into a numbered draft, review the complete
post, then export a ZIP. Automatic collection remains an optional action.

The local importer adds new images with `publish: false`. Existing records, IDs,
captions, and publication settings are preserved. No Git push or publishing occurs.
The ZIP format and importer are unchanged by this update.

**Live verification is still required.** Regression tests cover the first-image
selection bug, but Instagram's real interface varies. Use the diagnostics below
if reading photo 2 still returns photo 1.

## Install locally in Chrome

Use Chrome 116 or newer.

1. Run `npm ci` in the repository root, using Node.js 22.12 or newer.
2. Open `chrome://extensions/` in Chrome and enable **Developer mode**.
3. Click **Load unpacked** and choose this folder:
   `astro_photo/import_tool/extension/` (not the repository root).
4. Pin **EmilieIdea Instagram Import** from Chrome's Extensions menu.
5. Click its toolbar icon. The capture workspace opens in a normal tab and stays
   open while you move between Instagram posts. It needs no Chrome Web Store upload.

After updating, click **Reload** on the extension's card at
`chrome://extensions/`, then reload both the Instagram tab and tool workspace.
The new extension version is **0.3.0**. The workspace Console should show
`[EmilieIdea Import] workspace-start` with `workflow: manual-first`; reader reports
show `readerVersion: 0.3.0-reader-1`. Older injected automatic scanners are refused
with an explicit reload message, rather than silently reused.

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

In the extension workspace, select the Instagram tab and click **Read current photo / profile**. The workspace lists photo-post links already loaded on that
profile. Click
**Open post** beside one you want. Once it has loaded in Instagram, return to the
workspace and click **Read current photo / profile** again to preview its current photo.

This is a selection tool, not an automatic weekly scan. It does not know which
profile posts were already imported; the local importer skips existing images.
Pinned posts may appear first. To see more links, scroll the profile yourself and
read it again. You can also open an individual `/p/<shortcode>/` link directly.

### 2. Read and capture photos one by one

1. Open photo 1 of the post in Instagram. Keep the image visible in that tab.
2. Return to the workspace and click **Read current photo / profile**. This does
   not click arrows, change slides, or bring another tab to the front.
3. Check the large preview. If several candidates are ambiguous, choose the
   thumbnail matching the photo currently displayed in Instagram. No photo is
   captured automatically.
4. Check **Photo position in Instagram** and **Total photos in this post**. The
   reader fills reliable detected values. Otherwise enter them yourself; an
   unknown total is not assumed to be 1. A single-photo post uses position 1 and
   total 1. Keep original slide positions even when reading out of order.
5. Click **Capture this photo**. It appears in the numbered draft grid.
6. Click Instagram's next arrow yourself, return here, and read again. Confirm
   the preview changed before capturing position 2, then repeat for the rest.

The reader uses clipping, active-slide markers, and paint order to distinguish
retained or overlapping images. It treats `currentSrc` as the displayed asset; a
larger `srcset` image is used only when it matches that same asset. If the preview
is wrong, do not capture it. Use diagnostics below rather than assigning the same
photo another position.

Repeated image assets and repeated positions are rejected. Use **Remove photo N**
to correct a draft capture, then read and capture that original position again.
Removing a photo leaves a gap; it does not renumber the remaining photos. Reading
the same post retains captured images and your caption/date/category edits.
Switching posts asks before discarding a draft with captured images. Saved export
queue entries are kept.

After all positions have been captured, review **Project**, **Full caption**, and
**Post date and time**. Paste the full caption if extraction missed it; an empty
caption is allowed when intentional. Dates use ISO format including a timezone,
for example `2026-11-08T12:00:00Z`. Tick the complete-post review confirmation and
click **Add post to export**. Missing positions prevent this action. Replacing an
already queued post requires confirmation.

The queue also shows numbered thumbnails. Existing complete selections remain
exportable; incomplete older entries need their missing photos recaptured. If an
old manually declared total was incorrect, collect and review that post again.

#### Optional automatic collection

**Automatic collection (optional)** is a separate action. It rewinds the open
post and advances its carousel, with Cancel and Retry controls. It can replace an
existing manual draft only after confirmation. The default Read action never
starts an automatic scan. Keep using manual capture until your Instagram layout
has been verified. Unsupported controls, missing boundaries, or failed transitions
leave an incomplete result that cannot be added to the queue.

Only complete photo-only posts are supported; reels and mixed photo/video posts
are unsupported. A post may contain at most 100 photos. ZIP limits remain 200
photos, 200 MB overall, and 25 MB / 40 megapixels per JPEG, PNG, or WebP image.

## Console diagnostics

Logs are enabled by default at Info, Warning, and Error levels. Filter for
`EmilieIdea Import` to find this tool's messages among Instagram's own output.

**Tool workspace console:** while on the extension's workspace tab, right-click
an empty area, choose **Inspect**, then select **Console**. On Mac you can also
press **Command+Option+J**; on Windows use **Ctrl+Shift+J**. This console mirrors
photo-read reports, selection reasons, actions, and caught errors.

**Instagram console:** open DevTools on the actual Instagram tab and select
**Console**. Reader and scanner messages appear there too. Ensure Info, Warnings,
and Errors are enabled in the Console's level filter; clear any unrelated text
filter. The workspace mirror is useful if Instagram's selected-context filter
hides extension content-script messages.

Click **Log current photo diagnostics** to inspect without capturing or advancing.
Reports include tool/helper versions, source tab, post ID, detected position/count,
candidate sizes, rectangles, clipping, active markers, paint votes, asset paths,
and selection/rejection reasons. Errors include their stack traces. Reports omit
credentials, cookies, and signed CDN query strings.

Click **Copy diagnostics** to copy the most recent report. If clipboard permission
is unavailable, a text box opens for selecting and copying it manually.

To diagnose the first-image problem:

1. Read or log diagnostics on photo 1 and save the report.
2. Click Instagram's next arrow, wait for photo 2 to load, and read/log again.
3. Check that the large preview and selected asset change. If not, copy the second
   report and describe which photo Instagram shows. Also include the first report
   if possible. The report makes it possible to inspect the actual DOM selection
   without guessing or silently capturing photo 1 repeatedly.

### 3. Download the ZIP

Click **Download ZIP** and save it as `instagram-export.zip`, for example in
Downloads. Keep the workspace open until the download completes. Full media bytes
for the ZIP are downloaded at this point; the scan itself loads carousel images
and thumbnail previews in Chrome. Export soon because Instagram CDN URLs expire. If a download returns an error or login page, reopen and recapture the
post, then confirm replacement; incomplete exports do not produce a ZIP.

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

Automated tests cover retained first-image nodes, overlapping slides, active
markers, stale `srcset`, displayed `currentSrc`, ambiguous candidate selection,
manual capture order, duplicate rejection, removal/recapture, missing positions,
metadata retention, post switching, mirrored diagnostic errors, and clipboard
fallback. Automatic scanning, ZIP validation, real decoding, unchanged repeat
imports, dry runs, collisions, and rollback remain covered.

Before relying on this for weekly updates, perform this manual acceptance check:

1. Read a real profile, open one single-photo post, read its current photo,
   confirm its preview and metadata, and capture position 1 with total 1.
2. On a real multi-image post, read photo 1, click Instagram's Next manually,
   and read photo 2. Verify that preview and asset change, then capture the
   remaining positions. Capture errors should be visible in the workspace Console.
3. Attempt a duplicate capture and a post with a missing position. Neither should
   create a complete export entry. Correct a capture with Remove, then recapture.
4. Export, dry-run, import, and repeat the import. The repeat should add zero
   photos. Publish one image locally and check its gallery and permanent page.

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

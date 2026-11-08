# EmilieIdea v1.1 — Instagram short-video support

**Target release: v1.1**

**Status: Proposed — not implemented.**

This document describes future work. The current import tool and website remain
photo-only. Nothing in this proposal enables video capture or publishing yet.

## Goal

Extend the [Chrome import tool](../import_tool/README.md) so a post can contain
photos, short videos, or both. Review video in the extension, export it with the
post, and eventually play it on the website without changing existing photo IDs
or shared links.

## Two ways to attach a video

### Capture a downloadable Instagram MP4

1. Open the intended post and display its video slide in Instagram.
2. Click **Read current media** in the extension.
3. Detect the displayed video using the same visibility and selection diagnostics
   used for photos. Read its available source, duration, dimensions, and poster.
4. If a directly downloadable MP4 is available, show a video preview with native
   playback controls. Download and verify the actual file before accepting it.
5. Confirm its original position and the total media count for the post, then
   capture it into the draft.

Do not treat a video poster as the video itself. A `blob:` URL, adaptive stream,
missing source, or expired download must produce a clear explanation and offer
the local-file alternative. Do not reconstruct streams or use private Instagram
APIs to obtain unavailable files.

### Choose an MP4 from the computer

1. Open or select the Instagram post being collected.
2. Click **Choose local MP4** and select a file.
3. Show a playable preview, filename, duration, dimensions, and size.
4. Confirm the post position and total, then attach the file at that position.

The local file belongs to the selected post; it must not create an unrelated post
or change its source URL. Reading another slide must preserve attached files and
reviewed metadata. Replacing or removing a captured item requires an explicit
user action and must preserve the positions of remaining items.

## Extension storage and review

- Keep the manual capture workflow as the default. A captured item records whether
  it is an image or video, alongside its original post position.
- Show image thumbnails and video posters together in a numbered grid. Mark video
  items with a Play indicator and show their duration.
- Preview videos with native controls and no autoplay. Stop playback when changing
  previews or leaving the current draft.
- Store attached file bytes in extension **IndexedDB**, linked to the post and
  position. Do not store video bytes in ordinary settings storage or rely on an
  object URL surviving a workspace reload.
- Use temporary object URLs only for previews, revoke them when no longer needed,
  and recreate them from IndexedDB when reopening the workspace.
- Persist files before reporting capture success. Preserve the existing draft if
  storage fails; explain the error through the status area and console diagnostics.
- Remove file records when their draft or queued item is explicitly removed. Keep
  queued files available after export so the user can retry a download.
- Require a complete set of original positions and the existing whole-post review
  confirmation before allowing export. Photos and videos share one ordered count.

## Export format and compatibility

Introduce a versioned mixed-media ZIP format when implementation begins. Specify
its exact schema and fixtures before changing the exporter or importer.

The new format must include media type, original position, file path, SHA-256
checksum, and video metadata. Include poster information where available. File
paths must remain deterministic and pass the existing archive safety checks.

The updated importer must continue accepting existing version-1 photo ZIPs. Existing
photo records, publication settings, categories, captions, dates, and permanent IDs
must remain unchanged. Preserve the current post-ID/position identity convention;
do not renumber media or generate new IDs merely because a post contains video.

Extend the current data model compatibly: old entries without a media type continue
to mean images. Version-2 exports must never be silently interpreted as photo-only
version-1 exports. Older importers should reject them with a clear unsupported-format
message.

## Local validation and preparation

Use **FFprobe** to inspect actual streams and **FFmpeg** to prepare website-ready
video and generate a poster image. These are future importer requirements, not
dependencies introduced by this documentation change.

- Check that the file contains a valid video stream, not just an MP4 extension.
- Verify duration, dimensions, size, and checksums before changing project data.
- Prepare MP4 with H.264 video, a compatible pixel format, AAC audio when present,
  and fast-start metadata for progressive playback. Preserve aspect ratio and
  account for rotation metadata.
- Generate a poster suitable for gallery covers and image-based social previews.
- Handle silent clips without requiring an audio stream.
- Stage prepared output before merging, preserve existing records, and retain
  duplicate detection, dry runs, collision protection, and rollback behaviour.
- Default newly imported videos to `publish: false`.
- Keep FFmpeg preparation local so routine site deployment does not need to encode
  video again. Do not add unrelated original video files to the published output.

**Proposed initial limits:** 60 seconds and 25 MB per clip. Confirm these before
implementation and define whether they apply to both input and prepared output.
Keep the existing overall ZIP size limit unless a separate change is approved.
Do not silently trim an overlong clip.

## Website playback

Website support is a separate required stage before imported videos can be
published:

- Extend grouped posts and artwork pages to render images and videos in the same
  original order. Retain one gallery cover per post.
- Use a poster and Play indicator for video covers. Keep image-based social
  previews for shared video links.
- Use native video controls, `playsinline`, and metadata-only preloading. Do not
  autoplay or start audio automatically.
- Pause video when changing a slide, changing posts, or closing the lightbox.
  Ensure inactive players do not continue downloading or playing in the background.
- Keep video controls usable: carousel keyboard and swipe handlers must not steal
  seeking, volume, or playback interactions.
- Preserve caption expansion, keyboard focus handling, Copy Link, themes, and
  existing image routes. Video links must use their own stable media ID.
- Decide published-file placement and serving before implementation. Hidden items
  must not appear in galleries or generated artwork pages; document that files
  committed to a public repository are not private.

## Development stages

### Stage 1 — Capture and file attachment

- [ ] Verify a real Instagram video exposing a direct MP4.
- [ ] Investigate standalone video/Reels routes separately from existing photo-post
      routes; confirm metadata, canonical URLs, and selection behaviour before
      claiming Reels support.
- [ ] Add read-only video detection and diagnostic reports.
- [ ] Add local MP4 selection and IndexedDB persistence.
- [ ] Add video previews and mixed-media draft review.
- [ ] Confirm clip limits and how local files map to post positions.

### Stage 2 — ZIP and importer

- [ ] Define the versioned format and backward-compatibility fixtures.
- [ ] Export video bytes, metadata, checksums, and poster information.
- [ ] Validate and prepare video with FFprobe/FFmpeg.
- [ ] Extend project data without changing existing photo IDs or manual edits.
- [ ] Verify dry runs, repeated imports, failure cleanup, and rollback.

### Stage 3 — Website playback and release

- [ ] Add mixed-media rendering to galleries, artwork pages, and lightboxes.
- [ ] Add poster-based previews and stable video sharing links.
- [ ] Verify playback, pause-on-navigation, and native-control interaction.
- [ ] Test on the iPhone 7 Plus and current desktop Chrome/Safari.
- [ ] Update the import-tool guide and beginner publishing guide after the workflow
      has been verified live.

## Acceptance tests

Test direct MP4 capture, local MP4 attachment, a silent clip, and a post mixing
photos and videos. Verify the correct slide is captured when earlier slides remain
in Instagram's DOM.

Test missing or expired sources, `blob:` sources, adaptive streams, invalid files,
oversized files, excessive duration, unavailable FFmpeg, and storage failures. Each
failure must leave existing selections and project data intact.

Close and reopen the extension workspace: attached files and post positions must
survive. Check that removing or replacing a file does not renumber other items or
leave obsolete files indefinitely.

Export and import a mixed post twice. The second import must add nothing and
preserve manual edits. Existing photo-only ZIPs, galleries, IDs, and shared URLs
must still work.

Check poster covers, video-only posts, mixed carousels, lightbox close/navigation,
native controls, caption expansion, sharing, and iPhone inline playback. Inspect
the generated static site to verify video and poster references resolve.

## Implementation boundaries

This proposal does not authorise or perform implementation, installation,
deployment, publishing, or changes to existing artwork data. It adds no backend,
paid video service, automatic login, private API integration, or stream downloader.
Live Instagram extraction and Reels feasibility must be verified rather than
inferred from fixture tests alone.

Existing project references: [developer README](../README.md),
[import-tool guide](../import_tool/README.md), and
[beginner content guide](../HowToUpload.md).

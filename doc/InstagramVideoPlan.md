# EmilieIdea v1.1 — Instagram videos with YouTube/Vimeo playback

youtube account required.

## Target release: v1.1

**Status: Proposed — not implemented.**

This document describes future work only. The current import tool and website
remain photo-only; this proposal does not enable video capture or playback.

## Goal

YouTube and Vimeo are both suitable for short videos, including artwork studies,
creative processes, and animations lasting just 10–30 seconds.

For EmilieIdea v1.1, **Instagram remains the source; YouTube or Vimeo becomes the
playback host**. The extension helps acquire a clip and attach its hosted URL to
an existing post. The website embeds the player instead of serving video files
from GitHub Pages. Preserve existing photos, permanent IDs, and shared links.

## Planned workflow

```text
Instagram clip or original/local MP4
    → Save the MP4 on the computer
    → Upload manually to YouTube or Vimeo
    → Paste the hosted URL into the extension
    → Attach it to the original post position and choose a cover
    → Review and export the post
    → Import as unpublished, then review and publish
```

### 1. Acquire the video

Display the intended video slide in Instagram. The extension should identify the
current media using the same visibility checks and diagnostic reporting as photo
capture. It must not mistake a poster image for the video itself.

When Instagram exposes a directly downloadable MP4, offer **Download MP4** and
verify the downloaded content. Save it through Chrome's normal download flow.
The file is for uploading to the chosen video host, not for committing to GitHub.

When no downloadable MP4 is available, explain the limitation and offer the
original/local MP4 workflow. A `blob:` URL or adaptive stream does not guarantee
that the extension can obtain a complete MP4. Do not reconstruct streams or use
private Instagram APIs. A local file is a fallback the user supplies, not a claim
that the extension can download every Instagram video.

If local preview is offered, let the user select the MP4 and preview it with
native controls. Keep that preview temporary: revoke object URLs when finished
and ask the user to choose the file again after reopening the workspace. The
original file stays on the computer; persistent video storage in the extension
is deferred.

Investigate standalone video/Reels routes separately from carousel posts. Verify
source selection, captions, dates, and canonical URLs live before claiming Reels
capture support.

### 2. Upload manually to YouTube or Vimeo

The user uploads the saved or original clip through the provider's website.
There is no automatic upload, account connection, or provider credential storage
in v1.1.

YouTube is the suggested starting option; Vimeo remains supported as an
alternative. YouTube Unlisted videos can be viewed and reshared by anyone with
the link, so unlisted does not mean private. Vimeo embedding and customisation
options depend on the account plan and video settings. Neither provider should
be described as guaranteeing an unbranded or ad-free experience on every plan.

Embedding must be enabled and the video must be viewable by the intended audience.
The user retains the source file independently of its hosted copy.

### 3. Attach the hosted reference in the extension

Add a **Video URL** workflow alongside photo capture:

- Accept supported YouTube/Vimeo URLs and identify the provider and video ID.
  Validate the URL rather than accepting arbitrary iframe HTML.
- Preserve any provider-specific URL information required for an embeddable link;
  do not accidentally discard a Vimeo unlisted video's access hash.
- Associate the reference with the Instagram post ID and original media position.
  Hosted URL changes must not create a new artwork identity.
- Require a local cover image, chosen from an appropriate captured poster/photo
  or an uploaded image. Do not depend on remote thumbnails for initial page load.
- Show photos and video cover images together in a numbered draft grid. Mark video
  items with a Play indicator. An optional provider preview loads only when clicked.
- Retain the post's reviewed caption, date, category, and existing photo captures.
  Require explicit actions to replace or remove an item, without renumbering others.
- Keep complete-post review and duplicate checks before export. One mixed post
  has one ordered media count, including both photos and video references.

An Instagram source link and a hosted playback link serve different purposes:
retain the original Instagram URL for attribution/source navigation, and use the
YouTube/Vimeo URL for playback.

### 4. Export and import

Define a versioned ZIP format and compatibility fixtures before implementing it.
The new format carries video references and local cover images, **not video
binaries**. Existing photo files continue to travel through the ZIP as before.

Hosted-video metadata needs media type, provider, validated playback reference,
original position, cover-image path/checksum, and the post's reviewed metadata.
Specify the exact schema, filenames, and validation rules at implementation time.
Keep local machine paths and temporary object URLs out of exported records.

The importer must:

- Continue accepting version-1 photo ZIPs unchanged.
- Validate provider references, cover-image files, paths, and checksums before
  changing project data.
- Preserve existing IDs, captions, dates, categories, publication settings, and
  media positions. Entries without a media type continue to mean images.
- Keep the current post-ID/position identity convention for new video records.
  Changing the host must not change the media's permanent page URL.
- Default new records to `publish: false`, including video references.
- Retain dry runs, duplicate detection, collision protection, and rollback.

Older importers must reject unsupported format versions clearly rather than
silently interpreting video references as photo files.

## Website playback

Extend the current grouped galleries, artwork pages, and lightbox for video-only
posts and mixed photo/video carousels. Keep original media order and one gallery
cover per post.

Use the local cover image with a Play button. Do not load the provider iframe,
provider API scripts, or remote video thumbnail until the visitor interacts.
Loading the player should not also force playback; leave autoplay disabled and
let the visitor use the provider's controls.

- Support responsive portrait and landscape layouts, fullscreen where available,
  and inline playback on iPhone.
- Use YouTube's privacy-enhanced embed domain. Treat it as a provider option, not
  a guarantee that no data is exchanged once the player loads.
- Remove the active iframe when changing slides/posts or closing the lightbox,
  restoring its poster. This stops playback without needing provider APIs solely
  for pause control.
- Do not let carousel keyboard or swipe handling steal interactions with player
  controls. Preserve focus containment, Escape handling outside the iframe, and
  an accessible Close control; focus inside cross-origin players requires manual
  browser verification.
- Keep caption expansion, themes, Copy Link, and existing photo routes working.
  Copy Link uses the selected media's EmilieIdea URL, not the provider URL.
- Use the local cover for the media page's social preview. Existing image-specific
  metadata and shared links remain valid.
- Always provide **Watch on YouTube →** or **Watch on Vimeo →** as an alternative
  when the video is private, removed, blocked, or cannot be embedded. Do not promise
  detection of every cross-origin player error; keep the external link available.
- Exclude unpublished records from galleries and generated artwork pages.
- Update the site's privacy notice when hosted playback is implemented, describing
  click-to-load embeds and linking the providers' privacy information.

## Deferred work

The following items are outside the v1.1 hosted-playback approach:

- Hosting and playing raw MP4 files directly from GitHub Pages.
- Persistent MP4/Blob storage in extension IndexedDB.
- FFmpeg/FFprobe preparation and local encoding/poster generation pipelines.
- Video binaries inside the website import ZIP or public repository.
- Automatic uploads to YouTube/Vimeo, OAuth flows, or stored provider credentials.
- Adaptive-stream reconstruction and private Instagram API integrations.

The earlier proposed 60-second/25-MB limits are not requirements of hosted
playback. Confirm practical limits for any optional MP4 acquisition/preview before
implementing it. Existing image and ZIP limits remain unchanged unless explicitly
revised. Never silently trim a clip.

## Development stages

### Stage 1 — Acquisition and manual provider upload

- [ ] Verify a real Instagram clip exposing a directly downloadable MP4.
- [ ] Investigate standalone video/Reels selection and metadata separately.
- [ ] Add read-only video detection, diagnostics, and Download MP4 when available.
- [ ] Document the original/local MP4 fallback and optional temporary preview.
- [ ] Confirm acquisition limits and clear unsupported-source errors.
- [ ] Document manual YouTube/Vimeo upload and embedding visibility settings.

### Stage 2 — Hosted URL, cover, and import

- [ ] Add validated YouTube/Vimeo URL attachment at an original post position.
- [ ] Add local cover selection and mixed-media draft review.
- [ ] Specify the versioned export/data schema and photo-compatibility fixtures.
- [ ] Export references and covers without MP4 binaries.
- [ ] Extend importer validation and unpublished-record creation.
- [ ] Verify unchanged repeat imports, manual edits, IDs, dry runs, and rollback.

### Stage 3 — Embedded playback and release

- [ ] Add poster-first, click-to-load video slides and provider viewing links.
- [ ] Preserve ordering, captions, themes, sharing, and photo layouts.
- [ ] Stop playback by removing inactive iframe players.
- [ ] Test focus, controls, fullscreen, and iPhone inline behaviour.
- [ ] Update the privacy notice and maintenance guides for the implemented workflow.
- [ ] Complete live acceptance before claiming v1.1 video support.

## Acceptance tests

Test direct MP4 availability, an expired or inaccessible source, `blob:`/streaming
sources, and the local-file fallback. Verify that selection follows the displayed
slide rather than an earlier retained DOM node. Confirm there is no hidden private
API request or automatic provider upload.

Test valid and invalid provider URLs, supported sharing URL variants, Vimeo access
hash preservation, local cover selection, duplicate positions, gaps, replacement,
and mixed-post ordering. Capturing a video reference must preserve reviewed text
and existing photo records.

Export/import a mixed post twice: the second import must add nothing. Confirm the
ZIP contains references and cover/photo images but no MP4 files or local paths.
Verify old photo ZIPs and every existing photo ID and shared URL still work.

Check that initial pages load local posters without provider requests, and only
clicking loads a player. Test playback controls, slide changes, lightbox close,
external viewing links, disabled embedding, private/removed videos, and offline or
blocked providers. Verify playback stops after navigating away.

Test the iPhone 7 Plus and current desktop Chrome/Safari, including portrait clips,
keyboard focus, provider controls, fullscreen transitions, captions, and social
previews. Inspect the generated static site for valid covers and media links.

## Boundaries and references

This proposal adds no implementation, dependencies, credentials, artwork records,
or deployment. Keep all stages incomplete until implemented and verified. The
current website remains v1.0 and photo-only.

Project guides: [developer README](../README.md),
[import-tool guide](../import_tool/README.md), and
[beginner content guide](../HowToUpload.md).

Provider references (reviewed 8 November 2026):

- [Upload YouTube videos](https://support.google.com/youtube/answer/57407?hl=en)
- [YouTube visibility settings](https://support.google.com/youtube/answer/157177?hl=en)
- [YouTube embeds and privacy-enhanced mode](https://support.google.com/youtube/answer/171780?hl=en)
- [Vimeo embedding features by plan](https://help.vimeo.com/hc/en-us/articles/12426275096337-Embedding-features-by-plan-type)
- [Vimeo privacy settings and unlisted URLs](https://help.vimeo.com/hc/en-us/articles/12426199699985-About-video-privacy-settings)

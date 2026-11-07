# Updating EmilieIdea

Use this guide to add project images and descriptions, write blog posts, and edit
pages. All paths below are relative to the repository root.

## Import selected Instagram posts

For Instagram photos and captions, follow the [import tool guide](import_tool/README.md).
Load its extension in Chrome, start from a profile or post, review each selected
photo, and download a ZIP. Then preview and import it from the repository root:

```bash
npm run import:instagram -- ~/Downloads/instagram-export.zip --dry-run
npm run import:instagram -- ~/Downloads/instagram-export.zip
```

New entries have permanent IDs and `publish: false`. Set reviewed entries to
`publish: true` to see them locally and include them in the next deployment.
Existing records and manually edited captions are preserved. See the guide's live
acceptance check before relying on Instagram extraction.

The manual image workflow below and optional CSV importer remain available.

## Add images and descriptions

### 1. Choose a project and copy the image

| Gallery | Copy images here | Edit descriptions here | Page |
| --- | --- | --- | --- |
| Artworks | `src/assets/artworks/` | `src/data/artworks.json` | `/` |
| ScrapingBy | `src/assets/scrapingby/` | `src/data/scrapingby.json` | `/scrapingby/` |
| Embroideries | `src/assets/embroideries/` | `src/data/embroideries.json` | `/embroideries/` |

Copy selected images into the matching folder. Supported formats are JPG, JPEG,
PNG, WebP, and AVIF. Use a unique, descriptive filename such as `blue-clay-pot.jpg`.
Place gallery images directly in the collection folder, without subfolders.

The `ei_original_1_em`, `ei_original_2_sc`, and `ei_original_3_ar` folders are local
archives. They are excluded from Git; copy your chosen files into the project
folders above to include them on the website.

### 2. Add an entry to the description file

Open the matching JSON file and add an object inside its existing `[...]` array.
For example, after copying `blue-clay-pot.jpg` to `src/assets/artworks/`:

```json
{
  "file": "blue-clay-pot.jpg",
  "publish": true,
  "caption": "A small blue clay pot, hand formed and glazed in my studio.",
  "date": "2026-11-07T12:00:00Z",
  "postUrl": ""
}
```

- `file`: the exact filename, including its extension and capitalisation.
- `publish`: `true` shows the image; `false` hides it from galleries and blog
  components that reuse project images. Use booleans, without quotation marks.
- `caption`: the description. Galleries display three lines with an ellipsis
  when needed; the lightbox shows the full caption.
- `date`: the post date in UTC, using the format above (`Z` means UTC).
- `postUrl`: the original Instagram post URL, or `""` if there is none.

After adding an image, run:

```bash
npm run assign:ids
```

This saves a permanent `id`, Instagram `postId`, and carousel `imageIndex` for
new entries. For an image without an Instagram URL, it saves a generated ID
and `postId: null`. Keep these fields unchanged after they have been assigned,
even when editing captions or renaming files. Include the updated JSON when
committing your changes. Existing entries keep their IDs on repeated runs.

Separate objects with commas, but do not put a comma after the last object.
JSON strings use double quotes. Write `\"` for a quotation mark inside a caption
and `\n` for a line break.

Copying an image alone does not make it appear: it must also be listed in the
JSON file. The array order controls gallery order, so move an entry to the top
to show it first. Changing the date alone does not reorder the gallery.

### 3. Update or hide an existing image

Find its `file` entry and edit the caption, or set `publish` to `false`. There is
no need to delete the image to hide it. Each published image has a page at
`/artwork/<id>/`; use **Copy Link** in its lightbox to share it. Hiding an image
also removes that page from the next build and from the sitemap. If you rename
a file, update its JSON entry and any blog references to the same filename.

Hiding an image does not remove it from the public repository or its history.
For permanent removal, check blog references before removing its entry and file.

### Optional: refresh descriptions from a CSV export

Manual editing above is enough for ordinary updates. The importer is useful when
you already have an Instagram CSV export and its downloaded images locally.
Python 3 is required. Run commands from the repository root.

For example, to refresh the existing Artworks selection:

```bash
python3 scripts/import-embroideries.py --collection artworks \
  --selection src/data/artworks.json
```

Despite its filename, the script supports all three collections. Replace
`artworks` with `scrapingby` or `embroideries` and use its matching JSON file.
It uses the default CSV in that collection's original archive; override it with
`--csv path/to/export.csv`. The downloaded images must be beside that CSV, with
their original exported filenames.

The selection JSON chooses which filenames to import. Without `--selection`,
the script reuses the existing collection's entries. For an existing gallery,
`--limit 50` checks that the selection contains exactly 50 images; it does not
choose 50 new images.

The importer copies selected images, replaces captions, dates, and post URLs
with CSV values, preserves existing `publish` settings and permanent IDs by
filename, and sorts the selection newest first, then by carousel sequence. Save any manually edited
captions before importing if you want to keep them. Original archives are not
included in a fresh clone.

## Edit the blog

### Create or edit a post

Posts are in [src/content/blog/](src/content/blog/). Edit an existing file or
create a `.md` file for text, or `.mdx` for text with image components.

For example, `a-new-piece.mdx` becomes `/blog/a-new-piece/`. Start with:

```mdx
---
title: 'A new piece'
description: 'Notes on the materials and process.'
pubDate: 2026-11-07
tags: ['artworks', 'process']
draft: true
---

Write your introduction here.

## Materials and process

Write about the work, its materials, and how it developed.
```

Keep the `---` lines: they separate the post settings from its content.
`title`, `description`, and `pubDate` are required. Posts appear newest first by
`pubDate`. A post with `draft: true` is visible locally during development but
excluded from the production site. Set it to `false` when ready to publish.

Use `**bold**`, `*italics*`, and `[link text](https://example.com)` in the body.
To remove a post, delete its file and remove any links to it elsewhere.

### Add images to a post

In an `.mdx` post, add these imports immediately after its frontmatter:

```mdx
import Photo from '../../components/Photo.astro';
import Gallery from '../../components/Gallery.astro';
```

Reuse a project image with its exact filename and collection. This example
assumes you added the example image above:

```mdx
<Photo
  collection="artworks"
  src="blue-clay-pot.jpg"
  alt="A small blue glazed clay pot"
/>
```

`Photo` displays one full-width image. Its caption defaults to the project's
caption; add `caption="A different caption for this post"` to override it.

For two columns, use the existing `Gallery` component. Replace these example
filenames with two real published images from the chosen collection:

```mdx
<Gallery collection="artworks" photos={[
  { src: "blue-clay-pot.jpg", alt: "A small blue glazed clay pot" },
  { src: "carved-print.jpg", alt: "A botanical lino print" }
]} />
```

The grid becomes one column on phones. Both components open images in the
lightbox and respect `publish: false` in the project's JSON file. A referenced
filename must still have an entry in that file.

For an image used only in a blog post, copy it to `src/assets/blog/` and omit
`collection`:

```mdx
<Photo src="studio-table.jpg" alt="Materials on my studio table" caption="Work in progress" />
```

See the [existing post](src/content/blog/a-line-through-thread-clay-and-print.mdx)
for working examples using all three projects.

## Edit pages

| What to change | File |
| --- | --- |
| About text | [src/pages/about.astro](src/pages/about.astro) |
| Contact text and displayed handles | [src/pages/contact.astro](src/pages/contact.astro) |
| Site name, navigation, social URLs | [src/config.ts](src/config.ts) |
| Privacy policy | [src/pages/privacy.astro](src/pages/privacy.astro) |
| Artwork & Image Use | [src/pages/license.astro](src/pages/license.astro) |
| Artworks home page introduction | [src/pages/index.astro](src/pages/index.astro) |
| ScrapingBy introduction | [src/pages/scrapingby.astro](src/pages/scrapingby.astro) |
| Embroideries introduction | [src/pages/embroideries.astro](src/pages/embroideries.astro) |

These pages use Astro and HTML. Edit the text inside `<h1>`, `<p>`, and other
elements, preserving their opening and closing tags. Update the page's
`description` too when the subject changes. Page titles and share previews for individual artwork pages come from the
image caption; the category and permanent ID are used when it is empty.

Gallery images and captions belong
in the JSON files, rather than the page files.

## Preview and publish

1. Run `npm run dev` and open **http://localhost:4321/**. Check the affected
   gallery or blog post, including its captions and lightbox. For phone testing,
   use Astro's printed Network URL while connected to the same Wi-Fi.
2. Run `npm run build` to check the production build. To view it, run
   `npm run preview -- --port 4322` and open **http://localhost:4322/**.
   Draft posts are excluded from this preview.
3. Commit the selected images, JSON changes, posts, and pages, then push to
   `master`. Local edits alone do not update GitHub Pages.
4. Wait for **Deploy to GitHub Pages** in the repository's
   [Actions tab](https://github.com/emilieidea-co-uk/emilieidea-co-uk.github.io/actions)
   to finish, then check **https://emilieidea-co-uk.github.io/**.

The build creates responsive WebP images automatically. Do not commit `dist/`
or the original archive folders. See [README.md](README.md) for initial setup
and deployment settings.

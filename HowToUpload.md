# How to update the EmilieIdea website

This guide is for the person adding artwork and writing, even if you have never
edited a website before. You can use GitHub in your browser; you do not need to
install software or type commands.

The website does not have a separate upload form. Its pictures and text are saved
in a project on GitHub. You will upload pictures and copy a small text template
for their descriptions. There is also a guide below for blog posts and page text.

## Before you start

1. Sign in to GitHub with an account that can edit this project.
2. Open the [EmilieIdea project](https://github.com/emilieidea-co-uk/emilieidea-co-uk.github.io).
3. Check that the branch selector above the files says **master**. This is the
   version that publishes the website.

A path such as `src/assets/artworks/` means open the **src** folder, then
**assets**, then **artworks**. You can click folder names in GitHub to get there.

**Saving on GitHub:** the button **Commit changes…** means “save these changes.”
Give the save a short name, such as “Add blue pot,” choose to save directly to
**master**, and confirm. Upload screens may show the save controls below the files.
If GitHub only offers **Propose changes**, ask the person managing the project to
help finish the change before expecting it to appear online.

Saves to master automatically start a website update. After each finished update,
follow [Check your changes online](#check-your-changes-online) below.

## Add images and descriptions

### 1. Choose where the image belongs

| Project | Upload pictures into this folder | Descriptions are in this file |
| --- | --- | --- |
| Artworks | [src/assets/artworks/](src/assets/artworks/) | [artworks.json](src/data/artworks.json) |
| ScrapingBy | [src/assets/scrapingby/](src/assets/scrapingby/) | [scrapingby.json](src/data/scrapingby.json) |
| Embroideries | [src/assets/embroideries/](src/assets/embroideries/) | [embroideries.json](src/data/embroideries.json) |

The files ending in `.json` are text lists that connect each picture to its
caption. Each picture needs both an uploaded file and a description in the list.

### 2. Upload the picture

1. Choose a JPG, JPEG, PNG, WebP, or AVIF picture on your computer. JPG is a simple
   choice. For browser uploads, keep each file below 25 MB.
2. Give it a clear filename that has never been used in that project, such as
   `blue-clay-pot.jpg`. Lowercase letters, numbers, and hyphens are easiest.
3. Open the project's picture folder from the table above.
4. Click **Add file → Upload files**, choose the picture, and save the change.
   Upload the picture directly into that folder, without an extra folder around it.

The picture will not appear in the gallery yet. Next, add its description.

### 3. Add its description

Open the matching description file from the table, then click the **pencil**
button to edit it. Keep the existing entries.

Find the first line containing `[` and paste the following immediately below it.
The comma after the final `}` separates this new entry from the existing entries
that follow it:

```json
  {
    "id": "image-blue-clay-pot-2026-11-07",
    "postId": null,
    "imageIndex": 1,
    "file": "blue-clay-pot.jpg",
    "publish": true,
    "caption": "A small blue clay pot, hand formed and glazed in my studio.",
    "date": "2026-11-07T12:00:00Z",
    "postUrl": ""
  },
```

Change these parts for your picture:

| Part | What to enter |
| --- | --- |
| `id` | A permanent label unique across all three projects. For a new manually added picture, use `image-`, its filename without `.jpg`, and the date; for example `image-green-bowl-2026-11-08`. Use letters, numbers, and hyphens, with no spaces. Never change this label after publishing. |
| `file` | The uploaded filename, including `.jpg` or its other ending. Spelling and capital letters must match exactly. |
| `caption` | Your description of the work. Keep the double quotation marks around it. |
| `date` | Change `2026-11-07` to your date, written as year-month-day. You can keep `T12:00:00Z`, which means noon in UTC. |
| `publish` | Keep `true` to show the picture. Use `false` to hide it. These words have no quotation marks. |

For this manual-upload template, leave `postId`, `imageIndex`, and `postUrl` as
shown. For entries that already exist, preserve their existing values and IDs.
Instagram importing is explained separately in the [README](README.md#import-selected-instagram-posts).

Keep the brackets, braces, commas, and quotation marks in place. If this is the
first picture in a completely empty list, remove the comma after its final `}`.
Within a caption, single quotation marks are easiest; a double quotation mark
must be written as `\"`. Write `\n` if you want a line break in the caption.

Save the change, then check the website update. The picture appears first in its
gallery because you added it at the top of the list. Gallery descriptions show
up to three lines; clicking the picture opens its full description.

### 4. Change a caption or hide a picture later

Open the description file and use your browser's Find command (**Command+F** on
Mac, **Ctrl+F** on Windows) to find the picture's filename.

- To change the description, edit only the text beside `caption`.
- To hide the picture, change `"publish": true` to `"publish": false`.
- To show it again, change `false` back to `true`.
- To change gallery order, move its entire entry, including all its fields, to
  the desired place. Changing the date does not change the order.

Leave its `id` unchanged. That label keeps its shared artwork link working. Use
**Copy Link** after opening the picture on the website to share it.

Hiding an image also removes its individual page from the next website update.
Files saved in this public GitHub project remain visible there, even when hidden
from the gallery. Do not upload private pictures or information.

## Edit the blog

### Change an existing post

1. Open [the blog folder](src/content/blog/) and choose the post.
2. Click the pencil button.
3. Edit the ordinary paragraphs. Keep the lines between the two `---` markers
   at the top unless you are changing the post's title, date, or short description.
4. Existing posts may have lines beginning with `import`, `<Photo`, or `<Gallery`.
   Leave those blocks intact when editing the writing around them.
5. Save and check the update online.

### Write a new post

1. In [the blog folder](src/content/blog/), click **Add file → Create new file**.
2. Name it something like `making-a-blue-pot.md`. Use lowercase words separated
   by hyphens and keep `.md` at the end.
3. Copy this template into the file:

```markdown
---
title: 'Making a blue pot'
description: 'Notes on the clay, glaze, and making process.'
pubDate: 2026-11-07
draft: false
---

Write your introduction here.

Write another paragraph about your materials and how the piece developed.
```

Replace the title, short description, date, and paragraphs. Keep the `---` lines,
field names, and quotation marks around the title and description. If your title
contains an apostrophe, write it twice inside those single quotes: `Emilie''s pot`.

A blank line starts a new paragraph. Use `**some words**` to make those words bold,
or `*some words*` for italics. GitHub's **Preview** tab can show the text formatting;
it does not show the complete website layout.

Save when ready. This example publishes the post. To save it without displaying
it on the website, change `draft: false` to `draft: true`. Change it back when
ready to publish. Drafts are not visible on the live site.

Your example post will be at `/blog/making-a-blue-pot/`. New posts appear in date
order, newest first. For a post with images, ask the person maintaining the site
to help use the image examples in the [README](README.md#advanced-blog-images).

## Edit pages

| What you want to change | Open this file |
| --- | --- |
| About text | [about.astro](src/pages/about.astro) |
| Contact text and displayed account names | [contact.astro](src/pages/contact.astro) |
| Instagram or GitHub destination links | [config.ts](src/config.ts) |
| Privacy text | [privacy.astro](src/pages/privacy.astro) |
| Artwork & Image Use text | [license.astro](src/pages/license.astro) |

Open the file, click the pencil, and find the words you recognise from the page.
Text may sit between markers such as `<p>` and `</p>`. Change the words between
those markers while leaving the markers in place. Keep anything inside `{...}`
and the setup block between the first two `---` lines unchanged.

For destination links in `config.ts`, find `instagram:` or `github:` and replace
only the URL inside its quotation marks. For layout changes or anything you do
not recognise, ask for help before changing it.

## Check your changes online

1. Open the project's [Actions tab](https://github.com/emilieidea-co-uk/emilieidea-co-uk.github.io/actions).
2. Find the latest **Deploy to GitHub Pages** update. Wait for it to finish with
   a green check mark; a save does not appear on the website immediately.
3. Open **https://emilieidea-co-uk.github.io/** and refresh. Check the picture,
   caption, or page you changed. Artworks is the home page; use the menu to visit
   ScrapingBy, Embroideries, or Blog.

If you see a red cross, the update failed and the previous successful website
normally stays online. Check the filename and punctuation in your edits. If you
are unsure, ask for help and include the failed Actions link; there is no need
to keep making changes to try to force an update.

If there is a green check but your change is missing, check that you saved to
**master**, the picture has `publish: true`, or the blog has `draft: false`.
Refresh the browser again.

For setup, local preview, automated imports, and developer tools, use
[README.md](README.md).

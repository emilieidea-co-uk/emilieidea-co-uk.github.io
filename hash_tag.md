Yes. Clickable hashtags can automatically generate category pages on EmilieIdea.

For example, on the [Radish horse artwork page](https://emilieidea-co-uk.github.io/artwork/instagram-CxkzviaMvHj-01/?utm_source=chatgpt.com), you could display:

`#Horse` `#TextileArt` `#Handmade`

When someone clicks `#Horse`, they navigate to:

`/tags/horse/`

That page displays all artworks tagged `horse`.

## Simplest implementation

Assuming the site uses Astro, just add a `tags` field to each artwork:

```
{
  "title": "Radish",
  "tags": ["horse", "textile-art", "handmade"]
}
```

Then:

1. Display each tag as a clickable link on artwork pages.
2. Create one Astro dynamic route: `src/pages/tags/[tag].astro`.
3. Use `getStaticPaths()` to generate one page for each unique tag.
4. Filter artworks by that tag to display the matching collection.

No database, backend, or JavaScript runtime filtering required. GitHub Pages can serve the generated static pages.

I checked the linked page: it currently displays the artwork description and image gallery, but no visible hashtags.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://emilieidea-co-uk.github.io\&sz=32)

EmilieIdea



My suggestion: Use tags as a lightweight way to discover related artwork, rather than adding more navigation categories. This would be particularly useful for linking all Emily's fabric horses together.



Yes. And I think this is a useful distinction between EmilieIdea and Instagram.

Instagram primarily organises content around a chronological feed and engagement. EmilieIdea can organise Emily's artwork around subjects, materials, techniques and creative ideas.

For example:

- `#Horse` → All handmade horses
- `#Embroidery` → Embroidered works
- `#RecycledFabric` → Works using recycled textiles
- `#Nature` → Nature-inspired artworks

The interesting part is that one artwork can belong to several collections simultaneously, without requiring Emily to maintain separate galleries.

Over time, these tags become an organic archive of her artistic practice.

And later, they could connect directly to Studio:

`#Horse → Horse artworks → Interactive Fabric Horse Studio`

This creates a natural relationship between viewing artwork and exploring how it is made.

I would keep the implementation extremely simple: manually assigned tags, automatically generated static pages, and no complicated taxonomy or tagging system.

Instagram is where people discover Emily. EmilieIdea is where they can explore her work more deeply.
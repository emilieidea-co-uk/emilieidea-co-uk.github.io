"""Inspect production HTML, sitemap, and artwork preview files after npm run build."""
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
SITE = 'https://emilieidea-co-uk.github.io'

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.meta, self.links, self.images, self.tiles, self.anchors = {}, [], [], [], []
        self.headings = []; self.in_h1 = False
        self.feed(path.read_text())
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1': self.in_h1 = True
        if tag == 'meta': self.meta[attrs.get('property', attrs.get('name'))] = attrs.get('content')
        if tag == 'link': self.links.append(attrs)
        if tag == 'a': self.anchors.append(attrs)
        if tag == 'img': self.images.append(attrs)
        if tag == 'button' and 'photo-tile' in attrs.get('class', ''): self.tiles.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'h1': self.in_h1 = False
    def handle_data(self, data):
        if self.in_h1: self.headings.append(data)

sitemap = {element.text for element in ET.parse(DIST / 'sitemap-0.xml').iter() if element.tag.endswith('}loc')}
count = 0
all_groups = []
all_published = []
for collection, gallery in [('artworks', 'index.html'), ('scrapingby', 'scrapingby/index.html'), ('embroideries', 'embroideries/index.html')]:
    entries = json.loads((ROOT / f'src/data/{collection}.json').read_text())
    published = [entry for entry in entries if entry['publish']]
    listing = Page(DIST / gallery)
    groups = {}
    for entry in published:
        key = ('post', entry['postId']) if entry['postId'] else ('image', entry['id'])
        groups.setdefault(key, []).append(entry)
    ordered = [sorted(group, key=lambda entry: entry['imageIndex']) for group in groups.values()]
    all_groups.extend(ordered)
    all_published.extend(published)
    assert [tile['data-artwork-url'] for tile in listing.tiles] == [f'/artwork/{group[0]["id"]}/' for group in ordered]
    for tile, group in zip(listing.tiles, ordered):
        slides = json.loads(tile['data-photo-group'])
        assert [slide['id'] for slide in slides] == [entry['id'] for entry in group]
        assert [slide['caption'] for slide in slides] == [entry['caption'] for entry in group]
        assert [[tag['tag'] for tag in slide['tags']] for slide in slides] == [entry.get('tags', []) for entry in group]
        for slide in slides:
            assert (DIST / slide['src'].lstrip('/')).is_file()
    for entry in entries:
        path = f'/artwork/{entry["id"]}/'
        file = DIST / path.lstrip('/') / 'index.html'
        if not entry['publish']:
            assert not file.exists(), file
            assert SITE + path not in sitemap
            continue
        count += 1
        page = Page(file)
        assert {'rel': 'canonical', 'href': SITE + path} in page.links
        assert not page.headings
        assert page.meta['og:url'] == SITE + path
        assert page.meta['og:title']
        assert page.meta['og:description']
        assert page.meta['twitter:card'] == 'summary_large_image'
        assert page.meta['twitter:image'] == page.meta['og:image']
        preview = urlparse(page.meta['og:image'])
        assert preview.scheme == 'https' and preview.netloc == 'emilieidea-co-uk.github.io'
        image = DIST / preview.path.lstrip('/')
        assert image.suffix == '.jpg' and image.is_file(), image
        assert int(page.meta['og:image:width']) > 0 and int(page.meta['og:image:height']) > 0
        assert SITE + path in sitemap
        assert page.tiles[0]['data-artwork-url'] == path
        assert (page.tiles[0].get('data-caption') or '') == entry['caption']
        slides = json.loads(page.tiles[0]['data-photo-group'])
        expected = next(group for group in ordered if any(row['id'] == entry['id'] for row in group))
        assert [slide['id'] for slide in slides] == [row['id'] for row in expected]
        assert slides[int(page.tiles[0]['data-photo-index'])]['id'] == entry['id']
        logos = [img for img in page.images if 'brand__mark' in img.get('class', '')]
        assert len(logos) == 2
        assert all(f'ei-{collection}-' in logo['src'] for logo in logos)
        for tag in entry.get('tags', []):
            assert any(a.get('href') == f'/tags/{tag}/' for a in page.anchors), (entry['id'], tag)

tag_names = {tag for entry in all_published for tag in entry.get('tags', [])}
tag_index = Page(DIST / 'tags/index.html')
assert SITE + '/tags/' in sitemap
assert not tag_names.intersection({'artworks', 'scrapingby', 'embroideries', 'embroidery'})
for tag in tag_names:
    path = f'/tags/{tag}/'
    assert SITE + path in sitemap
    assert any(a.get('href') == path for a in tag_index.anchors)
    page = Page(DIST / path.lstrip('/') / 'index.html')
    assert {'rel': 'canonical', 'href': SITE + path} in page.links
    assert any(a.get('href') == '/tags/' for a in page.anchors)
    expected = [group for group in all_groups if any(tag in row.get('tags', []) for row in group)]
    expected.sort(key=lambda group: next(row['date'] for row in group if tag in row.get('tags', [])), reverse=True)
    assert len(page.tiles) == len(expected)
    for tile, group in zip(page.tiles, expected):
        index = next(i for i, row in enumerate(group) if tag in row.get('tags', []))
        assert int(tile['data-photo-index']) == index
        assert tile['data-artwork-url'] == f'/artwork/{group[index]["id"]}/'
        slides = json.loads(tile['data-photo-group'])
        assert [slide['id'] for slide in slides] == [row['id'] for row in group]
        assert [item['tag'] for item in slides[index]['tags']] == group[index]['tags']
generated_tags = {path.parent.name for path in (DIST / 'tags').glob('*/index.html')}
assert generated_tags == tag_names  # Draft-only and removed tags must not generate pages.

blog = Page(DIST / 'blog/a-line-through-thread-clay-and-print/index.html')
assert len(blog.tiles) == 4 and all(tile.get('data-artwork-url') for tile in blog.tiles)
studio_preview = Page(DIST / 'studio/drawing-to-stitches/preview/index.html')
preview_path = '/studio/drawing-to-stitches/preview/'
assert SITE + preview_path in sitemap
assert {'rel': 'canonical', 'href': SITE + preview_path} in studio_preview.links
assert any(a.get('href') == '/studio/drawing-to-stitches/' for a in studio_preview.anchors)
assert any(a.get('href') == '/artwork/instagram-CWO3doINYa7-01/' for a in studio_preview.anchors)
assert studio_preview.headings == ['Stitch preview']
preview_html = (DIST / 'studio/drawing-to-stitches/preview/index.html').read_text()
assert '<footer' not in preview_html and 'id="primary-nav"' not in preview_html
assert 'class="sidebar"' not in preview_html
assert 'id="primary-nav"' in (DIST / 'studio/index.html').read_text()
assert '<footer' in (DIST / 'studio/index.html').read_text()
editor_html = (DIST / 'studio/drawing-to-stitches/index.html').read_text()
assert 'id="primary-nav"' not in editor_html and '<footer' not in editor_html
assert 'study-instructions' not in editor_html and 'study-description' not in editor_html
assert 'Loading the stitch preview' not in editor_html
for definition in (ROOT / 'src/data/studio').glob('*.json'):
    drawing = json.loads(definition.read_text())
    assert f'value="{drawing["id"]}"' in editor_html
    assert drawing['name'] in editor_html
assert 'What to try' in editor_html and 'From the work' in editor_html

print(f'Production checks passed: {count} image pages, {len(tag_names)} tag pages, grouped galleries and carousels, blog links, preview files, metadata, and sitemap.')

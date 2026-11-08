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
        self.meta, self.links, self.images, self.tiles = {}, [], [], []
        self.headings = []; self.in_h1 = False
        self.feed(path.read_text())
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'h1': self.in_h1 = True
        if tag == 'meta': self.meta[attrs.get('property', attrs.get('name'))] = attrs.get('content')
        if tag == 'link': self.links.append(attrs)
        if tag == 'img': self.images.append(attrs)
        if tag == 'button' and 'photo-tile' in attrs.get('class', ''): self.tiles.append(attrs)

    def handle_endtag(self, tag):
        if tag == 'h1': self.in_h1 = False
    def handle_data(self, data):
        if self.in_h1: self.headings.append(data)

sitemap = {element.text for element in ET.parse(DIST / 'sitemap-0.xml').iter() if element.tag.endswith('}loc')}
count = 0
for collection, gallery in [('artworks', 'index.html'), ('scrapingby', 'scrapingby/index.html'), ('embroideries', 'embroideries/index.html')]:
    entries = json.loads((ROOT / f'src/data/{collection}.json').read_text())
    published = [entry for entry in entries if entry['publish']]
    listing = Page(DIST / gallery)
    groups = {}
    for entry in published:
        key = ('post', entry['postId']) if entry['postId'] else ('image', entry['id'])
        groups.setdefault(key, []).append(entry)
    ordered = [sorted(group, key=lambda entry: entry['imageIndex']) for group in groups.values()]
    assert [tile['data-artwork-url'] for tile in listing.tiles] == [f'/artwork/{group[0]["id"]}/' for group in ordered]
    for tile, group in zip(listing.tiles, ordered):
        slides = json.loads(tile['data-photo-group'])
        assert [slide['id'] for slide in slides] == [entry['id'] for entry in group]
        assert [slide['caption'] for slide in slides] == [entry['caption'] for entry in group]
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

blog = Page(DIST / 'blog/a-line-through-thread-clay-and-print/index.html')
assert len(blog.tiles) == 4 and all(tile.get('data-artwork-url') for tile in blog.tiles)
print(f'Production checks passed: {count} image pages, grouped galleries and carousels, blog links, preview files, metadata, and sitemap.')

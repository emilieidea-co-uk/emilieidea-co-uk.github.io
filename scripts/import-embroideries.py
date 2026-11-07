"""Import project images and CSV captions, preserving curated selections and publish flags."""
import argparse
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    'embroideries': 'src/assets/ei_original_1_em/emilie_idea_embroideries_posts_2026-11-07_1726.csv',
    'scrapingby': 'src/assets/ei_original_2_sc/eco_zhonglaise_posts_2026-11-07_1542.csv',
    'artworks': 'src/assets/ei_original_3_ar/emilieidea_zugou_posts_2026-11-07_1802.csv',
}
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--collection', choices=SOURCES, default='embroideries')
parser.add_argument('--csv', type=Path)
parser.add_argument('--selection', type=Path, help='Manifest containing the reviewed filenames to import.')
parser.add_argument('--limit', type=int, help='Require this exact number of selected images.')
args = parser.parse_args()
if args.limit is not None and args.limit < 1:
    parser.error('--limit must be positive')

csv_path = args.csv or ROOT / SOURCES[args.collection]
manifest = ROOT / 'src/data' / f'{args.collection}.json'
existing = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
publish_by_file = {item['file']: item.get('publish', True) for item in existing}
with csv_path.open(newline='', encoding='utf-8-sig') as handle:
    rows = sorted(csv.DictReader(handle), key=lambda row: int(row['timestamp']), reverse=True)
images = sorted(p for p in csv_path.parent.iterdir() if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.avif'})

# Match exact post IDs, including carousel suffixes, rather than CDN URLs.
image_posts = {}
for row in rows:
    pattern = re.compile(r'_' + re.escape(row['shortcode']) + r'(?:_(\d+))?$')
    for image in images:
        match = pattern.search(image.stem)
        if match:
            image_posts[image.name] = (row, int(match.group(1) or 0))

# Existing manifests are authoritative: reimport never replaces reviewed works
# with unrelated recent posts. --selection explicitly replaces the filename list.
if args.selection:
    chosen = json.loads(args.selection.read_text(encoding='utf-8'))
elif existing:
    chosen = existing
elif args.collection != 'embroideries':
    parser.error('A new curated gallery requires --selection <manifest.json>.')
else:
    chosen, seen = [], set()
    for image in images:
        if image.name not in image_posts:
            continue
        row, sequence = image_posts[image.name]
        if row['caption'].strip() and row['isVideo'].lower() != 'true':
            chosen.append({'file': image.name})
    chosen.sort(key=lambda item: (-int(image_posts[item['file']][0]['timestamp']), image_posts[item['file']][1], item['file']))
    unique_posts = []
    for item in chosen:
        shortcode = image_posts[item['file']][0]['shortcode']
        if shortcode not in seen:
            unique_posts.append(item)
            seen.add(shortcode)
    chosen = unique_posts[:args.limit or 20]

if args.limit is not None and len(chosen) != args.limit:
    raise SystemExit(f'Selection has {len(chosen)} images; expected {args.limit}. No files copied.')
if len({item['file'] for item in chosen}) != len(chosen):
    raise SystemExit('Selection contains duplicate filenames. No files copied.')
for item in chosen:
    if item['file'] not in image_posts:
        raise SystemExit(f'No local image and CSV post match for {item["file"]}. No files copied.')

chosen.sort(key=lambda item: (-int(image_posts[item['file']][0]['timestamp']), image_posts[item['file']][1], item['file']))
selected = []
for item in chosen:
    filename = item['file']
    row, sequence = image_posts[filename]
    selected.append({
        'file': filename,
        'publish': publish_by_file.get(filename, item.get('publish', True)),
        'caption': row['caption'],
        'date': datetime.fromtimestamp(int(row['timestamp']), timezone.utc).isoformat().replace('+00:00', 'Z'),
        'postUrl': row['url'],
    })

destination = ROOT / 'src/assets' / args.collection
for item in selected:
    target = destination / item['file']
    source = csv_path.parent / item['file']
    if target.exists() and target.read_bytes() != source.read_bytes():
        raise SystemExit(f'Refusing to overwrite a different image: {target}')
destination.mkdir(parents=True, exist_ok=True)
for item in selected:
    shutil.copy2(csv_path.parent / item['file'], destination / item['file'])
manifest.write_text(json.dumps(selected, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(selected)} images into {args.collection}; {sum(item["publish"] for item in selected)} published. Originals unchanged.')

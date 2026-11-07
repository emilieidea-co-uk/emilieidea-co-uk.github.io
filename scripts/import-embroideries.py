"""Copy a captioned CSV sample into the Embroideries gallery; keep originals intact."""
import argparse
import csv
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--collection', choices=['embroideries1', 'embroideries2'], default='embroideries1')
parser.add_argument('--csv', type=Path)
parser.add_argument('--limit', type=int, default=20)
args = parser.parse_args()
if args.limit < 1:
    parser.error('--limit must be positive')

sources = {
    'embroideries1': 'src/assets/ei_original_1/emilie_idea_embroideries_posts_2026-11-07_1726.csv',
    'embroideries2': 'src/assets/ei_original_2/eco_zhonglaise_posts_2026-11-07_1542.csv',
}
csv_path = args.csv or ROOT / sources[args.collection]
manifest = ROOT / 'src/data' / f'{args.collection}.json'
existing = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
publish_by_file = {item['file']: item.get('publish', True) for item in existing}

with csv_path.open(newline='', encoding='utf-8-sig') as handle:
    rows = list(csv.DictReader(handle))
images = sorted(p for p in csv_path.parent.iterdir() if p.suffix.lower() in {'.jpg', '.jpeg', '.png', '.webp', '.avif'})
selected = []
seen = set()
for row in sorted(rows, key=lambda row: int(row['timestamp']), reverse=True):
    if not row['caption'].strip() or row['isVideo'].lower() == 'true' or row['shortcode'] in seen:
        continue
    pattern = re.compile(r'_' + re.escape(row['shortcode']) + r'(?:_\d+)?$')
    matches = [p for p in images if pattern.search(p.stem)]
    if not matches:
        continue
    seen.add(row['shortcode'])
    selected.append({
        'file': matches[0].name,
        'publish': publish_by_file.get(matches[0].name, True),
        'caption': row['caption'],
        'date': datetime.fromtimestamp(int(row['timestamp']), timezone.utc).isoformat().replace('+00:00', 'Z'),
        'postUrl': row['url'],
    })
    if len(selected) == args.limit:
        break
if len(selected) != args.limit:
    raise SystemExit(f'Only {len(selected)} captioned posts have matching images; requested {args.limit}. No files copied.')

destination = ROOT / 'src/assets' / args.collection
destination.mkdir(parents=True, exist_ok=True)
for item in selected:
    target = destination / item['file']
    source = csv_path.parent / item['file']
    if target.exists() and target.read_bytes() != source.read_bytes():
        raise SystemExit(f'Refusing to overwrite a different image: {target}')
for item in selected:
    shutil.copy2(csv_path.parent / item['file'], destination / item['file'])
manifest.write_text(json.dumps(selected, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Copied {len(selected)} images and wrote {manifest.relative_to(ROOT)}. Originals unchanged.')

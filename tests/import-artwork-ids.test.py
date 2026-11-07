"""Run the real CSV importer against an isolated miniature project."""
import csv
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

IMPORTER = Path(__file__).resolve().parents[1] / 'scripts/import-embroideries.py'

class ImportIDs(unittest.TestCase):
    def test_preserves_ids_and_assigns_new_carousel_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'scripts').mkdir()
            shutil.copy2(IMPORTER, root / 'scripts/import-embroideries.py')
            (root / 'src/data').mkdir(parents=True)
            for name in ['artworks', 'scrapingby', 'embroideries']:
                (root / f'src/data/{name}.json').write_text('[]')
            archive = root / 'archive'
            archive.mkdir()
            existing = {'file': 'renamed.jpg', 'id': 'permanent-existing-id',
                        'postId': 'PostOne', 'imageIndex': 2, 'publish': False,
                        'caption': 'Old text', 'date': '2026-01-01T00:00:00Z',
                        'postUrl': 'https://www.instagram.com/p/PostOne/'}
            # The importer matches original exported filenames. Identity survives
            # changes to exported names as long as the stored file entry matches.
            existing['file'] = 'new_export_PostOne_02.jpg'
            manifest = root / 'src/data/artworks.json'
            manifest.write_text(json.dumps([existing]))
            selection = root / 'selection.json'
            selection.write_text(json.dumps([existing, {'file': 'export_PostTwo_03.jpg'}]))
            for name in [existing['file'], 'export_PostTwo_03.jpg']:
                (archive / name).write_bytes(b'example image')
            with (archive / 'posts.csv').open('w') as handle:
                writer = csv.DictWriter(handle, fieldnames=['shortcode', 'timestamp', 'caption', 'url', 'isVideo'])
                writer.writeheader()
                for post in ['PostOne', 'PostTwo']:
                    writer.writerow({'shortcode': post, 'timestamp': '1794052800',
                                     'caption': 'Updated CSV text', 'url': f'https://www.instagram.com/p/{post}/', 'isVideo': 'false'})
            command = ['python3', str(root / 'scripts/import-embroideries.py'),
                       '--collection', 'artworks', '--csv', str(archive / 'posts.csv'),
                       '--selection', str(selection)]
            subprocess.run(command, check=True, capture_output=True)
            entries = {row['postId']: row for row in json.loads(manifest.read_text())}
            self.assertEqual(entries['PostOne']['id'], existing['id'])
            self.assertEqual(entries['PostOne']['imageIndex'], 2)
            self.assertFalse(entries['PostOne']['publish'])
            self.assertEqual(entries['PostTwo']['id'], 'instagram-PostTwo-03')
            before = manifest.read_bytes()
            subprocess.run(command, check=True, capture_output=True)
            self.assertEqual(before, manifest.read_bytes())
            duplicate = dict(entries['PostTwo'], file='other.jpg', postId='Other')
            (root / 'src/data/scrapingby.json').write_text(json.dumps([duplicate]))
            result = subprocess.run(command, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b'duplicate artwork ID', result.stderr)
            self.assertEqual(before, manifest.read_bytes())

if __name__ == '__main__':
    unittest.main()

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validTag, tagLinks, artworkTagIndex, groupsForTag, matchingImageIndex } from '../src/lib/artwork-tags.mjs';
import { validateArtworks } from '../src/lib/artwork-data.mjs';
import { groupArtworks } from '../src/lib/artwork-groups.mjs';

test('tags use unique lowercase slugs and exclude sidebar collection names', () => {
  const entry = { id: 'one', postId: null, imageIndex: 1, file: 'one.jpg', publish: true,
    caption: '', date: '2026-11-13T12:00:00Z', postUrl: '' };
  const validate = tags => validateArtworks({ artworks: [{ ...entry, tags }] }, () => true);
  for (const tags of [undefined, [], ['horse', 'visible-mending']]) validate(tags);
  for (const tags of [null, 'horse', ['Horse'], ['textile art'], ['horse', 'horse'],
    ['artworks'], ['scrapingby'], ['scraping-by'], ['embroideries'], ['embroidery'], [null]]) {
    assert.throws(() => validate(tags), /tags/);
  }
  assert.equal(validTag('visible-mending'), true);
  assert.deepEqual(tagLinks(['visible-mending'], path => `/portfolio${path}`),
    [{ tag: 'visible-mending', label: '#VisibleMending', href: '/portfolio/tags/visible-mending/' }]);
});

test('tag results count posts across collections and preserve complete carousel order with a matching cover', () => {
  const image = (id, postId, imageIndex, tags, collection = 'artworks', publish = true, date = '2026-01-01') =>
    ({ id, postId, imageIndex, tags, collection, publish, date });
  const groups = groupArtworks([
    image('a2', 'a', 2, ['horse', 'textile-art']), image('a1', 'a', 1, ['pottery']),
    image('a3', 'a', 3, ['horse']), image('hidden', 'a', 4, ['draft-only'], 'artworks', false),
    image('b1', 'b', 1, ['horse'], 'embroideries', true, '2026-02-01'),
    image('c1', 'c', 1, ['flowers'], 'scrapingby'), image('untagged', null, 1, undefined),
  ]);
  const before = JSON.stringify(groups);
  assert.deepEqual(artworkTagIndex(groups), [
    { tag: 'flowers', label: '#Flowers', count: 1 }, { tag: 'horse', label: '#Horse', count: 2 },
    { tag: 'pottery', label: '#Pottery', count: 1 }, { tag: 'textile-art', label: '#TextileArt', count: 1 },
  ]);
  const matches = groupsForTag(groups, 'horse');
  assert.deepEqual(matches.map(group => group.postId), ['b', 'a']);
  assert.deepEqual(matches[1].images.map(image => image.id), ['a1', 'a2', 'a3']);
  assert.equal(matchingImageIndex(matches[1], 'horse'), 1);
  assert.deepEqual(groupsForTag(groups, 'draft-only'), []);
  assert.equal(JSON.stringify(groups), before);
});

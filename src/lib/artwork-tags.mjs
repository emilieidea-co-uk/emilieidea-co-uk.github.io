// Collection names stay in the sidebar; tags describe individual pictures.
const collectionTags = new Set(['artworks', 'scrapingby', 'scraping-by', 'embroideries', 'embroidery']);

export function validTag(tag) {
  return typeof tag === 'string' && /^[a-z]+(?:-[a-z]+)*$/.test(tag) && !collectionTags.has(tag);
}

export function tagLabel(tag) {
  return '#' + tag.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('');
}

export function tagLinks(tags = [], path = value => value) {
  return tags.map(tag => ({ tag, label: tagLabel(tag), href: path(`/tags/${tag}/`) }));
}

export function matchingImageIndex(group, tag) {
  return group.images.findIndex(image => image.publish && (image.tags ?? []).includes(tag));
}

export function groupsForTag(groups, tag) {
  return groups.filter(group => matchingImageIndex(group, tag) >= 0)
    .sort((a, b) => Date.parse(b.images[matchingImageIndex(b, tag)].date) - Date.parse(a.images[matchingImageIndex(a, tag)].date));
}

export function artworkTagIndex(groups) {
  const counts = new Map();
  for (const group of groups) {
    const tags = new Set(group.images.filter(image => image.publish).flatMap(image => image.tags ?? []));
    for (const tag of tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([tag, count]) => ({ tag, label: tagLabel(tag), count }));
}

// The same links are rendered on the server and replaced on slide changes.
export function updateTagLinks(root, links = []) {
  if (!root) return;
  const doc = root.ownerDocument;
  root.replaceChildren(...links.map(link => {
    const anchor = doc.createElement('a');
    anchor.href = link.href;
    anchor.textContent = link.label;
    return anchor;
  }));
  root.hidden = links.length === 0;
}

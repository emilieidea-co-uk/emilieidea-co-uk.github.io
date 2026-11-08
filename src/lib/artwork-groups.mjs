// Group only published images, without changing manifest order or stored records.
export function groupArtworks(records) {
  const groups = new Map();
  for (const entry of records) {
    if (!entry.publish) continue;
    const key = JSON.stringify([entry.collection, entry.postId ? 'post' : 'image', entry.postId || entry.id]);
    if (!groups.has(key)) groups.set(key, { collection: entry.collection, postId: entry.postId, images: [] });
    groups.get(key).images.push(entry);
  }
  for (const group of groups.values()) group.images.sort((a, b) => a.imageIndex - b.imageIndex);
  return [...groups.values()];
}

// Stored IDs are authoritative: never regenerate them from a renamed file.
export function assignIdentity(entry) {
  if (!entry.postUrl) {
    return { ...entry, id: entry.id ?? `image-${crypto.randomUUID()}`, postId: null, imageIndex: 1 };
  }
  const postId = entry.postId ?? new URL(entry.postUrl).pathname.match(/^\/p\/([\w-]+)\/?$/)?.[1];
  if (!postId) throw new Error(`Cannot identify Instagram post: ${entry.file}`);
  const stem = entry.file.replace(/\.[^.]+$/, '');
  const tail = stem.slice(stem.lastIndexOf(postId) + postId.length);
  const imageIndex = entry.imageIndex ?? (/^_\d+$/.test(tail) ? Number(tail.slice(1)) : 1);
  return { ...entry, id: entry.id ?? `instagram-${postId}-${String(imageIndex).padStart(2, '0')}`, postId, imageIndex };
}

export function validateArtworks(manifests, hasImage) {
  const ids = new Set();
  for (const [collection, entries] of Object.entries(manifests)) {
    const files = new Set();
    const positions = new Set();
    for (const entry of entries) {
      const fail = (reason) => { throw new Error(`${collection}/${entry.file}: ${reason}`); };
      if (typeof entry.id !== 'string' || !/^[\w-]+$/.test(entry.id)) fail('invalid or missing permanent ID');
      if (ids.has(entry.id)) fail(`duplicate ID ${entry.id}`);
      ids.add(entry.id);
      if (entry.postUrl && (typeof entry.postId !== 'string' || !/^[\w-]+$/.test(entry.postId))) fail('invalid postId');
      if (!entry.postUrl && entry.postId !== null) fail('local images must use postId: null');
      if (!Number.isInteger(entry.imageIndex) || entry.imageIndex < 1) fail('invalid imageIndex');
      const position = entry.postId ? `${entry.postId}:${entry.imageIndex}` : entry.id;
      if (positions.has(position)) fail('duplicate carousel position');
      positions.add(position);
      if (typeof entry.file !== 'string' || !entry.file || /[/\\]/.test(entry.file)) fail('invalid filename');
      if (files.has(entry.file)) fail('duplicate filename');
      files.add(entry.file);
      if (typeof entry.publish !== 'boolean' || typeof entry.caption !== 'string' ||
          typeof entry.date !== 'string' || !Number.isFinite(Date.parse(entry.date))) fail('invalid publication settings, caption, or date');
      if (!entry.postUrl) continue;
      let source;
      try { source = new URL(entry.postUrl); } catch { fail('invalid Instagram URL'); }
      if (source.protocol !== 'https:' || !['www.instagram.com', 'instagram.com'].includes(source.hostname) ||
          source.pathname !== `/p/${entry.postId}/`) fail('Instagram URL does not match postId');
      if (!hasImage(collection, entry.file)) fail('missing image file');
    }
  }
}

export function artworkTitle(entry, category) {
  return entry.caption.split(/\r?\n/).map(line => line.trim()).find(Boolean)?.slice(0, 80) || `${category} · ${entry.id}`;
}

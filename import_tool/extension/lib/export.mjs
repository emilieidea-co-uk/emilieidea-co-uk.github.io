import { FORMAT, MAX_IMAGE, validatePost, validateManifest, imageFormat, imageId, isMediaUrl } from './model.mjs';
import { createZip } from './zip.mjs';
async function download(url, fetchImpl) {
  if (!isMediaUrl(url)) throw new Error('Refusing an image URL outside Instagram media CDNs.');
  const response = await fetchImpl(url, { credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(30000), referrerPolicy: 'no-referrer' });
  if (!response.ok) throw new Error(`Image download failed (${response.status}). Reopen the post and recapture it if the URL has expired.`);
  if (Number(response.headers.get('content-length')) > MAX_IMAGE) throw new Error('Image exceeds 25 MB.');
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE) throw new Error('Image exceeds 25 MB.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
async function verifyImage(bytes) {
  const bitmap = await createImageBitmap(new Blob([bytes]));
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 40_000_000) throw new Error('Invalid or excessively large image dimensions.');
  } finally { bitmap.close(); }
}
export async function exportQueue(queue, { fetchImpl = fetch, verify = verifyImage, progress = () => {} } = {}) {
  if (!Array.isArray(queue) || !queue.length) throw new Error('Capture at least one photo first.');
  for (const post of queue) validatePost(post);
  if (queue.reduce((sum, post) => sum + post.images.length, 0) > 200) throw new Error('Export at most 200 photos per ZIP.');
  const posts = [], entries = [];
  let total = 0;
  for (const post of queue) {
    const images = [], hashes = new Set();
    for (const image of [...post.images].sort((a, b) => a.imageIndex - b.imageIndex)) {
      progress(`Downloading ${post.postId}, photo ${image.imageIndex} of ${post.imageCount}…`);
      const data = await download(image.url, fetchImpl);
      const extension = imageFormat(data);
      await verify(data);
      total += data.length;
      if (total > 190 * 1024 * 1024) throw new Error('Selection is too large. Export fewer posts.');
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map(v => v.toString(16).padStart(2, '0')).join('');
      if (hashes.has(sha256)) throw new Error(`Post ${post.postId} repeats the same photo at different positions. Remove the post and recapture each slide.`);
      hashes.add(sha256);
      const path = `images/${imageId(post.postId, image.imageIndex)}.${extension}`;
      images.push({ imageIndex: image.imageIndex, path, sha256 });
      entries.push({ name: path, data });
    }
    posts.push({ postId: post.postId, postUrl: post.postUrl, category: post.category, caption: post.caption,
      date: new Date(post.date).toISOString(), imageCount: post.imageCount, images });
  }
  const manifest = validateManifest({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(), posts });
  entries.unshift({ name: 'manifest.json', data: new TextEncoder().encode(JSON.stringify(manifest, null, 2) + '\n') });
  return createZip(entries);
}

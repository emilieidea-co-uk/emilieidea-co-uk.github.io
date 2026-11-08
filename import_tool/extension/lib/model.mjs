export const CATEGORIES = ['artworks', 'scrapingby', 'embroideries'];
export const FORMAT = 'emilieidea-instagram-export';
export const MAX_IMAGE = 25 * 1024 * 1024;
export const imageId = (postId, index) => `instagram-${postId}-${String(index).padStart(2, '0')}`;
export function parsePostUrl(value) {
  const url = new URL(value);
  const match = url.pathname.match(/^(?:\/[A-Za-z0-9_.]+)?\/p\/([\w-]+)\/?$/);
  if (url.protocol !== 'https:' || !['www.instagram.com', 'instagram.com'].includes(url.hostname) || !match) {
    throw new Error('Open a photo post at https://www.instagram.com/p/<post ID>/ first. Reels are not supported.');
  }
  return { postId: match[1], postUrl: `https://www.instagram.com/p/${match[1]}/` };
}
export function isMediaUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') &&
      ['cdninstagram.com', 'fbcdn.net'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}
export function imageFormat(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return 'png';
  const text = new TextDecoder().decode(bytes.subarray(0, 12));
  if (text.startsWith('RIFF') && text.endsWith('WEBP')) return 'webp';
  throw new Error('Media is not a JPEG, PNG, or WebP photo. Videos and login/error pages cannot be exported.');
}
export function validatePost(post, { complete = true } = {}) {
  const source = parsePostUrl(post.postUrl);
  if (source.postId !== post.postId) throw new Error('Post URL and ID disagree.');
  if (!CATEGORIES.includes(post.category)) throw new Error('Choose a valid project category.');
  if (typeof post.caption !== 'string' || post.caption.length > 100000) throw new Error('Invalid caption.');
  if (typeof post.date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(post.date) || !Number.isFinite(Date.parse(post.date))) throw new Error('Enter the full post date and time in ISO format.');
  if (!Number.isInteger(post.imageCount) || post.imageCount < 1 || post.imageCount > 100) throw new Error('Photo count must be between 1 and 100.');
  if (!Array.isArray(post.images) || !post.images.length || post.images.length > post.imageCount) throw new Error('Invalid photo selection.');
  const indices = new Set();
  for (const image of post.images) {
    if (!Number.isInteger(image.imageIndex) || image.imageIndex < 1 || image.imageIndex > post.imageCount || indices.has(image.imageIndex)) throw new Error('Invalid or duplicate carousel position.');
    indices.add(image.imageIndex);
  }
  if (complete && indices.size !== post.imageCount) {
    const missing = Array.from({ length: post.imageCount }, (_, i) => i + 1).filter(index => !indices.has(index));
    throw new Error(`Post ${post.postId} is incomplete. Capture photo positions: ${missing.join(', ')}.`);
  }
}
export function validateManifest(manifest) {
  if (manifest?.format !== FORMAT || manifest.version !== 1 || !Array.isArray(manifest.posts) || !manifest.posts.length || manifest.posts.length > 100) throw new Error('Unsupported export manifest.');
  const posts = new Set(), paths = new Set();
  let count = 0;
  for (const post of manifest.posts) {
    validatePost(post);
    if (posts.has(post.postId)) throw new Error('Duplicate post in export.');
    posts.add(post.postId);
    for (const image of post.images) {
      const prefix = `images/${imageId(post.postId, image.imageIndex)}.`;
      if (typeof image.path !== 'string' || !image.path.startsWith(prefix) || !['jpg', 'png', 'webp'].includes(image.path.slice(prefix.length)) || paths.has(image.path)) throw new Error('Invalid or duplicate media path.');
      if (typeof image.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(image.sha256)) throw new Error('Missing media checksum.');
      paths.add(image.path);
      count++;
    }
  }
  if (count > 200) throw new Error('Export at most 200 photos per ZIP.');
  return manifest;
}
export function addCapture(queue, post, image) {
  if (!isMediaUrl(image.url)) throw new Error('This image is not hosted on a supported Instagram CDN.');
  const existing = queue.find(item => item.postId === post.postId);
  const images = existing ? [...existing.images] : [];
  const same = images.find(item => item.imageIndex === image.imageIndex);
  if (same) throw new Error('This position is already captured. Remove the post from the queue to recapture it.');
  if (images.some(item => item.url === image.url)) throw new Error('This photo is already captured at another position. Open the next carousel photo before reading the tab again.');
  images.push(image);
  images.sort((a, b) => a.imageIndex - b.imageIndex);
  const result = { ...post, images };
  validatePost(result, { complete: false });
  const next = queue.filter(item => item.postId !== post.postId);
  next.push(result);
  if (next.reduce((sum, item) => sum + item.images.length, 0) > 200) throw new Error('Export at most 200 photos at a time.');
  return next;
}

// Add a complete, reviewed post in one operation; never leak a partial draft.
export function addPost(queue, post, { replace = false } = {}) {
  validatePost(post);
  const urls = new Set();
  for (const image of post.images) {
    if (!isMediaUrl(image.url)) throw new Error('This image is not hosted on a supported Instagram CDN.');
    const key = new URL(image.url).pathname;
    if (urls.has(key)) throw new Error('The post repeats the same photo at different positions. Rescan it.');
    urls.add(key);
  }
  const existing = queue.findIndex(item => item.postId === post.postId);
  if (existing >= 0 && !replace) throw new Error('This post is already in the export. Confirm replacement first.');
  const result = { postId: post.postId, postUrl: post.postUrl, category: post.category,
    caption: post.caption, date: post.date, imageCount: post.imageCount,
    images: [...post.images].sort((a, b) => a.imageIndex - b.imageIndex).map(image => ({ imageIndex: image.imageIndex, url: image.url })) };
  const next = [...queue];
  if (existing >= 0) next[existing] = result; else next.push(result);
  if (next.reduce((sum, item) => sum + item.images.length, 0) > 200) throw new Error('Export at most 200 photos at a time.');
  return next;
}

export function captureManualPhoto(draft, photo, imageIndex, imageCount) {
  if (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > 100 || !Number.isInteger(imageIndex) || imageIndex < 1 || imageIndex > imageCount) throw new Error('Enter the photo position and total photos, from 1 to 100.');
  if (!isMediaUrl(photo?.url)) throw new Error('Read and preview a valid photo first.');
  if (draft.images.some(image => image.imageIndex === imageIndex)) throw new Error('This position is already captured. Remove it before recapturing.');
  if (draft.images.some(image => new URL(image.url).pathname === new URL(photo.url).pathname)) throw new Error('This is the same photo already captured. Click Instagram’s next arrow, then Read current photo again.');
  const images = [...draft.images, { imageIndex, url: photo.url }].sort((a, b) => a.imageIndex - b.imageIndex);
  if (images.some(image => image.imageIndex > imageCount)) throw new Error('The total is smaller than an already captured position.');
  return { ...draft, mode: 'manual', images, imageCount, expectedCount: imageCount,
    complete: images.length === imageCount && images.every((image, index) => image.imageIndex === index + 1) };
}
export function removeManualPhoto(draft, imageIndex) {
  return { ...draft, mode: 'manual', complete: false, images: draft.images.filter(image => image.imageIndex !== imageIndex) };
}

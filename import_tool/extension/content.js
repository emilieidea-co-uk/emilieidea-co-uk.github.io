// Executed only when the artist clicks Read Instagram tab. Read rendered DOM;
// never call Instagram private APIs or inspect account credentials.
(() => {
  const match = location.pathname.match(/^(?:\/[A-Za-z0-9_.]+)?\/p\/([\w-]+)\/?$/);
  if (location.hostname !== 'www.instagram.com') throw new Error('Open Instagram first.');
  if (!match) {
    const profile = location.pathname.match(/^\/([A-Za-z0-9_.]+)\/?$/);
    if (!profile || ['reels', 'explore', 'accounts', 'direct', 'stories'].includes(profile[1])) throw new Error('Open an Instagram profile or individual photo post.');
    const posts = [...document.querySelectorAll('a[href]')].map(link => {
      let url;
      try { url = new URL(link.getAttribute('href'), location.origin); } catch { return undefined; }
      const post = url.pathname.match(/^(?:\/[A-Za-z0-9_.]+)?\/p\/([\w-]+)\/?$/);
      if (!post || url.origin !== location.origin) return undefined;
      const thumbnail = link.querySelector?.('img');
      return { postId: post[1], postUrl: `https://www.instagram.com/p/${post[1]}/`, thumbnail: thumbnail?.currentSrc || thumbnail?.src || '' };
    }).filter(Boolean);
    const unique = posts.filter((post, index) => posts.findIndex(other => other.postId === post.postId) === index);
    if (!unique.length) throw new Error('No photo posts are loaded on this profile. Scroll to load its grid, then read the tab again.');
    return { kind: 'profile', username: profile[1], posts: unique.slice(0, 100) };
  }
  const postId = match[1];
  const dialog = document.querySelector('[role="dialog"]');
  const articles = [...(dialog || document).querySelectorAll('article')];
  const root = articles.find(article => [...article.querySelectorAll('a[href]')].some(a => a.getAttribute('href')?.includes(`/p/${postId}/`))) || articles[0] || dialog || document.querySelector('main');
  if (!root) throw new Error('The post has not loaded. Open it, then try again.');
  if (root.querySelector('video')) throw new Error('This post contains a loaded video. Version 1 supports photo-only posts.');
  const candidates = [...root.querySelectorAll('img')].filter(img => {
    const box = img.getBoundingClientRect();
    const style = getComputedStyle(img);
    return img.naturalWidth >= 240 && img.naturalHeight >= 240 && box.width > 100 && box.height > 100 &&
      box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight &&
      style.visibility !== 'hidden' && style.display !== 'none' &&
      !/profile picture/i.test(img.alt || '');
  }).map(img => {
    const sizes = (img.getAttribute('srcset') || '').split(',').map(part => {
      const [url, width] = part.trim().split(/\s+/); return { url, width: Number.parseInt(width) || 0 };
    }).filter(item => item.url?.startsWith('https://')).sort((a, b) => b.width - a.width);
    return { url: sizes[0]?.url || img.currentSrc || img.src, alt: img.alt || '', width: img.naturalWidth, height: img.naturalHeight };
  });
  const unique = candidates.filter((image, i) => candidates.findIndex(other => other.url === image.url) === i);
  if (!unique.length) throw new Error('No loaded photo found. Wait for the image, keep it visible, and try again.');
  const time = root.querySelector('time[datetime]');
  const caption = root.querySelector('h1')?.innerText?.trim() || '';
  return {
    kind: 'post', postId, postUrl: `https://www.instagram.com/p/${postId}/`, caption,
    date: time?.getAttribute('datetime') || '', candidates: unique,
    warnings: [!caption && 'Caption was not found. Paste the complete caption, or confirm that it is intentionally empty.',
      !time && 'Post date was not found. Enter its ISO date and time.',
      unique.length > 1 && 'Several images are visible. Select the correct current carousel photo.'].filter(Boolean),
  };
})()

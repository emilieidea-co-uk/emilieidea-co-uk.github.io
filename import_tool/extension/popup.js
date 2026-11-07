import { addCapture, validatePost, isMediaUrl } from './lib/model.mjs';
import { exportQueue } from './lib/export.mjs';
const $ = id => document.getElementById(id);
let queue = [], snapshot, busy = false;
const status = message => { $('status').textContent = message; };
async function save() { await chrome.storage.local.set({ queue, category: $('category').value }); renderQueue(); }
function renderQueue() {
  $('queue-summary').textContent = `${queue.length} posts · ${queue.reduce((sum, post) => sum + post.images.length, 0)} photos selected`;
  $('queue').replaceChildren();
  for (const post of queue) {
    const li = document.createElement('li');
    const description = document.createElement('span');
    let completeness;
    try { validatePost(post); completeness = 'complete'; } catch { completeness = 'incomplete'; }
    description.textContent = `${post.postId} · ${post.category} · positions ${post.images.map(image => image.imageIndex).join(', ')} of ${post.imageCount} · ${completeness}`;
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = 'Remove post';
    remove.addEventListener('click', () => run(async () => {
      queue = queue.filter(item => item.postId !== post.postId); await save(); status('Post removed. You can capture it again.');
    }));
    li.append(description, remove); $('queue').append(li);
  }
}
async function run(action) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button').forEach(button => { button.disabled = true; });
  try { await action(); } catch (error) { status(error.message || String(error)); }
  finally { busy = false; document.querySelectorAll('button').forEach(button => { button.disabled = false; }); }
}
async function refresh() {
  const previous = $('source-tab').value;
  const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
  $('source-tab').replaceChildren();
  for (const tab of tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))) {
    const option = document.createElement('option'); option.value = String(tab.id); option.textContent = tab.title || tab.url;
    $('source-tab').append(option);
  }
  if (tabs.some(tab => String(tab.id) === previous)) $('source-tab').value = previous;
  if (!tabs.length) status('Open Instagram in another Chrome tab, then click Refresh tabs.');
}
function preview() {
  const image = snapshot?.candidates[Number($('candidate').value)];
  $('preview').src = image?.url || '';
  $('reviewed').checked = false;
}
$('refresh').addEventListener('click', () => run(refresh));
$('read').addEventListener('click', () => run(async () => {
  snapshot = undefined; $('editor').hidden = true; $('profile').hidden = true;
  const tabId = Number($('source-tab').value);
  if (!tabId) throw new Error('Open an Instagram post and refresh the tab list first.');
  const [result] = await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  if (!result?.result) throw new Error('Instagram could not be read. Open a photo post and try again.');
  if (result.result.kind === 'profile') {
    const profile = result.result;
    const categories = { emilie_idea_embroideries: 'embroideries', eco_zhonglaise: 'scrapingby', emilieidea_zugou: 'artworks' };
    if (categories[profile.username]) $('category').value = categories[profile.username];
    $('profile-name').textContent = `@${profile.username} · ${profile.posts.length} loaded photo posts`;
    $('profile-posts').replaceChildren();
    for (const post of profile.posts) {
      const li = document.createElement('li');
      const label = document.createElement('span'); label.textContent = post.postId + (queue.some(item => item.postId === post.postId) ? ' · in selection' : '');
      if (isMediaUrl(post.thumbnail)) {
        const thumbnail = document.createElement('img'); thumbnail.src = post.thumbnail;
        thumbnail.alt = 'Post thumbnail'; thumbnail.className = 'profile-thumbnail'; thumbnail.referrerPolicy = 'no-referrer'; li.append(thumbnail);
      }
      const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open post';
      open.addEventListener('click', () => run(async () => {
        await chrome.tabs.update(tabId, { url: post.postUrl, active: true });
        status('Post opened in Instagram. Return to this workspace and click Read Instagram tab once the photo has loaded.');
      }));
      li.append(label, open); $('profile-posts').append(li);
    }
    $('profile').hidden = false;
    status('Choose a post to open. Its caption and photos will be read from the individual post page.');
    return;
  }
  snapshot = result.result;
  const existing = queue.find(post => post.postId === snapshot.postId);
  $('post-url').textContent = snapshot.postUrl;
  $('warnings').textContent = snapshot.warnings.join('\n');
  $('caption').value = existing?.caption ?? snapshot.caption;
  $('date').value = existing?.date || snapshot.date;
  $('category').value = existing?.category || $('category').value;
  $('image-count').value = existing?.imageCount || 1;
  $('image-index').value = existing ? Math.min(existing.imageCount, Math.max(...existing.images.map(image => image.imageIndex)) + 1) : 1;
  $('candidate').replaceChildren();
  snapshot.candidates.forEach((candidate, index) => {
    const option = document.createElement('option'); option.value = String(index);
    option.textContent = `Photo ${index + 1}: ${candidate.width} × ${candidate.height} — ${candidate.alt.slice(0, 100)}`;
    $('candidate').append(option);
  });
  preview(); $('editor').hidden = false;
  status('Review the preview and metadata. For a carousel, enter the original photo position and total.');
}));
$('candidate').addEventListener('change', preview);
for (const id of ['category', 'image-index', 'image-count', 'caption', 'date']) {
  $(id).addEventListener('input', () => { $('reviewed').checked = false; });
}
$('capture').addEventListener('click', () => run(async () => {
  if (!snapshot || !$('reviewed').checked) throw new Error('Review the photo and metadata, then tick the confirmation.');
  const post = { postId: snapshot.postId, postUrl: snapshot.postUrl, category: $('category').value,
    caption: $('caption').value, date: $('date').value.trim(), imageCount: Number($('image-count').value) };
  const image = { imageIndex: Number($('image-index').value), url: snapshot.candidates[Number($('candidate').value)].url };
  queue = addCapture(queue, post, image);
  await save(); $('reviewed').checked = false;
  status('Image captured. For the next carousel photo, switch to Instagram, advance the carousel, then read that tab again.');
}));
$('clear').addEventListener('click', () => run(async () => {
  if (queue.length && !confirm('Clear all selected posts? Downloaded ZIPs are unaffected.')) return;
  queue = []; await save(); status('Selection cleared.');
}));
$('export').addEventListener('click', () => run(async () => {
  const bytes = await exportQueue(queue, { progress: status });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  let downloadId;
  const cleanup = change => {
    if (change.id === downloadId && ['complete', 'interrupted'].includes(change.state?.current)) {
      URL.revokeObjectURL(url); chrome.downloads.onChanged.removeListener(cleanup);
      status(change.state.current === 'complete' ? 'ZIP downloaded. Run the local importer next. Your selection has been kept.' : 'ZIP download interrupted. Your selection has been kept; retry Download ZIP.');
    }
  };
  chrome.downloads.onChanged.addListener(cleanup);
  try {
    downloadId = await chrome.downloads.download({ url, filename: 'instagram-export.zip', saveAs: true });
    status('ZIP download started. Keep this workspace open until it finishes. Run the local importer after downloading.');
  } catch (error) { URL.revokeObjectURL(url); chrome.downloads.onChanged.removeListener(cleanup); throw error; }
}));
await run(async () => {
  const saved = await chrome.storage.local.get(['queue', 'category']);
  queue = Array.isArray(saved.queue) ? saved.queue : [];
  if (['artworks', 'scrapingby', 'embroideries'].includes(saved.category)) $('category').value = saved.category;
  renderQueue(); await refresh();
});

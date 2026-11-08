import { addPost, validatePost, isMediaUrl, parsePostUrl, captureManualPhoto, removeManualPhoto } from './lib/model.mjs';
import { exportQueue } from './lib/export.mjs';
import { importLog, redactDiagnostics } from './lib/diagnostics.mjs';
const $ = id => document.getElementById(id);
let queue = [], draft, draftTabId, activeJob, currentRead, selectedCandidate, lastDiagnostics, busy = false;
const status = message => { $('status').textContent = message; importLog('status', { message }); };
function buttons() {
  document.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  $('cancel').hidden = !activeJob;
  $('cancel').disabled = !activeJob || Boolean(activeJob.cancelRequested);
  $('capture').disabled = busy || !draft?.complete || !$('reviewed').checked;
  $('capture-photo').disabled = busy || !selectedCandidate || !draft || draft.mode !== 'manual';
  $('copy-diagnostics').disabled = busy || !lastDiagnostics;
}
async function run(action) {
  if (busy) return;
  busy = true; buttons();
  try { await action(); } catch (error) { importLog('action-failed', { postId: draft?.postId, sourceTab: $('source-tab').value, message: error.message, stack: error.stack }, 'error'); status(error.message || String(error)); }
  finally { busy = false; buttons(); }
}
async function save(next = queue) {
  await chrome.storage.local.set({ queue: next, category: $('category').value });
  queue = next; renderQueue();
}
function thumbnails(container, images, previewImage, removeImage) {
  container.replaceChildren();
  for (const image of images) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'photo-thumbnail';
    button.disabled = busy; button.setAttribute('aria-label', `Preview photo ${image.imageIndex}`);
    const img = document.createElement('img'); img.alt = `Photo ${image.imageIndex}`; img.referrerPolicy = 'no-referrer';
    if (isMediaUrl(image.url)) img.src = image.url;
    const number = document.createElement('span'); number.textContent = String(image.imageIndex);
    button.append(img, number);
    button.addEventListener('click', () => previewImage(image));
    if (removeImage) {
      const cell = document.createElement('div'); cell.className = 'photo-cell';
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = `Remove photo ${image.imageIndex}`;
      remove.addEventListener('click', () => removeImage(image)); cell.append(button, remove); container.append(cell);
    } else container.append(button);
  }
}
function previewImage(image, count) {
  if (!isMediaUrl(image.url)) return;
  $('preview').src = image.url; $('preview').hidden = false;
  $('preview-position').textContent = `Photo ${image.imageIndex}${count ? ` / ${count}` : ''}`;
}
function renderDraft() {
  $('editor').hidden = !draft;
  if (!draft) return;
  $('post-url').textContent = draft.postUrl;
  const count = draft.images.length, expected = draft.complete ? draft.imageCount : draft.expectedCount;
  $('collection-summary').textContent = draft.complete ? `${count} photos · Complete — review against Instagram before adding.`
    : `${count}${expected ? ` / ${expected}` : ''} photos collected · Incomplete${draft.reason ? ` — ${draft.reason}` : ''}`;
  $('retry').hidden = draft.mode === 'manual' || draft.complete || Boolean(activeJob);
  $('manual-review').hidden = draft.mode !== 'manual';
  $('warnings').textContent = [!$('caption').value && 'Caption not found or empty. Paste the complete caption, or confirm that it is intentionally empty.',
    !$('date').value && 'Enter the post date and time in ISO format.'].filter(Boolean).join('\n');
  thumbnails($('photos'), draft.images, image => previewImage(image, expected), draft.mode === 'manual' ? image => {
    draft = removeManualPhoto(draft, image.imageIndex); $('reviewed').checked = false;
    importLog('remove-draft-photo', { postId: draft.postId, position: image.imageIndex }); renderDraft();
  } : undefined);
  if (!draft.images.length && !selectedCandidate) { $('preview').hidden = true; $('preview-position').textContent = ''; }
  buttons();
}
function renderQueue() {
  $('queue-summary').textContent = `${queue.length} posts · ${queue.reduce((sum, post) => sum + post.images.length, 0)} photos selected`;
  $('queue').replaceChildren();
  for (const post of queue) {
    const li = document.createElement('li'), description = document.createElement('p');
    let completeness;
    try { validatePost(post); completeness = 'complete'; } catch { completeness = 'incomplete — rescan this post'; }
    description.textContent = `${post.postId} · ${post.category} · ${post.images.length} / ${post.imageCount} photos · ${completeness}`;
    const grid = document.createElement('div'); grid.className = 'photo-grid';
    const preview = document.createElement('img'); preview.className = 'queue-preview'; preview.hidden = true; preview.referrerPolicy = 'no-referrer';
    thumbnails(grid, post.images, image => { if (isMediaUrl(image.url)) { preview.src = image.url; preview.alt = `Photo ${image.imageIndex}`; preview.hidden = false; } });
    const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open post to rescan';
    open.addEventListener('click', () => run(() => openPost(post.postUrl)));
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove post';
    remove.addEventListener('click', () => run(async () => { await save(queue.filter(item => item.postId !== post.postId)); status('Post removed.'); }));
    li.append(description, grid, preview, open, remove); $('queue').append(li);
  }
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
async function openPost(url) {
  parsePostUrl(url);
  const tabId = Number($('source-tab').value);
  if (tabId) await chrome.tabs.update(tabId, { url, active: true });
  else { const tab = await chrome.tabs.create({ url }); await refresh(); $('source-tab').value = String(tab.id); }
  status('Post opened in Instagram. Keep its photo in view, then return here and click Read current photo / profile.');
}
function readProfile(profile) {
  draft = undefined; draftTabId = undefined; currentRead = undefined; selectedCandidate = undefined; $('reviewed').checked = false; $('editor').hidden = true;
  const categories = { emilie_idea_embroideries: 'embroideries', eco_zhonglaise: 'scrapingby', emilieidea_zugou: 'artworks' };
  if (categories[profile.username]) $('category').value = categories[profile.username];
  $('profile-name').textContent = `@${profile.username} · ${profile.posts.length} loaded photo posts`;
  $('profile-posts').replaceChildren();
  for (const post of profile.posts) {
    const li = document.createElement('li'), label = document.createElement('span');
    label.textContent = post.postId + (queue.some(item => item.postId === post.postId) ? ' · in selection' : '');
    if (isMediaUrl(post.thumbnail)) {
      const image = document.createElement('img'); image.src = post.thumbnail; image.alt = 'Post thumbnail'; image.className = 'profile-thumbnail'; image.referrerPolicy = 'no-referrer'; li.append(image);
    }
    const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open post';
    open.addEventListener('click', () => run(() => openPost(post.postUrl)));
    li.append(label, open); $('profile-posts').append(li);
  }
  $('profile').hidden = false; status('Choose a post. Read the current photo, capture it, and advance Instagram manually.');
}
function allowSwitch(postId) {
  return !draft || draft.postId === postId || !draft.images.length || confirm('Discard the unfinished draft before reading another post? Export queue entries will be kept.');
}
function recomputeManual() {
  if (!draft || draft.mode !== 'manual') return;
  const count = Number($('image-count').value);
  draft.imageCount = count; draft.expectedCount = Number.isInteger(count) && count > 0 ? count : undefined;
  draft.complete = Number.isInteger(count) && count > 0 && count <= 100 && draft.images.length === count &&
    draft.images.every((image, index) => image.imageIndex === index + 1);
}
async function getCurrentPhoto(tabId, post, diagnosticsOnly = false) {
  importLog('read-current-start', { sourceTab: tabId, postId: post.postId, diagnosticsOnly });
  await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/photo-reader.js'] });
  const [response] = await chrome.scripting.executeScript({ target: { tabId }, func: options => globalThis.__eiPhotoReader.snapshot(options), args: [{ postId: post.postId, diagnosticsOnly }] });
  if (!response?.result) throw new Error('No photo-reader response. Reload the Instagram tab and try again.');
  const result = response.result;
  lastDiagnostics = importLog('current-photo-report', { sourceTab: tabId, ...result.diagnostics }, result.ok ? 'info' : 'error');
  return result;
}
async function readManual(tabId, post) {
  if (!allowSwitch(post.postId)) return;
  selectedCandidate = undefined; currentRead = undefined; $('candidates').replaceChildren(); $('preview').hidden = true;
  const result = await getCurrentPhoto(tabId, post);
  if (!result.ok) throw new Error(result.reason);
  const samePost = draft?.postId === post.postId;
  const retained = samePost ? { caption: $('caption').value, date: $('date').value, category: $('category').value } : queue.find(item => item.postId === post.postId);
  if (!samePost) draft = { postId: post.postId, postUrl: post.postUrl,
    images: retained?.images?.map(image => ({ ...image })) || [], imageCount: retained?.imageCount, expectedCount: retained?.imageCount, complete: false };
  draft = { ...draft, mode: 'manual', reason: undefined };
  draftTabId = tabId; currentRead = result;
  $('caption').value = retained?.caption ?? result.caption ?? '';
  $('date').value = retained?.date ?? result.date ?? '';
  $('category').value = retained?.category ?? $('category').value;
  $('image-index').value = result.position ?? '';
  $('image-count').value = result.total ?? draft.expectedCount ?? (draft.imageCount > 0 ? draft.imageCount : '');
  $('reviewed').checked = false;
  selectedCandidate = result.candidates.find(item => item.candidateId === result.selectedId);
  const select = candidate => {
    selectedCandidate = candidate; previewImage(candidate); $('reviewed').checked = false;
    importLog('choose-candidate', { postId: post.postId, candidateId: candidate.candidateId, asset: candidate.url }); buttons();
  };
  thumbnails($('candidates'), result.candidates.map((item, index) => ({ ...item, imageIndex: index + 1 })), select);
  $('selection-reason').textContent = `${result.reason}. Check the preview before capturing.${selectedCandidate ? '' : ' Choose the correct candidate thumbnail.'}`;
  if (selectedCandidate) previewImage(selectedCandidate);
  else { $('preview').hidden = true; $('preview-position').textContent = 'Choose the displayed photo from the candidates.'; }
  recomputeManual(); renderDraft();
  status('Current photo read without moving Instagram. Check its preview and enter its original position and the post total, then Capture this photo.');
}

async function collect(tabId, initial) {
  if (!allowSwitch(initial.postId)) return;
  if (draft?.images.length && draft.mode === 'manual' && !confirm('Replace this manual draft with a new automatic scan?')) return;
  currentRead = undefined; selectedCandidate = undefined;
  const retained = draft?.postId === initial.postId ? { caption: $('caption').value, date: $('date').value, category: $('category').value }
    : queue.find(post => post.postId === initial.postId);
  $('caption').value = retained?.caption ?? initial.caption ?? '';
  $('date').value = retained?.date || initial.date || '';
  $('category').value = retained?.category || $('category').value;
  $('reviewed').checked = false;
  draft = { ...initial, images: [], complete: false, mode: 'automatic' }; draftTabId = tabId;
  const jobId = crypto.randomUUID(); activeJob = { jobId, tabId, postId: initial.postId };
  renderDraft(); status('Collecting all photos. Instagram will come to the front.');
  let workspace;
  try {
    workspace = await chrome.tabs.getCurrent();
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/photo-reader.js', 'lib/scanner.js'] });
    if (activeJob.cancelRequested) { draft.reason = 'Collection cancelled.'; return; }
    await chrome.tabs.update(tabId, { active: true });
    if (activeJob.cancelRequested) { draft.reason = 'Collection cancelled.'; return; }
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: options => globalThis.__eiScanner.run(options), args: [{ jobId, postId: initial.postId }] });
    if (!result?.result) throw new Error('Instagram did not return a scan result. Retry after reopening the post.');
    draft = { ...result.result, mode: 'automatic' };
    importLog(draft.complete ? 'automatic-complete' : 'automatic-failed', { postId: initial.postId, count: draft.images.length, error: draft.error }, draft.complete ? 'info' : 'error');
    if (!$('caption').value && draft.caption) $('caption').value = draft.caption;
    if (!$('date').value && draft.date) $('date').value = draft.date;
    status(draft.complete ? `Collected all ${draft.imageCount} photos. Review the numbered thumbnails, caption, date, and total, then add the post.` : draft.reason);
  } catch (error) {
    importLog('automatic-failed', { postId: initial.postId, message: error.message, stack: error.stack }, 'error');
    draft.complete = false; draft.reason = error.message || String(error); status(`Collection incomplete: ${draft.reason}`);
  } finally {
    activeJob = undefined; renderDraft();
    if (workspace?.id) {
      try {
        const [active] = await chrome.tabs.query({ active: true, windowId: workspace.windowId });
        if (active?.id === tabId) await chrome.tabs.update(workspace.id, { active: true });
      } catch { /* A closed window must not discard the collected result. */ }
    }
  }
}
chrome.runtime.onMessage.addListener((message, sender) => {
  if (!activeJob || sender.id !== chrome.runtime.id || sender.tab?.id !== activeJob.tabId ||
      !['scan-progress', 'scan-log'].includes(message.type) || message.jobId !== activeJob.jobId || message.postId !== activeJob.postId) return;
  if (message.type === 'scan-log') { importLog(message.operation, message.data, message.level === 'error' ? 'error' : 'info'); return; }
  if (activeJob.cancelRequested) return;
  draft = { ...draft, images: message.images, expectedCount: message.expectedCount, complete: false };
  renderDraft(); status(`${message.phase === 'rewinding' ? 'Finding the first photo' : message.phase === 'loading' ? 'Waiting for the photo' : `Collected ${message.images.length} photos`}…`);
});
$('cancel').addEventListener('click', async () => {
  if (!activeJob) return;
  const job = activeJob;
  job.cancelRequested = true; buttons();
  status('Cancelling collection…');
  // The scan listener can be installed just after cancellation is requested.
  // Retry briefly so a click during script startup is not lost.
  for (let attempt = 0; attempt < 15 && activeJob === job; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(job.tabId, { type: 'cancel-scan', jobId: job.jobId });
      if (response?.cancelled) return;
    } catch { /* The scanner may still be installing its listener. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
});
$('refresh').addEventListener('click', () => run(refresh));
$('read').addEventListener('click', () => run(async () => {
  $('profile').hidden = true;
  const tabId = Number($('source-tab').value);
  if (!tabId) throw new Error('Open an Instagram profile or post and refresh the tab list first.');
  const tab = await chrome.tabs.get(tabId);
  let post;
  try { post = parsePostUrl(tab.url); } catch { /* A profile is read with the existing profile extractor. */ }
  if (post) {
    await readManual(tabId, post);
  } else {
    const [response] = await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    if (!response?.result || response.result.kind !== 'profile') throw new Error('Open an Instagram profile or a photo post.');
    if (allowSwitch('profile')) readProfile(response.result);
  }
}));
$('auto').addEventListener('click', () => run(async () => {
  const tabId = Number($('source-tab').value);
  if (!tabId) throw new Error('Choose an Instagram post tab first.');
  const post = parsePostUrl((await chrome.tabs.get(tabId)).url);
  await collect(tabId, { ...post, caption: '', date: '' });
}));
$('diagnose').addEventListener('click', () => run(async () => {
  const tabId = Number($('source-tab').value);
  const post = parsePostUrl((await chrome.tabs.get(tabId)).url);
  await getCurrentPhoto(tabId, post, true);
  status('Diagnostics printed in this workspace’s Console and the Instagram tab’s Console. Use Copy diagnostics to share the report.');
}));
$('copy-diagnostics').addEventListener('click', () => run(async () => {
  if (!lastDiagnostics) return;
  const report = JSON.stringify(redactDiagnostics(lastDiagnostics), null, 2);
  try { await navigator.clipboard.writeText(report); status('Diagnostics copied.'); }
  catch (error) {
    importLog('clipboard-fallback', { message: error.message }, 'warn');
    $('diagnostics-output').value = report; $('diagnostics-fallback').hidden = false;
    $('diagnostics-output').focus(); $('diagnostics-output').select(); status('Select and copy the diagnostics below.');
  }
}));
$('capture-photo').addEventListener('click', () => run(async () => {
  if (!draft || draft.mode !== 'manual' || !selectedCandidate || currentRead?.postId !== draft.postId) throw new Error('Read and preview the current photo first.');
  const next = captureManualPhoto(draft, selectedCandidate, Number($('image-index').value), Number($('image-count').value));
  importLog('capture-photo', { postId: next.postId, position: Number($('image-index').value), total: next.imageCount, asset: selectedCandidate.url });
  draft = next; $('reviewed').checked = false; renderDraft();
  status(`Captured position ${$('image-index').value}. Click Instagram’s next arrow yourself, then Read current photo / profile again.`);
}));
$('retry').addEventListener('click', () => run(async () => {
  if (!draft || !draftTabId) return;
  await collect(draftTabId, draft);
}));
for (const id of ['category', 'caption', 'date', 'reviewed', 'image-index', 'image-count']) $(id).addEventListener('input', () => {
  if (id !== 'reviewed') $('reviewed').checked = false;
  if (id === 'image-count') { recomputeManual(); renderDraft(); }
  buttons();
});
$('capture').addEventListener('click', () => run(async () => {
  if (!draft?.complete || !$('reviewed').checked) throw new Error('Collect the complete post and confirm the review first.');
  const post = { ...draft, category: $('category').value, caption: $('caption').value, date: $('date').value.trim() };
  const existing = queue.some(item => item.postId === post.postId);
  if (existing && !confirm('Replace the queued photos and metadata for this post with the reviewed collection?')) return;
  await save(addPost(queue, post, { replace: existing }));
  $('reviewed').checked = false;
  status(`Added the complete post with ${post.imageCount} photos. Download ZIP when your selection is ready.`);
}));
$('clear').addEventListener('click', () => run(async () => {
  if (queue.length && !confirm('Clear all selected posts? Downloaded ZIPs are unaffected.')) return;
  await save([]); status('Selection cleared.');
}));
$('export').addEventListener('click', () => run(async () => {
  const bytes = await exportQueue(queue, { progress: status });
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  let downloadId;
  const cleanup = change => {
    if (change.id === downloadId && ['complete', 'interrupted'].includes(change.state?.current)) {
      URL.revokeObjectURL(url); chrome.downloads.onChanged.removeListener(cleanup);
      status(change.state.current === 'complete' ? 'ZIP downloaded. Run the local importer next. Your selection has been kept.' : 'ZIP download interrupted. Retry Download ZIP.');
    }
  };
  chrome.downloads.onChanged.addListener(cleanup);
  try {
    downloadId = await chrome.downloads.download({ url, filename: 'instagram-export.zip', saveAs: true });
    status('ZIP download started. Keep this workspace open until it finishes.');
  } catch (error) { URL.revokeObjectURL(url); chrome.downloads.onChanged.removeListener(cleanup); throw error; }
}));
await run(async () => {
  const saved = await chrome.storage.local.get(['queue', 'category']);
  queue = Array.isArray(saved.queue) ? saved.queue : [];
  if (['artworks', 'scrapingby', 'embroideries'].includes(saved.category)) $('category').value = saved.category;
  const version = chrome.runtime.getManifest?.().version || '0.3.0';
  importLog('workspace-start', { extensionVersion: version, workflow: 'manual-first' });
  renderQueue(); await refresh();
});

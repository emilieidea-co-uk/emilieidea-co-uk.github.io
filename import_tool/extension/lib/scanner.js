// Isolated content-script library. Uses the rendered post and its own controls;
// no Instagram private API, embedded account data, or background profile crawl.
(() => {
  if (globalThis.__eiScanner?.version === 2) return;
  if (globalThis.__eiScanner) throw new Error('An older scanner is still loaded. Reload the Instagram tab before using automatic collection.');
  let activeJob;
  const sourceId = () => location.pathname.match(/^(?:\/[A-Za-z0-9_.]+)?\/p\/([\w-]+)\/?$/)?.[1];
  const assetKey = url => { const value = new URL(url); return value.pathname; };
  const allowedUrl = url => {
    try { const value = new URL(url); return value.protocol === 'https:' && !value.username && !value.password &&
      ['cdninstagram.com', 'fbcdn.net'].some(domain => value.hostname === domain || value.hostname.endsWith(`.${domain}`)); }
    catch { return false; }
  };
  function visibleBox(element) {
    const original = element.getBoundingClientRect();
    let box = { left: Math.max(0, original.left), top: Math.max(0, original.top), right: Math.min(innerWidth, original.right), bottom: Math.min(innerHeight, original.bottom) };
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return null;
      if (node !== element) {
        const rect = node.getBoundingClientRect();
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) { box.left = Math.max(box.left, rect.left); box.right = Math.min(box.right, rect.right); }
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) { box.top = Math.max(box.top, rect.top); box.bottom = Math.min(box.bottom, rect.bottom); }
      }
    }
    return box.right > box.left && box.bottom > box.top ? { ...box, area: (box.right - box.left) * (box.bottom - box.top) } : null;
  }
  function readDom() {
    const postId = sourceId();
    if (!postId || location.hostname !== 'www.instagram.com') throw new Error('The Instagram tab left the selected photo post.');
    if (!globalThis.__eiPhotoReader) throw new Error('The photo reader is missing. Reload the extension and Instagram tab.');
    const inspected = globalThis.__eiPhotoReader.inspect();
    const { root, selected: current } = inspected;
    if (!current && inspected.eligible.length) throw new Error(inspected.reason);
    if (!current) return { postId, loaded: false };
    if (current.video) return { postId, video: true };
    if (inspected.inconsistent) throw new Error('The page reports inconsistent slide totals.');
    const controls = {};
    for (const node of root.querySelectorAll('button, [role="button"]')) {
      const label = (node.getAttribute('aria-label') || node.querySelector('svg[aria-label]')?.getAttribute('aria-label') || node.getAttribute('title') || '').trim().toLowerCase();
      const element = node.closest('button') || node, box = visibleBox(element);
      if (!box) continue;
      const x = (box.left + box.right) / 2, y = (box.top + box.bottom) / 2;
      if (x < current.rect.left - 60 || x > current.rect.right + 60 || Math.abs(y - (current.rect.top + current.rect.bottom) / 2) > current.rect.height * .4) continue;
      const direction = /^(next|next photo|next image|next slide|go to next slide|下一张|下一頁|下一页)$/.test(label) ? 'next'
        : /^(previous|previous photo|previous image|previous slide|go back|back|go to previous slide|上一张|上一頁|上一页)$/.test(label) ? 'prev' : null;
      if (!direction) {
        if (Math.min(Math.abs(x - current.rect.left), Math.abs(x - current.rect.right)) < 60 && box.right - box.left < 100) {
          throw new Error('An unrecognised control is beside the photo. This Instagram layout cannot yet be scanned safely.');
        }
        continue;
      }
      if (controls[direction] && controls[direction].element !== element) throw new Error('Carousel controls are ambiguous. Open the post on its own, then retry.');
      controls[direction] = { element, enabled: !element.disabled && element.getAttribute('aria-disabled') !== 'true' };
    }
    const { position, total, minimumCount } = inspected;
    return {
      postId, postUrl: `https://www.instagram.com/p/${postId}/`,
      caption: root.querySelector('h1')?.innerText?.trim() || '', date: root.querySelector('time[datetime]')?.getAttribute('datetime') || '',
      loaded: current.loaded,
      key: current.key, image: { url: current.url, alt: current.element.alt || '', width: current.element.naturalWidth, height: current.element.naturalHeight },
      prev: Boolean(controls.prev?.enabled), next: Boolean(controls.next?.enabled), controls, position, total, minimumCount,
    };
  }
  function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new Error('Collection cancelled.')); return; }
      const cancel = () => { clearTimeout(timer); reject(new Error('Collection cancelled.')); };
      const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
      signal?.addEventListener('abort', cancel, { once: true });
    });
  }
  async function scanCarousel({ postId, read = readDom, step = direction => {
    const state = readDom();
    if (state.postId !== postId || !state.controls?.[direction]?.enabled) throw new Error('The carousel control changed before it could be clicked. Retry the scan.');
    state.controls[direction].element.click();
  }, signal, progress = () => {}, now = Date.now, wait = sleep, transitionMs = 12000, overallMs = 120000, stableMs = 450 }) {
    const images = [], started = now();
    let metadata = {}, expectedTotal, minimumCount = 1;
    const check = () => {
      if (signal?.aborted) throw new Error('Collection cancelled.');
      if (now() - started >= overallMs) throw new Error('Collection exceeded two minutes. Retry with the post open at its first photo.');
    };
    const readChecked = () => {
      check();
      const state = read();
      if (state.postId !== postId) throw new Error('The Instagram tab changed to another post. Collection stopped.');
      if (state.video) throw new Error('This is a mixed or video post. Only complete photo-only posts can be collected.');
      if (state.total !== undefined) {
        if (!Number.isInteger(state.total) || state.total < 1 || state.total > 100 || (expectedTotal !== undefined && state.total !== expectedTotal)) throw new Error('The carousel total is invalid or changed during collection.');
        expectedTotal = state.total;
      }
      minimumCount = Math.max(minimumCount, state.minimumCount || 1);
      if (minimumCount > 100) throw new Error('This post exceeds the 100-photo limit.');
      if (state.caption !== undefined) metadata.caption ??= state.caption;
      if (state.date) metadata.date ??= state.date;
      return state;
    };
    const settle = async previousKey => {
      const began = now();
      let signature, since;
      while (now() - began < transitionMs) {
        const state = readChecked();
        if (state.loaded && state.image?.url && state.key && (!previousKey || state.key !== previousKey)) {
          const nextSignature = JSON.stringify([state.key, state.prev, state.next, state.position, state.total]);
          if (signature !== nextSignature) { signature = nextSignature; since = now(); }
          if (now() - since >= stableMs) return state;
        } else { signature = undefined; since = undefined; }
        await wait(150, signal);
      }
      throw new Error('A photo did not load or the carousel did not advance within 12 seconds. Retry; the partial post cannot be exported.');
    };
    const report = phase => progress({ phase, postId, images: images.map(image => ({ ...image })), expectedCount: expectedTotal });
    try {
      report('loading');
      let state = await settle();
      const rewindSeen = new Set();
      while (state.prev) {
        if (rewindSeen.has(state.key) || rewindSeen.size >= 100) throw new Error('The carousel repeated while rewinding.');
        rewindSeen.add(state.key); report('rewinding');
        check(); await step('prev'); state = await settle(state.key);
      }
      if (state.position !== undefined && state.position !== 1) throw new Error('Could not reach the first photo. No complete post was collected.');
      const seen = new Set();
      for (;;) {
        check();
        if (seen.has(state.key)) throw new Error('The carousel repeated a photo instead of advancing.');
        if (state.position !== undefined && state.position !== images.length + 1) throw new Error('The carousel skipped or repeated a photo position.');
        if (images.length >= 100) throw new Error('This post exceeds the 100-photo limit.');
        seen.add(state.key);
        images.push({ ...state.image, imageIndex: images.length + 1 }); report('collecting');
        if (!state.next) {
          if (images.length < minimumCount || (expectedTotal !== undefined && images.length !== expectedTotal) || (images.length > 1 && !state.prev)) throw new Error('The final carousel boundary is missing or the photo count does not match. Retry before exporting.');
          break;
        }
        check(); await step('next'); state = await settle(state.key);
      }
      return { complete: true, postId, postUrl: `https://www.instagram.com/p/${postId}/`, ...metadata, imageCount: images.length, images };
    } catch (error) {
      return { complete: false, postId, postUrl: `https://www.instagram.com/p/${postId}/`, ...metadata, images, expectedCount: expectedTotal,
        reason: error.message || String(error), error: { message: error.message, stack: error.stack }, cancelled: Boolean(signal?.aborted) };
    }
  }
  async function run({ jobId, postId }) {
    if (activeJob) throw new Error('A collection is already running in this Instagram tab. Cancel it or wait for it to finish.');
    const controller = new AbortController(); activeJob = jobId;
    const listener = (message, sender, respond) => {
      if (sender.id === chrome.runtime.id && message.type === 'cancel-scan' && message.jobId === jobId) { controller.abort(); respond({ cancelled: true }); }
    };
    chrome.runtime.onMessage.addListener(listener);
    const trace = (operation, data, level = 'info') => {
      console[level]('[EmilieIdea Import]', operation, data);
      chrome.runtime.sendMessage({ type: 'scan-log', jobId, postId, operation, level, data }).catch(() => {});
    };
    const progress = data => {
      trace('automatic-scan-progress', { phase: data.phase, postId, photos: data.images.length, expectedCount: data.expectedCount });
      chrome.runtime.sendMessage({ type: 'scan-progress', jobId, ...data }).catch(() => {});
    };
    trace('automatic-scan-start', { postId, scannerVersion: 2 });
    try {
      const result = await scanCarousel({ postId, signal: controller.signal, progress });
      trace(result.complete ? 'automatic-scan-complete' : 'automatic-scan-failed', { postId, count: result.images.length, error: result.error }, result.complete ? 'info' : 'error');
      return result;
    }
    finally { chrome.runtime.onMessage.removeListener(listener); activeJob = undefined; }
  }
  globalThis.__eiScanner = { version: 2, run, scanCarousel, readDom, assetKey };
})();

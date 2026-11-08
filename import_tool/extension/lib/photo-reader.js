// Read-only helper. This code never clicks arrows or changes carousel position.
(() => {
  const VERSION = '0.3.0-reader-1';
  if (globalThis.__eiPhotoReader?.version === VERSION) return;
  const PREFIX = '[EmilieIdea Import]';
  const assetKey = value => new URL(value).pathname;
  const safeUrl = value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return ''; } };
  const allowed = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && ['cdninstagram.com', 'fbcdn.net'].some(host => u.hostname === host || u.hostname.endsWith(`.${host}`)); } catch { return false; } };
  const sourceId = () => location.pathname.match(/^(?:\/[A-Za-z0-9_.]+)?\/p\/([\w-]+)\/?$/)?.[1];
  const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
  function visibility(element) {
    const original = rect(element);
    const box = { left: Math.max(0, original.left), top: Math.max(0, original.top), right: Math.min(innerWidth, original.right), bottom: Math.min(innerHeight, original.bottom) };
    let active = false;
    for (let node = element; node; node = node.parentElement) {
      if (node.getAttribute?.('aria-hidden') === 'true' || node.hasAttribute?.('inert') || node.getAttribute?.('aria-selected') === 'false') return { reason: 'inactive ancestor', rect: original };
      active ||= ['true', 'page'].includes(node.getAttribute?.('aria-current')) || node.getAttribute?.('aria-selected') === 'true';
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return { reason: 'hidden by CSS', rect: original };
      if (node !== element) {
        const r = rect(node);
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX)) { box.left = Math.max(box.left, r.left); box.right = Math.min(box.right, r.right); }
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY)) { box.top = Math.max(box.top, r.top); box.bottom = Math.min(box.bottom, r.bottom); }
      }
    }
    const area = Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
    return { rect: original, box: { ...box, area }, active, reason: area ? '' : 'outside the clipped viewing area' };
  }
  function indicators(root, selected) {
    let position, total, minimumCount = 1;
    const pairs = [], labels = [];
    for (const node of root.querySelectorAll('[aria-label], [aria-posinset], [aria-setsize]')) {
      const label = (node.getAttribute('aria-label') || '').trim();
      const pair = label.match(/^(?:(?:photo|image|slide)\s+)?(\d+)\s*(?:of|\/)\s*(\d+)$/i);
      const slide = label.match(/^(?:go to )?(?:slide|photo|image)\s+(\d+)$/i);
      if (pair) { pairs.push({ position: Number(pair[1]), total: Number(pair[2]) }); labels.push(label); }
      if (slide) {
        minimumCount = Math.max(minimumCount, Number(slide[1])); labels.push(label);
        if (['true', 'page'].includes(node.getAttribute('aria-current')) || node.getAttribute('aria-selected') === 'true') position = Number(slide[1]);
      }
      const size = Number(node.getAttribute('aria-setsize'));
      if (size > 0) { total ??= size; minimumCount = Math.max(minimumCount, size); }
    }
    const totals = new Set(pairs.map(pair => pair.total));
    if (totals.size === 1) total = [...totals][0];
    if (new Set(pairs.map(pair => pair.position)).size === 1) position = pairs[0].position;
    for (let node = selected?.element; node && node !== root; node = node.parentElement) {
      const ownPosition = Number(node.getAttribute?.('aria-posinset'));
      if (ownPosition > 0) { position = ownPosition; break; }
    }
    return { position, total, minimumCount: Math.max(minimumCount, total || 1), labels, inconsistent: totals.size > 1 };
  }
  function inspect() {
    const postId = sourceId();
    if (!postId || location.hostname !== 'www.instagram.com') throw new Error('Open an individual Instagram photo post first.');
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(element => !visibility(element).reason);
    const dialog = dialogs[0] || document.querySelector('[role="dialog"]');
    const articles = [...(dialog || document).querySelectorAll('article')].filter(element => !visibility(element).reason);
    const matched = articles.find(article => [...article.querySelectorAll('a[href]')].some(a => a.getAttribute('href')?.includes(`/p/${postId}/`)));
    const root = matched || articles[0] || dialog || document.querySelector('main');
    if (!root) throw new Error('No post container was found. Let the post load and try again.');
    const candidates = [...root.querySelectorAll('img, video')].map((element, index) => {
      const geometry = visibility(element);
      const sizes = (element.getAttribute('srcset') || '').split(',').map(part => {
        const [url, width] = part.trim().split(/\s+/); return { url, width: Number.parseInt(width) || 0 };
      }).filter(item => allowed(item.url)).sort((a, b) => b.width - a.width);
      const displayed = element.currentSrc || element.src || '';
      const sameAsset = allowed(displayed) ? sizes.find(item => assetKey(item.url) === assetKey(displayed)) : undefined;
      const url = sameAsset?.url || displayed;
      const requested = [element.src, ...sizes.map(item => item.url)].filter(allowed);
      const stale = allowed(displayed) && requested.length > 0 && !requested.some(value => assetKey(value) === assetKey(displayed));
      let reason = geometry.reason;
      if (!reason && (geometry.rect.width < 200 || geometry.rect.height < 200 || /profile picture/i.test(element.alt || ''))) reason = 'small image or avatar';
      if (!reason && element.tagName !== 'VIDEO' && !allowed(url)) reason = 'unsupported image host';
      const loaded = element.tagName !== 'VIDEO' && Boolean(element.complete) && element.naturalWidth >= 240 && element.naturalHeight >= 240 && !stale;
      return { id: `candidate-${index + 1}`, element, ...geometry, reason, url, displayed, sizes, stale, loaded, key: allowed(url) ? assetKey(url) : '',
        video: element.tagName === 'VIDEO', paintVotes: 0, alt: element.alt || '', width: element.naturalWidth || 0, height: element.naturalHeight || 0 };
    });
    const eligible = candidates.filter(candidate => !candidate.reason);
    if (document.elementsFromPoint) {
      for (const candidate of eligible) {
        for (const fraction of [.3, .5, .7]) {
          const x = candidate.box.left + (candidate.box.right - candidate.box.left) * fraction;
          const y = (candidate.box.top + candidate.box.bottom) / 2;
          const stack = document.elementsFromPoint(x, y);
          for (const node of stack) {
            const painted = eligible.find(item => item.element === node || item.element.contains?.(node));
            if (painted) { painted.paintVotes++; break; }
          }
        }
      }
    }
    let pool = eligible;
    let reason = 'no visible photo found';
    if (pool.some(candidate => candidate.paintVotes > 0)) { pool = pool.filter(candidate => candidate.paintVotes === Math.max(...eligible.map(item => item.paintVotes))); reason = 'topmost painted media'; }
    if (pool.some(candidate => candidate.active)) { pool = pool.filter(candidate => candidate.active); reason += ' / active slide marker'; }
    pool = [...pool].sort((a, b) => b.box.area - a.box.area);
    let selected = pool[0];
    if (selected && pool.some(other => other !== selected && other.key !== selected.key && other.box.area >= selected.box.area * .85)) { selected = undefined; reason = 'ambiguous visible candidates — choose a preview'; }
    else if (selected && reason === 'no visible photo found') reason = 'uniquely largest clipped media';
    if (selected?.stale) reason = 'displayed source has not caught up with the requested image';
    if (selected?.video) reason = 'the current slide is a video';
    const info = indicators(root, selected);
    const report = {
      readerVersion: VERSION,
      extensionVersion: typeof chrome !== 'undefined' ? chrome.runtime?.getManifest?.().version || 'unknown' : 'test',
      scannerVersion: globalThis.__eiScanner?.version ?? 'not loaded', postId, root: matched ? 'matching article' : articles.length ? 'first article fallback' : dialog ? 'dialog' : 'main fallback',
      detectedPosition: info.position ?? null, detectedTotal: info.total ?? null, indicators: info.labels,
      selected: selected?.id ?? null, selectionReason: reason,
      candidates: candidates.map(candidate => ({ id: candidate.id, currentSrc: safeUrl(candidate.displayed), requestedSrc: safeUrl(candidate.element.src),
        srcset: candidate.sizes.map(item => safeUrl(item.url)), chosenAsset: safeUrl(candidate.url), width: candidate.width, height: candidate.height,
        rect: candidate.rect, clipped: candidate.box, active: candidate.active, paintVotes: candidate.paintVotes,
        loaded: candidate.loaded, stale: candidate.stale, rejection: candidate.reason || '' })),
    };
    return { postId, postUrl: `https://www.instagram.com/p/${postId}/`, root, candidates, eligible, selected, reason, report, ...info,
      caption: root.querySelector('h1')?.innerText?.trim() || '', date: root.querySelector('time[datetime]')?.getAttribute('datetime') || '' };
  }
  const log = report => {
    console.info(PREFIX, 'read-current-photo', report);
    console.table?.(report.candidates);
    if (!report.selected) console.warn(PREFIX, report.selectionReason);
  };
  async function snapshot({ postId, diagnosticsOnly = false } = {}) {
    let state;
    try {
      let signature, since = 0;
      const began = Date.now();
      do {
        state = inspect();
        if (postId && state.postId !== postId) throw new Error('The Instagram tab changed to another post.');
        const ready = state.selected?.loaded || state.selected?.video || (!state.selected && state.eligible.some(item => item.loaded));
        const current = `${state.selected?.key}|${state.position}|${state.selected?.loaded}`;
        if (current !== signature) { signature = current; since = Date.now(); }
        if (diagnosticsOnly || (ready && Date.now() - since >= 300)) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (Date.now() - began < 12000);
      log(state.report);
      const selected = state.selected;
      const painted = state.eligible.some(item => item.paintVotes > 0);
      const active = state.eligible.some(item => item.active);
      const choices = state.eligible.filter(item => item.loaded && !item.video && (!painted || item.paintVotes > 0) && (!active || item.active));
      const ok = choices.length > 0 && !selected?.video;
      const result = { ok, postId: state.postId, postUrl: state.postUrl, caption: state.caption, date: state.date,
        position: state.position, total: state.total, selectedId: selected?.loaded ? selected.id : null,
        candidates: choices.map(item => ({ candidateId: item.id, url: item.url, alt: item.alt, width: item.width, height: item.height })),
        diagnostics: state.report, reason: ok ? state.reason : selected?.video ? 'The displayed slide is a video; photo-only posts are supported.' : 'No loaded current photo was found. Check diagnostics and try again.' };
      if (!ok) console.error(PREFIX, 'read-current-photo failed', result.reason);
      return result;
    } catch (error) {
      const diagnostics = state?.report || { readerVersion: VERSION, postId: postId || sourceId(), candidates: [] };
      diagnostics.error = { message: error.message, stack: error.stack };
      console.error(PREFIX, 'read-current-photo failed', diagnostics);
      return { ok: false, postId: postId || sourceId(), candidates: [], diagnostics, reason: error.message };
    }
  }
  globalThis.__eiPhotoReader = { version: VERSION, inspect, snapshot, assetKey };
  console.info(PREFIX, `Photo reader installed: ${VERSION}`);
})();

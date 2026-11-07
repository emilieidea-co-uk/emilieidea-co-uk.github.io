chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('popup.html');
  const existing = await chrome.runtime.getContexts({ contextTypes: ['TAB'], documentUrls: [url] });
  if (existing.length) {
    await chrome.tabs.update(existing[0].tabId, { active: true });
    await chrome.windows.update(existing[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
});

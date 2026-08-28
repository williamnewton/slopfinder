// Background service worker: seeds default patterns into storage on install
// and mirrors each tab's cliché count onto the toolbar icon as a badge.

importScripts('patterns.js');

chrome.runtime.onInstalled.addListener(async () => {
  const { patterns, enabled } = await chrome.storage.local.get(['patterns', 'enabled']);
  const seed = {};
  if (!patterns) seed.patterns = self.ClicheEngine.DEFAULT_PATTERNS;
  if (enabled === undefined) seed.enabled = true;
  if (Object.keys(seed).length) await chrome.storage.local.set(seed);
});

chrome.action.setBadgeBackgroundColor({ color: '#fcd34d' });
chrome.action.setBadgeTextColor({ color: '#1d1b17' });

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'count' && sender.tab && sender.tab.id !== undefined) {
    const total = message.total || 0;
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: total ? (total > 999 ? '999+' : String(total)) : ''
    });
  }
});

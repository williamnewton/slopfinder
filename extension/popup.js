// Settings panel: on/off toggle, this-page count, and pattern management —
// download the active pattern set as JSON, upload a replacement (validated
// before it's stored), or reset to the built-in defaults. Content scripts
// pick changes up live via chrome.storage.onChanged.

'use strict';

const enabledInput = document.getElementById('enabled');
const pageCountEl = document.getElementById('page-count');
const patternCountEl = document.getElementById('pattern-count');
const statusEl = document.getElementById('status');
const fileInput = document.getElementById('file');

function setStatus(message, isError) {
  statusEl.textContent = message || '';
  statusEl.classList.toggle('error', Boolean(isError));
}

async function getPatterns() {
  const { patterns } = await chrome.storage.local.get('patterns');
  return Array.isArray(patterns) && patterns.length ? patterns : self.ClicheEngine.DEFAULT_PATTERNS;
}

async function refreshPatternCount() {
  const patterns = await getPatterns();
  patternCountEl.textContent = `${patterns.length} loaded`;
}

async function refreshPageCount() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || tab.id === undefined) throw new Error('no tab');
    const status = await chrome.tabs.sendMessage(tab.id, { type: 'status' });
    pageCountEl.textContent = status && status.results ? String(status.results.total) : '0';
  } catch {
    pageCountEl.textContent = '–'; // page without a content script (chrome://, store, …)
  }
}

enabledInput.addEventListener('change', async () => {
  await chrome.storage.local.set({ enabled: enabledInput.checked });
  setStatus(enabledInput.checked ? 'Highlighting on.' : 'Highlighting off.');
  setTimeout(refreshPageCount, 300);
});

document.getElementById('download').addEventListener('click', async () => {
  const patterns = await getPatterns();
  const blob = new Blob([JSON.stringify(patterns, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'llm-cliche-patterns.json';
  a.click();
  URL.revokeObjectURL(url);
  setStatus(`Exported ${patterns.length} patterns.`);
});

document.getElementById('upload').addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  let specs;
  try {
    specs = JSON.parse(await file.text());
  } catch {
    setStatus('Not valid JSON.', true);
    return;
  }
  const check = self.ClicheEngine.validatePatterns(specs);
  if (!check.ok) {
    setStatus(check.error, true);
    return;
  }
  await chrome.storage.local.set({ patterns: specs });
  await refreshPatternCount();
  setStatus(`Loaded ${check.count} patterns.`);
  setTimeout(refreshPageCount, 500);
});

document.getElementById('reset').addEventListener('click', async () => {
  await chrome.storage.local.set({ patterns: self.ClicheEngine.DEFAULT_PATTERNS });
  await refreshPatternCount();
  setStatus('Reset to the default pattern set.');
  setTimeout(refreshPageCount, 500);
});

async function init() {
  const { enabled } = await chrome.storage.local.get('enabled');
  enabledInput.checked = enabled !== false;
  await refreshPatternCount();
  await refreshPageCount();
}

init();

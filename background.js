/**
 * background.js — Service worker.
 * Keeps the toolbar badge in step with what the user has collected.
 */

const SUPPORTED = [
  'linkedin.com/jobs', 'indeed.com', 'glassdoor', 'thehub.io',
  'arbetsformedlingen.se', 'jobbsafari.se', 'academicwork'
];

async function paintBadge(tabId, url) {
  const onJobSite = url && SUPPORTED.some(s => url.includes(s));

  if (!onJobSite) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  const { jobs = [] } = await chrome.storage.local.get('jobs');
  const confirmed = jobs.filter(j => j.sponsorship?.status === 'CONFIRMED').length;

  chrome.action.setBadgeText({ tabId, text: confirmed ? String(confirmed) : '·' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: confirmed ? '#1F7A4C' : '#6B7785' });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete') paintBadge(tabId, tab.url);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (tab) paintBadge(tabId, tab.url);
});

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === 'install') {
    const { settings } = await chrome.storage.local.get('settings');
    if (!settings) {
      await chrome.storage.local.set({
        settings: { aiEnabled: false, aiProvider: 'none', aiApiKey: '', showBadge: true }
      });
    }
  }
});

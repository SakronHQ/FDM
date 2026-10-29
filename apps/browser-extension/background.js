const FDM_BRIDGE_URL = 'http://127.0.0.1:6803/api/v1/download';
const FDM_PING_URL = 'http://127.0.0.1:6803/api/v1/ping';

chrome.runtime.onInstalled.addListener(() => {
  // Context menus
  chrome.contextMenus.create({
    id: 'fdm-download-link',
    title: 'Download with FDM',
    contexts: ['link', 'image', 'video', 'audio']
  });

  chrome.contextMenus.create({
    id: 'fdm-download-page',
    title: 'Download Video/Media from this page with FDM',
    contexts: ['page']
  });

  // Default settings
  chrome.storage.local.set({
    interceptionEnabled: true,
    videoSnifferEnabled: true,
    authToken: 'fdm-secret-token'
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetUrl = info.linkUrl || info.srcUrl || info.pageUrl;
  if (!targetUrl) return;

  await sendToFdm({
    url: targetUrl,
    pageUrl: tab?.url,
    title: tab?.title
  });
});

// Intercept browser downloads if enabled
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  const settings = await chrome.storage.local.get(['interceptionEnabled', 'authToken']);
  if (settings.interceptionEnabled === false) return;

  const url = downloadItem.url || downloadItem.finalUrl;
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return;

  // Cancel browser download
  try {
    await chrome.downloads.cancel(downloadItem.id);
    await chrome.downloads.erase({ id: downloadItem.id });
  } catch (e) {
    // ignore
  }

  // Forward to FDM
  await sendToFdm({
    url: url,
    filename: downloadItem.filename ? downloadItem.filename.split(/[\\/]/).pop() : undefined,
    fileSize: downloadItem.fileSize,
    mime: downloadItem.mime
  });
});

// Listen to messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FDM_DOWNLOAD_VIDEO') {
    sendToFdm({
      url: message.url,
      pageUrl: sender.tab?.url,
      title: sender.tab?.title || message.title
    }).then(res => sendResponse(res));
    return true;
  } else if (message.type === 'FDM_CHECK_STATUS') {
    checkFdmStatus().then(status => sendResponse(status));
    return true;
  }
});

async function sendToFdm(payload) {
  try {
    const { authToken } = await chrome.storage.local.get(['authToken']);
    const res = await fetch(FDM_BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken || 'fdm-secret-token'}`
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP ${res.status}` };
  } catch (err) {
    console.warn('[FDM Extension] Could not contact FDM Desktop:', err);
    return { success: false, error: 'FDM Desktop is not running or bridge unreachable.' };
  }
}

async function checkFdmStatus() {
  try {
    const res = await fetch(FDM_PING_URL, { signal: AbortSignal.timeout(1000) });
    return { connected: res.ok };
  } catch {
    return { connected: false };
  }
}


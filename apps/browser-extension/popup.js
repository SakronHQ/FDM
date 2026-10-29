document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('statusBadge');
  const interceptToggle = document.getElementById('interceptToggle');
  const snifferToggle = document.getElementById('snifferToggle');
  const manualUrl = document.getElementById('manualUrl');
  const sendUrlBtn = document.getElementById('sendUrlBtn');

  // Load saved settings
  const settings = await chrome.storage.local.get(['interceptionEnabled', 'videoSnifferEnabled']);
  interceptToggle.checked = settings.interceptionEnabled !== false;
  snifferToggle.checked = settings.videoSnifferEnabled !== false;

  // Check connection status
  chrome.runtime.sendMessage({ type: 'FDM_CHECK_STATUS' }, (res) => {
    if (res && res.connected) {
      statusBadge.textContent = 'Connected';
      statusBadge.className = 'badge badge-online';
    } else {
      statusBadge.textContent = 'FDM Offline';
      statusBadge.className = 'badge badge-offline';
    }
  });

  interceptToggle.addEventListener('change', () => {
    chrome.storage.local.set({ interceptionEnabled: interceptToggle.checked });
  });

  snifferToggle.addEventListener('change', () => {
    chrome.storage.local.set({ videoSnifferEnabled: snifferToggle.checked });
  });

  sendUrlBtn.addEventListener('click', () => {
    const url = manualUrl.value.trim();
    if (!url) return;

    sendUrlBtn.textContent = 'Sending...';
    chrome.runtime.sendMessage({
      type: 'FDM_DOWNLOAD_VIDEO',
      url: url,
      title: 'Manual Download'
    }, (res) => {
      if (res && res.success) {
        sendUrlBtn.textContent = 'Added to FDM!';
        manualUrl.value = '';
        setTimeout(() => { sendUrlBtn.textContent = 'Send to FDM'; }, 2000);
      } else {
        sendUrlBtn.textContent = 'Failed to connect';
        setTimeout(() => { sendUrlBtn.textContent = 'Send to FDM'; }, 2000);
      }
    });
  });
});


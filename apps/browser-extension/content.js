// FDM Video Sniffer Content Script

(function () {
  const BUTTON_CLASS = 'fdm-video-download-btn';

  function createDownloadButton(videoElement) {
    if (videoElement.dataset.fdmAttached) return;
    videoElement.dataset.fdmAttached = 'true';

    const btn = document.createElement('div');
    btn.className = BUTTON_CLASS;
    btn.innerHTML = `
      <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Download with FDM</span>
    `;

    // Apply inline styling
    Object.assign(btn.style, {
      position: 'absolute',
      top: '12px',
      right: '12px',
      zIndex: '2147483647',
      backgroundColor: '#0284c7',
      color: '#ffffff',
      padding: '6px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: 'Segoe UI, system-ui, sans-serif',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      cursor: 'pointer',
      display: 'none',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s ease',
      userSelect: 'none'
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.backgroundColor = '#0369a1';
      btn.style.transform = 'scale(1.04)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.backgroundColor = '#0284c7';
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Check if extension context is valid
      if (!chrome.runtime?.id) {
        alert('FDM Extension was reloaded. Please refresh (F5) this tab once to reconnect!');
        return;
      }

      let targetUrl = window.location.href;
      const src = videoElement.currentSrc || videoElement.src;
      // If direct media stream and not blob or data URL on video portals
      if (src && !src.startsWith('blob:') && !src.startsWith('data:') && !window.location.hostname.includes('youtube.com')) {
        targetUrl = src;
      }

      btn.innerHTML = '<span>Sending to FDM...</span>';

      try {
        chrome.runtime.sendMessage({
          type: 'FDM_DOWNLOAD_VIDEO',
          url: targetUrl,
          pageUrl: window.location.href,
          title: document.title,
          isVideo: true
        }, (res) => {
          if (chrome.runtime?.lastError) {
            btn.innerHTML = '<span style="color:#fecaca">Please refresh tab (F5)</span>';
            return;
          }
          if (res && res.success) {
            btn.innerHTML = '<span>✓ Added to FDM!</span>';
            setTimeout(() => {
              btn.innerHTML = `
                <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Download with FDM</span>
              `;
            }, 2500);
          } else {
            btn.innerHTML = '<span style="color:#fecaca">FDM Not Running!</span>';
            setTimeout(() => {
              btn.innerHTML = `
                <svg style="width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Download with FDM</span>
              `;
            }, 3000);
          }
        });
      } catch {
        alert('FDM Extension was updated. Please refresh (F5) this webpage once to reconnect!');
      }
    });

    const parent = videoElement.parentElement;
    if (parent) {
      const position = window.getComputedStyle(parent).position;
      if (position === 'static') {
        parent.style.position = 'relative';
      }
      parent.appendChild(btn);

      // Show on hover
      parent.addEventListener('mouseenter', () => {
        btn.style.display = 'flex';
      });
      parent.addEventListener('mouseleave', () => {
        btn.style.display = 'none';
      });
    }
  }

  function scanVideos() {
    const videos = document.querySelectorAll('video');
    videos.forEach(v => createDownloadButton(v));
  }

  scanVideos();

  const observer = new MutationObserver(() => scanVideos());
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
})();

/**
 * Manifestudio PWA Lifecycle Manager
 * Handles Service Worker registration, install prompts (Chromium + iOS Safari guide),
 * user-controlled minimize & dismiss states, and offline status indicator.
 */

const PWA_STATE_KEY = 'manifestudio_pwa_state_v1';

let deferredPrompt = null;

function isStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isIosDevice() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function getSavedBannerState() {
  try {
    const val = localStorage.getItem(PWA_STATE_KEY);
    if (val === 'expanded' || val === 'minimized' || val === 'dismissed') {
      return val;
    }
  } catch {
    // Ignore storage restrictions
  }
  return 'expanded';
}

function saveBannerState(state) {
  try {
    localStorage.setItem(PWA_STATE_KEY, state);
  } catch {
    // Ignore storage restrictions
  }
}

export function initPwaManager() {
  const root = document.getElementById('pwa-banner-root');
  const offlineBanner = document.getElementById('offline-banner');
  const headerInstallBtn = document.getElementById('header-install-btn');
  const footerInstallLink = document.getElementById('footer-install-link');

  if (!root) return;

  // Register Service Worker with relative path for GitHub Pages subpath safety
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js?v=44')
        .then((reg) => reg.update())
        .catch(() => {
          // Silent fallback if SW registration is blocked in private mode
        });
    });
  }

  // Online / Offline indicator
  const syncNetworkBanner = () => {
    if (!offlineBanner) return;
    const isOffline = !navigator.onLine;
    offlineBanner.hidden = !isOffline;
  };
  window.addEventListener('online', syncNetworkBanner);
  window.addEventListener('offline', syncNetworkBanner);
  syncNetworkBanner();

  let bannerState = getSavedBannerState();
  let showIosHelp = false;
  let installFeedback = '';

  const render = () => {
    const standalone = isStandaloneMode();

    if (headerInstallBtn) {
      headerInstallBtn.hidden = standalone;
    }
    if (footerInstallLink) {
      footerInstallLink.hidden = standalone;
    }

    if (standalone || bannerState === 'dismissed') {
      root.innerHTML = '';
      root.hidden = true;
      return;
    }

    root.hidden = false;

    if (bannerState === 'minimized') {
      root.innerHTML = `
        <div class="pwa-minimized-dock" role="region" aria-label="Penawaran install aplikasi">
          <button type="button" class="pwa-mini-restore" id="pwa-restore-btn" aria-label="Buka penawaran install aplikasi Manifestudio">
            <span class="pwa-mini-dot" aria-hidden="true"></span>
            <span>Install App</span>
          </button>
          <button type="button" class="pwa-mini-close" id="pwa-mini-dismiss-btn" aria-label="Hilangkan penawaran install aplikasi">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      `;

      root.querySelector('#pwa-restore-btn')?.addEventListener('click', () => {
        bannerState = 'expanded';
        saveBannerState('expanded');
        render();
      });
      root.querySelector('#pwa-mini-dismiss-btn')?.addEventListener('click', () => {
        bannerState = 'dismissed';
        saveBannerState('dismissed');
        render();
      });
      return;
    }

    const ios = isIosDevice();
    const canNativePrompt = Boolean(deferredPrompt);

    let actionLabel = 'Cara Install';
    if (canNativePrompt) {
      actionLabel = 'Install Sekarang';
    } else if (ios) {
      actionLabel = 'Panduan iOS';
    }

    root.innerHTML = `
      <aside class="pwa-card" role="region" aria-label="Install Aplikasi Manifestudio">
        <div class="pwa-card-top">
          <div class="pwa-card-brand">
            <img src="./assets/icons/brand-icon.svg" alt="" width="40" height="40" class="pwa-card-icon" />
            <div>
              <p class="pwa-card-title">Install Manifestudio App</p>
              <p class="pwa-card-desc">Akses katalog lebih cepat dari layar utama &amp; tetap bisa dibuka saat offline.</p>
            </div>
          </div>
          <div class="pwa-window-controls">
            <button type="button" class="pwa-icon-btn" id="pwa-minimize-btn" title="Minimize penawaran" aria-label="Minimize penawaran install">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg>
            </button>
            <button type="button" class="pwa-icon-btn" id="pwa-dismiss-btn" title="Hilangkan penawaran" aria-label="Hilangkan penawaran install">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        ${
          showIosHelp
            ? `<div class="pwa-guide-box">
                ${
                  ios
                    ? 'Di Safari iPhone/iPad: ketuk tombol <strong>Bagikan (Share)</strong> di toolbar bawah, lalu pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.'
                    : 'Di browser Chrome/Edge: ketuk ikon <strong>Install / Tambah ke Layar Utama</strong> pada bilah alamat atau menu titik tiga browser.'
                }
              </div>`
            : ''
        }

        ${installFeedback ? `<p class="pwa-feedback">${installFeedback}</p>` : ''}

        <div class="pwa-card-actions">
          <button type="button" class="btn btn-primary btn-sm" id="pwa-install-action-btn">
            ${actionLabel}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="pwa-hide-text-btn">
            Nanti Saja
          </button>
        </div>
      </aside>
    `;

    root.querySelector('#pwa-minimize-btn')?.addEventListener('click', () => {
      bannerState = 'minimized';
      saveBannerState('minimized');
      render();
    });

    root.querySelector('#pwa-hide-text-btn')?.addEventListener('click', () => {
      bannerState = 'minimized';
      saveBannerState('minimized');
      render();
    });

    root.querySelector('#pwa-dismiss-btn')?.addEventListener('click', () => {
      bannerState = 'dismissed';
      saveBannerState('dismissed');
      render();
    });

    root.querySelector('#pwa-install-action-btn')?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice.outcome === 'accepted') {
          bannerState = 'dismissed';
          saveBannerState('dismissed');
        } else {
          installFeedback = 'Instalasi dibatalkan. Anda dapat memasang aplikasi kapan saja.';
        }
        render();
        return;
      }
      showIosHelp = !showIosHelp;
      render();
    });
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    render();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    bannerState = 'dismissed';
    saveBannerState('dismissed');
    render();
  });

  const triggerExpand = () => {
    bannerState = 'expanded';
    showIosHelp = !deferredPrompt;
    saveBannerState('expanded');
    render();
    root.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  headerInstallBtn?.addEventListener('click', triggerExpand);
  footerInstallLink?.addEventListener('click', triggerExpand);

  render();
}

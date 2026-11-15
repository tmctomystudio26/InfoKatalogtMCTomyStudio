/**
 * Manifestudio PWA Lifecycle Manager
 * Slim, non-intrusive install offer with minimize dock, full dismiss persistence,
 * iOS Safari instructions, and offline status indicator.
 */

const PWA_STATE_KEY = 'manifestudio_pwa_state_v2';

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
  const navInstallLink = document.getElementById('nav-install-link');
  const footerInstallLink = document.getElementById('footer-install-link');

  if (!root) return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Silent fallback if SW is blocked
      });
    });
  }

  const syncNetworkBanner = () => {
    if (!offlineBanner) return;
    offlineBanner.hidden = navigator.onLine;
  };
  window.addEventListener('online', syncNetworkBanner);
  window.addEventListener('offline', syncNetworkBanner);
  syncNetworkBanner();

  let bannerState = getSavedBannerState();
  let showGuide = false;
  let installFeedback = '';

  const render = () => {
    const standalone = isStandaloneMode();

    if (navInstallLink) navInstallLink.hidden = standalone;
    if (footerInstallLink) footerInstallLink.hidden = standalone;

    if (standalone || bannerState === 'dismissed') {
      root.innerHTML = '';
      root.hidden = true;
      return;
    }

    root.hidden = false;

    if (bannerState === 'minimized') {
      root.innerHTML = `
        <div class="pwa-dock" role="region" aria-label="Penawaran install aplikasi">
          <button
            type="button"
            class="pwa-dock-restore"
            id="pwa-restore-btn"
            aria-label="Buka penawaran install aplikasi Manifestudio"
          >
            Install App
          </button>
          <button
            type="button"
            class="pwa-dock-close"
            id="pwa-mini-dismiss-btn"
            aria-label="Hilangkan penawaran install aplikasi"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
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
    const actionLabel = canNativePrompt
      ? 'Install Aplikasi'
      : ios
      ? 'Panduan iOS'
      : 'Cara Install';

    root.innerHTML = `
      <aside class="pwa-strip" role="region" aria-label="Install Aplikasi Manifestudio">
        <div class="pwa-strip-main">
          <div class="pwa-strip-copy">
            <img src="./assets/icons/brand-icon.svg" alt="" width="24" height="24" class="pwa-strip-icon" />
            <p class="pwa-strip-text">
              <strong>Manifestudio App</strong>
              <span aria-hidden="true">·</span>
              <span>Pasang di layar utama untuk akses cepat &amp; dukungan offline.</span>
            </p>
          </div>

          <div class="pwa-strip-controls">
            <button type="button" class="btn btn-primary btn-xs" id="pwa-install-action-btn">
              ${actionLabel}
            </button>
            <button
              type="button"
              class="pwa-ctrl-btn"
              id="pwa-minimize-btn"
              title="Minimize penawaran"
              aria-label="Minimize penawaran install"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg>
            </button>
            <button
              type="button"
              class="pwa-ctrl-btn"
              id="pwa-dismiss-btn"
              title="Hilangkan penawaran"
              aria-label="Hilangkan penawaran install"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        ${
          showGuide
            ? `<div class="pwa-guide-note">
                ${
                  ios
                    ? 'Safari iOS: ketuk tombol Bagikan (Share) di bawah layar, lalu pilih Tambah ke Layar Utama (Add to Home Screen).'
                    : 'Browser Desktop / Android: ketuk ikon Install di bilah alamat browser atau buka menu browser lalu pilih Tambahkan ke Layar Utama.'
                }
              </div>`
            : ''
        }

        ${installFeedback ? `<p class="pwa-feedback-note">${installFeedback}</p>` : ''}
      </aside>
    `;

    root.querySelector('#pwa-minimize-btn')?.addEventListener('click', () => {
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
          installFeedback = 'Instalasi ditunda. Anda dapat memasang aplikasi kapan saja.';
        }
        render();
        return;
      }
      showGuide = !showGuide;
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

  const expandOffer = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    bannerState = 'expanded';
    showGuide = !deferredPrompt;
    saveBannerState('expanded');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  navInstallLink?.addEventListener('click', expandOffer);
  footerInstallLink?.addEventListener('click', expandOffer);

  render();
}

/**
 * UI Utilities for visual feedback and interaction states
 * Based on the RDGESTION Design System: Deep Graphite on Soft Canvas.
 */

/**
 * Toast System: Non-blocking notifications.
 */
const DEBUG = false;
function log(...args) { if (DEBUG) console.log(...args); }

export const Toast = {
  types: {
    SUCCESS: { class: 'toast-success', icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>' },
    ERROR: { class: 'toast-error', icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>' },
    INFO: { class: 'toast-info', icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' },
    WARNING: { class: 'toast-warning', icon: '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/></svg>' },
  },

  init() {
    if (document.getElementById('toast-container')) return;

    const container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  },

  show(message, type = 'INFO') {
    this.init();
    const config = this.types[type] || this.types.INFO;
    const id = `toast-${Date.now()}`;

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = `toast-notification ${config.class}`;
    toast.innerHTML = `
      <span class="toast-icon" aria-hidden="true">${config.icon}</span>
      <span class="toast-message">${message}</span>
    `;

    const container = document.getElementById('toast-container');
    if (!container) {
      this.init();
      document.body.querySelector('#toast-container')?.appendChild(toast);
    } else {
      container.appendChild(toast);
    }

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      // Filet de sécurité : retirer même si 'transitionend' ne se déclenche pas
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 300);
      toast.addEventListener('transitionend', () => {
        if (toast.parentNode) toast.remove();
      }, { once: true });
    }, 4000);
  },

  success(msg) { this.show(msg, 'SUCCESS'); },
  error(msg) { this.show(msg, 'ERROR'); },
  info(msg) { this.show(msg, 'INFO'); },
  warning(msg) { this.show(msg, 'WARNING'); }
};

/**
 * Global Loading Indicator: Top-bar progress line.
 */
export const LoadingIndicator = {
  activeRequests: 0,

  init() {
    if (document.getElementById('global-loading-bar')) {
      return;
    }

    const bar = document.createElement('div');
    bar.id = 'global-loading-bar';
    bar.style.cssText = 'position: fixed; top: 0; left: 0; height: 3px; background: var(--accent-color); z-index: 10000; width: 100%; transform: scaleX(0); transform-origin: left; transition: transform 0.3s ease; pointer-events: none;';
    document.body.appendChild(bar);
  },

  show() {
    this.init();
    this.activeRequests++;
    const bar = document.getElementById('global-loading-bar');
    if (bar) {
      bar.style.transform = 'scaleX(0.3)';
      bar.classList.add('active');
    }
  },

  hide() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) {
      const bar = document.getElementById('global-loading-bar');
      if (bar) {
        bar.style.transform = 'scaleX(1)';
        setTimeout(() => {
          bar.style.transition = 'none';
          bar.style.transform = 'scaleX(0)';
          setTimeout(() => {
            bar.style.transition = 'transform 0.3s ease';
          }, 10);
        }, 200);
      }
    }
  }
};

/**
 * Button Loading Pattern.
 */
export async function withLoading(button, callback, message = 'Traitement...') {
  if (!button) {
    return;
  }

  const originalText = button.innerText;

  try {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.classList.add('is-loading');
    button.innerHTML = `<span class="spinner"></span> <span class="loading-text">${message}</span>`;

    const result = await callback();
    return result;
  } catch (e) {
    throw e;
  } finally {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.classList.remove('is-loading');
    button.innerText = originalText;
  }
}

/**
 * Skeletons Utility: Generates shimmer placeholders.
 */
export const Skeletons = {
  text(lines = 1) {
    return Array(lines).fill('<div class="skeleton skeleton-text"></div>').join('');
  },

  table(cols = 4, rows = 5) {
    return Array(rows).fill(`<tr>${Array(cols).fill(`<td><div class="skeleton skeleton-text"></div></td>`).join('')}</tr>`).join('');
  },

  grid(count = 8, type = 'card') {
    const item = type === 'card'
      ? `<div class="product-card skeleton-card"><div class="skeleton skeleton-avatar"></div><div class="skeleton skeleton-text"></div><div class="skeleton skeleton-text" style="width:40%"></div></div>`
      : `<div class="skeleton skeleton-row"></div>`;

    return Array(count).fill(item).join('');
  }
};

/**
 * Themed Confirm Modal: Replaces native confirm() with an accessible dialog.
 * Returns a Promise<boolean> — true if confirmed, false if cancelled.
 */
export function confirmModal(message, options = {}) {
  const title = options.title || 'Confirmation';
  const confirmText = options.confirmText || 'Confirmer';
  const cancelText = options.cancelText || 'Annuler';
  const danger = options.danger || false;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease;';

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.cssText = `background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius); max-width: 420px; width: 90%; padding: 24px; box-shadow: var(--shadow-lg); animation: modalIn 0.24s var(--ease-out);`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'confirm-modal-title');

    modal.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 20px;">
        <div style="flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: ${danger ? 'var(--error-light)' : 'var(--accent-light)'};">
          <svg width="20" height="20" fill="none" stroke="${danger ? 'var(--error)' : 'var(--accent-color)'}" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
        </div>
        <div>
          <h3 id="confirm-modal-title" style="font-family: var(--font-display); font-size: 16px; font-weight: 600; margin-bottom: 8px;">${title}</h3>
          <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5;">${message}</p>
        </div>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="btn btn-secondary" id="confirm-cancel" style="padding: 8px 16px; font-size: 13px; min-height: 44px;">${cancelText}</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok" style="padding: 8px 16px; font-size: 13px; min-height: 44px;">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        resolve(false);
      } else if (e.key === 'Enter') {
        cleanup();
        resolve(true);
      }
    };

    document.addEventListener('keydown', onKeydown);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    });

    modal.querySelector('#confirm-ok').addEventListener('click', () => {
      cleanup();
      resolve(true);
    });

    modal.querySelector('#confirm-cancel').addEventListener('click', () => {
      cleanup();
      resolve(false);
    });

    setTimeout(() => modal.querySelector('#confirm-ok').focus(), 100);
  });
}

/**
 * Themed Alert Modal: Replaces native alert() with an accessible dialog.
 * Returns a Promise<void> that resolves when dismissed.
 */
export function alertModal(message, options = {}) {
  const title = options.title || 'Information';

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease;';

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.style.cssText = `background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius); max-width: 420px; width: 90%; padding: 24px; box-shadow: var(--shadow-lg); animation: modalIn 0.24s var(--ease-out);`;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'alert-modal-title');

    modal.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h3 id="alert-modal-title" style="font-family: var(--font-display); font-size: 16px; font-weight: 600; margin-bottom: 8px;">${title}</h3>
        <p style="font-size: 14px; color: var(--text-secondary); line-height: 1.5;">${message}</p>
      </div>
      <div style="display: flex; justify-content: flex-end;">
        <button class="btn btn-primary" id="alert-ok" style="padding: 8px 16px; font-size: 13px; min-height: 44px;">OK</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
    };

    const onKeydown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        cleanup();
        resolve();
      }
    };

    document.addEventListener('keydown', onKeydown);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve();
      }
    });

    modal.querySelector('#alert-ok').addEventListener('click', () => {
      cleanup();
      resolve();
    });

    setTimeout(() => modal.querySelector('#alert-ok').focus(), 100);
  });
}

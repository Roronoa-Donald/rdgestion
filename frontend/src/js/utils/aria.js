/**
 * Accessibility (ARIA) helpers for RDGESTION.
 * Centralizes dialog focus management and ARIA wiring.
 */

function getFocusable(root) {
  const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll(selector));
}

/**
 * Traps keyboard focus inside the given dialog element.
 * Returns a cleanup function that removes the listeners and restores the previously focused element.
 */
export function trapFocus(dialog) {
  if (!dialog) return () => {};

  const previouslyFocused = document.activeElement;
  const focusable = getFocusable(dialog);
  const firstFocusable = focusable[0] || dialog;
  const lastFocusable = focusable[focusable.length - 1] || dialog;

  firstFocusable.focus();

  const onKeydown = (e) => {
    if (e.key !== 'Tab') return;
    const elements = getFocusable(dialog);
    if (elements.length === 0) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  dialog.addEventListener('keydown', onKeydown);

  return function release() {
    dialog.removeEventListener('keydown', onKeydown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
  };
}

/**
 * Upgrades a modal dialog element: applies role="dialog", aria-modal="true",
 * aria-labelledby (if a labelledby id is given), wires Escape to closeFn,
 * and traps focus inside. Returns a cleanup function.
 */
export function setupDialog(dialog, options = {}) {
  if (!dialog) return () => {};
  const { labelledbyId, closeOnEscape = true, closeFn = () => {} } = options;
  const cleanupList = [];

  const role = document.createAttribute('role');
  role.value = 'dialog';
  dialog.attributes.setNamedItem(role);

  const ariaModal = document.createAttribute('aria-modal');
  ariaModal.value = 'true';
  dialog.attributes.setNamedItem(ariaModal);

  if (labelledbyId) {
    dialog.setAttribute('aria-labelledby', labelledbyId);
  }
  dialog.tabIndex = -1;

  let onKeydown = null;
  if (closeOnEscape) {
    onKeydown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFn();
      }
    };
    document.addEventListener('keydown', onKeydown);
    cleanupList.push(() => document.removeEventListener('keydown', onKeydown));
  }

  const releaseFocus = trapFocus(dialog);
  cleanupList.push(releaseFocus);

  return function cleanup() {
    cleanupList.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
  };
}

/**
 * Wire standard tab semantics on a tablist container.
 * Requires buttons with role="tab" and data-tab attributes, plus panels with role="tabpanel"
 * with matching aria-labelledby ids. Provides arrow-key navigation.
 */
export function setupTablist(tablistEl, getActiveTab, setActiveTab) {
  if (!tablistEl) return;
  tablistEl.setAttribute('role', 'tablist');

  const tabs = Array.from(tablistEl.querySelectorAll('[data-tab]'));
  tabs.forEach((tab, index) => {
    const id = tab.dataset.tab;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('id', `tab-${id}`);
    tab.setAttribute('aria-controls', `tabpanel-${id}`);

    const setActivationState = () => {
      const activeId = getActiveTab();
      tabs.forEach((t) => {
        const isActive = t.dataset.tab === activeId;
        t.setAttribute('aria-selected', String(isActive));
        t.tabIndex = isActive ? 0 : -1;
      });
    };
    setActivationState();

    tab.addEventListener('click', () => {
      setActiveTab(id);
      tabs.forEach((t) => {
        const isActive = t.dataset.tab === id;
        t.setAttribute('aria-selected', String(isActive));
        t.tabIndex = isActive ? 0 : -1;
      });
    });

    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const direction = e.key === 'ArrowRight' ? 1 : -1;
        const next = tabs[(index + direction + tabs.length) % tabs.length];
        next.focus();
        setActiveTab(next.dataset.tab);
        tabs.forEach((t) => {
          const isActive = t.dataset.tab === next.dataset.tab;
          t.setAttribute('aria-selected', String(isActive));
          t.tabIndex = isActive ? 0 : -1;
        });
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        const target = e.key === 'Home' ? tabs[0] : tabs[tabs.length - 1];
        target.focus();
        setActiveTab(target.dataset.tab);
        tabs.forEach((t) => {
          const isActive = t.dataset.tab === target.dataset.tab;
          t.setAttribute('aria-selected', String(isActive));
          t.tabIndex = isActive ? 0 : -1;
        });
      }
    });
  });
}

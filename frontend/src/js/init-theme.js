(function () {
  try {
    var theme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    // localStorage indisponible (mode privé, etc.) — garder le thème par défaut
  }
})();

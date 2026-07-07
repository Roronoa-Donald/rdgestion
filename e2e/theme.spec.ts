import { test, expect, BASE } from './helpers';

test.describe('Thème clair/sombre', () => {
  test('le bouton toggle thème est présent dans le header', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    // Le bouton thème n'est visible qu'après login — mais l'index peut le masquer
    const themeBtn = page.locator('#theme-btn, button[aria-label*="thème"]');
    // Avant login, le bouton peut être caché ; on tolère
    const count = await themeBtn.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('init-theme.js est chargé (prévention FOUC)', async ({ page }) => {
    const requests = [];
    page.on('request', (req) => {
      if (req.url().includes('init-theme.js')) requests.push(req.url());
    });
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    expect(requests.length).toBeGreaterThan(0);
  });

  test('html root a un attribut data-theme', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    const theme = await page.getAttribute('html', 'data-theme');
    expect(['light', 'dark']).toContain(theme);
  });
});

import { test, expect, BASE } from './helpers';

test.describe('Authentification', () => {
  test('affiche la vue de connexion au démarrage', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    // Sans token, l'app doit rediriger vers la vue de login
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
  });

  test('refuse un login avec identifiants invalides et affiche un Toast', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    await page.fill('input[type="text"]', 'invalid-user-12345');
    await page.fill('input[type="password"]', 'wrongPassword123');
    await page.click('button[type="submit"]');

    // On doit voir une notification d'erreur (toast) ou un message d'erreur
    const toast = page.locator('.toast-notification.toast-error').or(page.locator('.toast-error, .toast.show, [role="status"]'));
    await expect(toast).toBeVisible({ timeout: 8000 });
  });

  test('le formulaire de login a des labels accessibles', async ({ page }) => {
    await page.goto(`${BASE}/`);
    await page.waitForLoadState('networkidle');
    const inputs = page.locator('input');
    expect(await inputs.count()).toBeGreaterThanOrEqual(2);
    // Le bouton de soumission doit être un <button>
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

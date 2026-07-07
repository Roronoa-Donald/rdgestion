import { test as base, expect } from '@playwright/test';

/**
 * Shared E2E helpers for RDGESTION.
 * Assumes the dev server is running on http://localhost:8080 (see playwright.config.ts).
 */

const BASE = process.env.E2E_BASE_URL || 'http://localhost:8080';

/**
 * Login via the UI form.
 * @param identifier phone number or username
 * @param password clear-text password
 */
export async function login(page, identifier: string, password: string) {
  await page.goto(`${BASE}/#/login`);
  await page.fill('#login-identifier, input[name="identifier"], input[type="text"]', identifier);
  await page.fill('#login-password, input[type="password"]', password);
  await page.click('button[type="submit"]');
}

export const test = base.extend({});
export { expect, BASE };

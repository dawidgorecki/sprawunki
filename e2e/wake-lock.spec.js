// Keep-the-screen-on switch (spec 9.3).
//
// A test browser has no real screen to keep on, so navigator.wakeLock is replaced
// with a fake before the app starts (addInitScript runs before the page's own code).
// This way the tests decide whether the browser grants or refuses the lock.

import { test, expect } from '@playwright/test';
import { openApp } from './helpers.js';

function wakeLockButton(page) {
  return page.getByRole('button', { name: 'Nie wygaszaj ekranu' });
}

// grant: true – request() succeeds; false – it fails like on battery saver.
async function fakeWakeLock(page, { grant }) {
  await page.addInitScript((grant) => {
    const fake = {
      request: async () => {
        if (!grant) throw new Error('Refused by the test');
        return { released: false, release: async () => {} };
      },
    };
    Object.defineProperty(navigator, 'wakeLock', { value: fake, configurable: true });
  }, grant);
}

test('turns on and off', async ({ page }) => {
  await fakeWakeLock(page, { grant: true });
  await openApp(page);

  const button = wakeLockButton(page);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('is off again after a reload', async ({ page }) => {
  await fakeWakeLock(page, { grant: true });
  await openApp(page);
  await wakeLockButton(page).click();

  await page.reload();

  await expect(wakeLockButton(page)).toHaveAttribute('aria-pressed', 'false');
});

test('switches back off with a message when the browser refuses', async ({ page }) => {
  await fakeWakeLock(page, { grant: false });
  await openApp(page);

  await wakeLockButton(page).click();

  await expect(wakeLockButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Nie udało się wyłączyć wygaszania ekranu.')).toBeVisible();
});

test('is hidden when the browser has no Wake Lock API', async ({ page }) => {
  // 'wakeLock' in navigator checks the prototype chain, so remove it there.
  await page.addInitScript(() => delete Navigator.prototype.wakeLock);
  await openApp(page);

  await expect(page.getByRole('heading', { name: 'Sprawunki' })).toBeVisible();
  await expect(wakeLockButton(page)).toBeHidden();
});

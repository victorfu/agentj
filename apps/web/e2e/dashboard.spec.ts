import { expect, test } from '@playwright/test';

test('dashboard loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Agentj Control Plane' })).toBeVisible();
});

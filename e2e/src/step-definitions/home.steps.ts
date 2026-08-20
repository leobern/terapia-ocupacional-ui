import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

// O mock server (e2e/src/backend/server.js) já serve o caminho feliz de
// /v1/home/* por padrão — este step não precisa interceptar nada.
Given('que a Home carrega com sucesso', async () => {
  // Intencionalmente vazio — ver comentário acima.
});

Given('que a Home falha ao carregar', async ({ page }) => {
  const erro = { status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Erro simulado' }) };

  await page.route('**/v1/home/summary*', route => route.fulfill(erro));
  await page.route('**/v1/home/notifications*', route => route.fulfill(erro));
});

When('eu abro a tela Home', async ({ page }) => {
  await page.goto('/home');
});

When('rolo até o final da lista de notificações', async ({ page }) => {
  await page.locator('app-notification-card').last().scrollIntoViewIfNeeded();
});

Then('vejo o card de contagem com {string}', async ({ page }, texto: string) => {
  await expect(page.locator('app-patient-count-card')).toContainText(texto);
});

Then('vejo pelo menos 1 card de notificação', async ({ page }) => {
  await expect(page.locator('app-notification-card').first()).toBeVisible();
});

Then('um novo lote de notificações é carregado automaticamente', async ({ page }) => {
  // Mock server: 1º lote tem 3 itens (cursor "page-2"), 2º lote soma +2 = 5.
  await expect(page.locator('app-notification-card')).toHaveCount(5);
});

Then('vejo a mensagem {string}', async ({ page }, texto: string) => {
  await expect(page.locator('app-home-error')).toContainText(texto);
});

Then('vejo o botão {string}', async ({ page }, texto: string) => {
  await expect(page.getByRole('button', { name: texto })).toBeVisible();
});

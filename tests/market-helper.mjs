import { _electron, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function launchPublicMarketHost({ executablePath, pluginId, version }) {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'qingzuo-labeledit-market-'));
  let app;
  try {
    app = await _electron.launch({ executablePath, cwd: temporary, args: ['--user-data-dir=' + path.join(temporary, 'profile')] });
    const page = await app.firstWindow();
    await expect(page.getByText('Harness 内核已连接')).toBeVisible();
    await page.getByRole('button', { name: '插件市场', exact: true }).click();
    const card = page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'LabelEdit', exact: true }) });
    await expect(card).toBeVisible({ timeout: 120000 });
    await card.getByRole('button', { name: '安装插件', exact: true }).click();
    await expect(card.getByRole('button', { name: '已安装', exact: true })).toBeVisible({ timeout: 180000 });
    const status = await page.evaluate(() => window.commerceDesktop.invoke('status'));
    expect(status.plugins.find(plugin => plugin.id === pluginId)).toMatchObject({ version, source: 'market', enabled: true });
    await page.getByRole('button', { name: '工具中心', exact: true }).click();
    await page.locator('[data-slot="card"]').filter({ has: page.getByRole('heading', { name: 'LabelEdit', exact: true }) }).getByRole('button', { name: /^打开(?:工具)?$/ }).click();
    await expect.poll(() => app.context().pages().some(candidate => candidate.url().startsWith('commerce-plugin://' + pluginId + '/'))).toBe(true);
    const plugin = app.context().pages().find(candidate => candidate.url().startsWith('commerce-plugin://' + pluginId + '/'));
    console.log('Installed LabelEdit ' + version + ' from its immutable public Release through the signed catalog.');
    return { app, page, plugin, temporary, async close() { await app.close(); await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } };
  } catch (error) {
    await app?.close();
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    throw error;
  }
}

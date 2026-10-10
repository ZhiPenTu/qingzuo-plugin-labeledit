import { expect } from '@playwright/test';
import { launchPluginTestHost } from '@commerce/plugin-sdk/testing';

if (!process.env.QINGZUO_HOST_EXECUTABLE || !process.env.QINGZUO_LEGACY_PLUGIN) throw new Error('Explicit host and legacy API 1.0 artifact paths required.');
const host = await launchPluginTestHost({ executablePath: process.env.QINGZUO_HOST_EXECUTABLE, artifactPath: process.env.QINGZUO_LEGACY_PLUGIN, pluginId: 'official.labeledit' });
try {
  const status = await host.page.evaluate(() => window.commerceDesktop.invoke('status'));
  expect(status.version).toBe('0.2.7');
  expect(status.plugins[0].api).toBe('^1.0.0');
  await host.plugin.getByRole('button', { name: '使用示例标签', exact: true }).click();
  await expect(host.plugin.getByRole('button', { name: '选择文字：Batch Number: SG250128', exact: true })).toBeVisible({ timeout: 90000 });
  await expect(host.plugin.locator('img[alt="PDF 第 1 页"]')).toHaveAttribute('src', /\/api\/documents\/[a-f0-9]{32}\/pages\/0\/image/);
  await expect.poll(() => host.plugin.locator('img[alt="PDF 第 1 页"]').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  console.log('Legacy LabelEdit API 1.0: real OCR and PDF-specific preview compatibility passed in the pure v0.2.7 host.');
} finally { await host.close(); }

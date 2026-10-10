import { expect } from '@playwright/test';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { launchPluginTestHost } from '@commerce/plugin-sdk/testing';
import { launchPublicMarketHost } from './market-helper.mjs';
const pkg = JSON.parse(await readFile('package.json')), platform = process.platform + '-' + process.arch;
if (!process.env.QINGZUO_HOST_EXECUTABLE) throw new Error('QINGZUO_HOST_EXECUTABLE must point to a pinned host artifact.');
const host = process.env.QINGZUO_PUBLIC_MARKET === '1'
  ? await launchPublicMarketHost({ executablePath: process.env.QINGZUO_HOST_EXECUTABLE, pluginId: pkg.commerce.id, version: pkg.version })
  : await launchPluginTestHost({ executablePath: process.env.QINGZUO_HOST_EXECUTABLE, artifactPath: 'release/' + pkg.commerce.id + '-' + pkg.version + '-' + platform + '.ecplugin', pluginId: pkg.commerce.id });
try {
  await host.plugin.getByRole('button', { name: '使用示例标签' }).click();
  await expect(host.plugin.getByRole('button', { name: '选择文字：Batch Number: SG250128', exact: true })).toBeVisible({ timeout: 90000 });
  await expect.poll(() => host.plugin.locator('img[alt="PDF 第 1 页"]').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const originalResource = await host.plugin.locator('img[alt="PDF 第 1 页"]').getAttribute('src');
  await host.plugin.getByRole('button', { name: '选择文字：Batch Number: SG250128', exact: true }).click();
  const inspector = host.plugin.getByRole('button', { name: '打开编辑面板', exact: true });
  if (await inspector.isVisible()) await inspector.click();
  await host.plugin.getByRole('textbox', { name: '替换为', exact: true }).fill('Batch Number: PLUGIN-012');
  await host.plugin.getByRole('button', { name: '应用修改', exact: true }).click();
  await expect(host.plugin.getByText('修改已应用，预览与导出使用相同的排版。', { exact: true })).toBeVisible();
  const closePanel = host.plugin.getByRole('button', { name: '关闭', exact: true });
  if (await closePanel.isVisible()) await closePanel.click();
  await expect(host.plugin.locator('img[alt="PDF 第 1 页"]')).toHaveAttribute('src', /^blob:/);
  await expect.poll(() => host.plugin.locator('img[alt="PDF 第 1 页"]').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  const output = path.join(host.temporary, 'result.pdf');
  await host.app.evaluate(({ dialog }, filename) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: filename }); }, output);
  await host.plugin.getByRole('button', { name: '导出 PDF', exact: true }).click();
  await expect.poll(async () => { try { return (await readFile(output)).subarray(0, 4).toString(); } catch { return ''; } }).toBe('%PDF');
  const exportedText = execFileSync(process.env.QINGZUO_TEST_PYTHON || 'python', ['-c', 'from pypdf import PdfReader; import sys; print("".join(page.extract_text() for page in PdfReader(sys.argv[1]).pages))', output], { encoding: 'utf8' });
  expect(exportedText).toContain('PLUGIN-012');
  await mkdir('output', { recursive: true });
  await copyFile(output, 'output/host-result.pdf');
  await host.plugin.screenshot({ path: 'output/host-success.png' });
  await host.plugin.locator('input[type="file"]').setInputFiles(path.resolve('文具新大 70X40.pdf'));
  await expect(host.plugin.locator('img[alt="PDF 第 1 页"]')).toHaveAttribute('src', /^commerce-plugin:/);
  await expect.poll(() => host.plugin.evaluate(async token => { try { await window.commercePlugin.invoke('files.read', { token }); return false; } catch { return true; } }, originalResource.split('/').at(-1))).toBe(true);
  const original = await host.plugin.evaluate(async () => { const status = await window.commercePlugin.invoke('services.call', { service: 'labeledit.pdf', method: 'health' }); return status.ocr.ready; });
  expect(original).toBe(true);
  console.log('Independent LabelEdit artifact: real sandboxed offline OCR, edit, rendered preview, exported text and document resource release passed.');
} catch (error) {
  await mkdir('output', { recursive: true });
  await host.plugin.screenshot({ path: 'output/host-failure.png' }).catch(() => {});
  await writeFile('output/host-failure.txt', await host.plugin.locator('body').innerText().catch(() => 'Renderer closed.'));
  throw error;
} finally { await host.close(); }

import type { PDFDocument, Recognition, TextEdit, Language } from './editor/types';
import { createPluginClient } from '@commerce/plugin-sdk';
export type * from './editor/types';

async function native<T>(method: string, args?: unknown): Promise<T> {
  if (!window.commercePlugin) throw new Error('请从工具中心打开 LabelEdit。');
  return window.commercePlugin.invoke<T>('services.call', { service: 'labeledit.pdf', method, args });
}
function nativeBlob(value: { data: string; mime: string }) {
  const bytes = Uint8Array.from(atob(value.data), char => char.charCodeAt(0));
  return new Blob([bytes], { type: value.mime });
}
const resources = new Map<string, { token: string; url: string }>();
const pending = new Map<string, Promise<string>>();
const generations = new Map<string, number>();
function imageUrl(id: string, page: number) { return resources.get(id + ':' + page)?.url ?? ''; }
async function loadImage(id: string, page: number): Promise<string> {
  const key = id + ':' + page, existing = resources.get(key);
  if (existing) return existing.url;
  if (pending.has(key)) return pending.get(key)!;
  const generation = generations.get(id) ?? 0, client = createPluginClient();
  const request = (async () => {
    const image = await native<{ data: string; mime: string }>('image', { id, page });
    const item = await client.files.create({ ...image, filename: 'page-' + page + '.png' });
    if ((generations.get(id) ?? 0) !== generation) { await client.files.release(item.token); throw new Error('文档已关闭。'); }
    try {
      const url = await client.files.url(item.token);
      if ((generations.get(id) ?? 0) !== generation) throw new Error('文档已关闭。');
      resources.set(key, { token: item.token, url }); return url;
    } catch (error) { await client.files.release(item.token).catch(() => {}); throw error; }
  })();
  pending.set(key, request);
  try { return await request; } finally { if (pending.get(key) === request) pending.delete(key); }
}
async function describe(doc: PDFDocument): Promise<PDFDocument> {
  await loadImage(doc.id, 0);
  return { ...doc, pages: doc.pages.map(page => ({ ...page, preview_url: imageUrl(doc.id, page.index) })) };
}

export const api = {
  async upload(file: File): Promise<PDFDocument> {
    if (file.size > 25 * 1024 * 1024) throw new Error('PDF 文件不能超过 25 MB。');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 65536) binary += String.fromCharCode(...bytes.subarray(i, i + 65536));
    return describe(await native<PDFDocument>('upload', { filename: file.name, data: btoa(binary) }));
  },
  async demo(): Promise<PDFDocument> { return describe(await native<PDFDocument>('demo')); },
  async close(id: string): Promise<void> {
    generations.set(id, (generations.get(id) ?? 0) + 1);
    const client = createPluginClient();
    for (const [key, item] of resources) if (key.startsWith(id + ':')) { resources.delete(key); await client.files.release(item.token).catch(() => {}); }
    await native('close', { id });
  },
  recognize: (id: string, page: number, language: Language) => native<Recognition>('recognize', { id, page, language }),
  async preview(id: string, page: number, edits: TextEdit[]): Promise<Blob> {
    return nativeBlob(await native('preview', { id, page, edits }));
  },
  async export(id: string, edits: TextEdit[]): Promise<Blob> {
    return nativeBlob(await native('export', { id, edits }));
  },
  async save(blob: Blob, filename: string): Promise<boolean> {
    if (!window.commercePlugin) throw new Error('请从工具中心保存文件。');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 65536) binary += String.fromCharCode(...bytes.subarray(i, i + 65536));
    const token = await window.commercePlugin.invoke<{ token: string }>('files.create', { data: btoa(binary), filename, mime: 'application/pdf' });
    try { return await window.commercePlugin.invoke<boolean>('files.save', { token: token.token, filename }); }
    finally { await window.commercePlugin.invoke('files.release', { token: token.token }); }
  },
  imageUrl,
  loadImage,
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作未完成，请重试。';
}

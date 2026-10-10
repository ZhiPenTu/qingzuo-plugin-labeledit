import { afterEach, expect, it, vi } from 'vitest';
import { api } from './api';

afterEach(() => vi.unstubAllGlobals());

it('deduplicates page resources and releases every document token on close', async () => {
  const invoke = vi.fn(async (method: string, args: Record<string, unknown>) => {
    if (method === 'services.call') return { data: 'aW1hZ2U=', mime: 'image/png' };
    if (method === 'files.create') return { token: 'page-token' };
    if (method === 'files.url') return 'commerce-plugin://official.labeledit/__files/' + args.token;
  });
  vi.stubGlobal('commercePlugin', { invoke });
  const resources = await Promise.all([api.loadImage('cached', 0), api.loadImage('cached', 0)]);
  expect(resources[0]).toBe(resources[1]);
  expect(invoke.mock.calls.filter(([method]) => method === 'files.create')).toHaveLength(1);
  await api.close('cached');
  expect(invoke).toHaveBeenCalledWith('files.release', { token: 'page-token' });
  expect(api.imageUrl('cached', 0)).toBe('');
});

it('a response arriving after document close cannot retain a resource', async () => {
  let complete!: (value: { data: string; mime: string }) => void;
  const invoke = vi.fn(async (method: string, args: Record<string, unknown>) => {
    if (method === 'services.call' && args.method === 'image') return new Promise(resolve => { complete = resolve; });
    if (method === 'files.create') return { token: 'late-token' };
  });
  vi.stubGlobal('commercePlugin', { invoke });
  const loading = api.loadImage('closing', 1);
  const rejected = expect(loading).rejects.toThrow('文档已关闭');
  await api.close('closing');
  complete({ data: 'aW1hZ2U=', mime: 'image/png' });
  await rejected;
  expect(invoke).toHaveBeenCalledWith('files.release', { token: 'late-token' });
  expect(api.imageUrl('closing', 1)).toBe('');
});

it('failed URL publication releases the temporary resource', async () => {
  const invoke = vi.fn(async (method: string) => {
    if (method === 'services.call') return { data: 'aW1hZ2U=', mime: 'image/png' };
    if (method === 'files.create') return { token: 'failed-token' };
    if (method === 'files.url') throw new Error('invalid URL');
  });
  vi.stubGlobal('commercePlugin', { invoke });
  await expect(api.loadImage('failed', 0)).rejects.toThrow('invalid URL');
  expect(invoke).toHaveBeenCalledWith('files.release', { token: 'failed-token' });
});

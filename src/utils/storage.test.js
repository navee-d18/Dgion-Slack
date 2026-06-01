import { describe, it, expect, vi, beforeEach } from 'vitest';

// uploadAttachment reads `isConfigured` / `storage` from ../firebase at call time,
// so we reset modules and re-mock per test to exercise each branch in isolation.
beforeEach(() => {
  vi.resetModules();
});

async function loadUploader(firebaseMock) {
  vi.doMock('../firebase', () => firebaseMock);
  vi.doMock('firebase/storage', () => ({
    ref: vi.fn(() => ({ fullPath: 'attachments/uid/x' })),
    uploadString: vi.fn(async () => ({ ref: { fullPath: 'attachments/uid/x' } })),
    getDownloadURL: vi.fn(async () => 'https://hosted.example/download'),
  }));
  return (await import('./storage')).uploadAttachment;
}

describe('uploadAttachment', () => {
  it('returns null/undefined attachments untouched', async () => {
    const upload = await loadUploader({ isConfigured: true, storage: {} });
    expect(await upload(null, 'uid')).toBe(null);
    expect(await upload(undefined, 'uid')).toBe(undefined);
  });

  it('returns an attachment without a url untouched', async () => {
    const upload = await loadUploader({ isConfigured: true, storage: {} });
    const att = { name: 'f.png' };
    expect(await upload(att, 'uid')).toBe(att);
  });

  it('passes through unchanged in emulation mode (not configured)', async () => {
    const upload = await loadUploader({ isConfigured: false, storage: null });
    const att = { name: 'f.png', url: 'data:image/png;base64,AAAA' };
    expect(await upload(att, 'uid')).toBe(att);
  });

  it('is idempotent: an already-hosted (non-data) url passes through', async () => {
    const upload = await loadUploader({ isConfigured: true, storage: {} });
    const att = { name: 'f.png', url: 'https://hosted.example/already' };
    expect(await upload(att, 'uid')).toBe(att);
  });

  it('uploads a data: url and swaps in the hosted download url', async () => {
    const upload = await loadUploader({ isConfigured: true, storage: {} });
    const att = { name: 'pic.png', url: 'data:image/png;base64,AAAA' };
    const result = await upload(att, 'user-1');
    expect(result.url).toBe('https://hosted.example/download');
    expect(result.storagePath).toMatch(/^attachments\/user-1\//);
    expect(result.name).toBe('pic.png');
    // original object is not mutated
    expect(att.url).toBe('data:image/png;base64,AAAA');
  });

  it('sanitises unsafe characters in the stored filename', async () => {
    const upload = await loadUploader({ isConfigured: true, storage: {} });
    const att = { name: 'my photo (1)@home.png', url: 'data:image/png;base64,AAAA' };
    const result = await upload(att, 'user-1');
    expect(result.storagePath).not.toMatch(/[()@ ]/);
  });
});

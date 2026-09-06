import { describe, it, expect } from 'vitest';
import { readValidatedUpload } from './validate';

function makeFile(bytes: number, type: string): File {
  return new File([new Uint8Array(bytes)], 'test.bin', { type });
}

describe('readValidatedUpload', () => {
  const opts = { maxBytes: 5 * 1024 * 1024, allowedMimeTypes: ['image/png', 'image/jpeg'] as const };

  it('未指定なら file_missing', async () => {
    const result = await readValidatedUpload(null, opts);
    expect(result).toEqual({ ok: false, error: 'file_missing' });
  });

  it('文字列（Fileでない）なら file_missing', async () => {
    const result = await readValidatedUpload('not-a-file', opts);
    expect(result).toEqual({ ok: false, error: 'file_missing' });
  });

  it('空ファイルなら file_empty', async () => {
    const result = await readValidatedUpload(makeFile(0, 'image/png'), opts);
    expect(result).toEqual({ ok: false, error: 'file_empty' });
  });

  it('上限超過なら file_too_large', async () => {
    const result = await readValidatedUpload(makeFile(opts.maxBytes + 1, 'image/png'), opts);
    expect(result).toEqual({ ok: false, error: 'file_too_large' });
  });

  it('許可外MIMEタイプなら mime_type_not_allowed', async () => {
    const result = await readValidatedUpload(makeFile(100, 'application/x-msdownload'), opts);
    expect(result).toEqual({ ok: false, error: 'mime_type_not_allowed' });
  });

  it('正常なファイルはBufferとmimeTypeを返す', async () => {
    const result = await readValidatedUpload(makeFile(100, 'image/png'), opts);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.buffer.byteLength).toBe(100);
      expect(result.mimeType).toBe('image/png');
    }
  });

  it('上限ちょうどのサイズは許可される', async () => {
    const result = await readValidatedUpload(makeFile(opts.maxBytes, 'image/jpeg'), opts);
    expect(result.ok).toBe(true);
  });
});

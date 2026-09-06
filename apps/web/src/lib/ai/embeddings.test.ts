import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { embedText, embedTexts, isVoyageConfigured, toPgVectorLiteral } from './embeddings';

// lib/env.ts は @cloudflare/next-on-pages（'server-only' マーカーパッケージに依存）を
// 読み込むため、Next.js のビルドパイプライン（webpack）を経由しない vitest 実行では
// モジュール解決に失敗しうる（apps/web/src/lib/ai/client.test.ts と同じ制約）。
// このテストはVoyage AI呼び出しロジックのみを検証したいので、process.env を直接読む
// 薄いモックに差し替える（本番コードは変更しない）。
vi.mock('@/lib/env', () => ({
  getVoyageApiKey: () => process.env.VOYAGE_API_KEY,
  getVoyageModel: () => process.env.VOYAGE_MODEL ?? 'voyage-4-lite'
}));

describe('lib/ai/embeddings（Voyage AI連携・未設定時はundefinedへフォールバック）', () => {
  const originalKey = process.env.VOYAGE_API_KEY;
  const originalModel = process.env.VOYAGE_MODEL;
  const originalFetch = global.fetch;

  beforeEach(() => {
    delete process.env.VOYAGE_API_KEY;
    delete process.env.VOYAGE_MODEL;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.VOYAGE_API_KEY; else process.env.VOYAGE_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.VOYAGE_MODEL; else process.env.VOYAGE_MODEL = originalModel;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('VOYAGE_API_KEY未設定なら isVoyageConfigured は false', () => {
    expect(isVoyageConfigured()).toBe(false);
  });

  it('VOYAGE_API_KEY未設定時、embedText は undefined を返し、実APIを一切呼ばない（fetchが呼ばれない）', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await embedText('ケーソン据付装置');
    expect(result).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('VOYAGE_API_KEY未設定時、embedTexts は入力と同じ長さの全undefined配列を返す', async () => {
    const result = await embedTexts(['a', 'b', 'c']);
    expect(result).toEqual([undefined, undefined, undefined]);
  });

  it('空配列を渡すと空配列を返す（キー設定有無に関わらず）', async () => {
    expect(await embedTexts([])).toEqual([]);
  });

  it('VOYAGE_API_KEY設定時: Voyage AI Embeddings APIを正しいリクエスト形式で呼び出し、結果を順序通り返す', async () => {
    process.env.VOYAGE_API_KEY = 'test-key-not-real';
    process.env.VOYAGE_MODEL = 'voyage-4-lite';

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        object: 'list',
        model: 'voyage-4-lite',
        data: [
          { object: 'embedding', embedding: [0.1, 0.2], index: 0 },
          { object: 'embedding', embedding: [0.3, 0.4], index: 1 }
        ],
        usage: { total_tokens: 10 }
      })
    });
    global.fetch = fetchSpy as unknown as typeof fetch;

    const result = await embedTexts(['第一のテキスト', '第二のテキスト'], { inputType: 'document' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://api.voyageai.com/v1/embeddings');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-key-not-real');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('voyage-4-lite');
    expect(body.input).toEqual(['第一のテキスト', '第二のテキスト']);
    expect(body.input_type).toBe('document');
    expect(body.output_dimension).toBe(1024);

    expect(result).toEqual([[0.1, 0.2], [0.3, 0.4]]);
  });

  it('VOYAGE_API_KEY設定時でもAPIが非2xxを返した場合は例外を投げず、undefinedの配列を返す', async () => {
    process.env.VOYAGE_API_KEY = 'test-key-not-real';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized'
    }) as unknown as typeof fetch;

    const result = await embedTexts(['x']);
    expect(result).toEqual([undefined]);
  });

  it('VOYAGE_API_KEY設定時でもネットワークエラー時は例外を投げず、undefinedの配列を返す', async () => {
    process.env.VOYAGE_API_KEY = 'test-key-not-real';
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(embedTexts(['x'])).resolves.toEqual([undefined]);
  });
});

describe('toPgVectorLiteral', () => {
  it('数値配列をpgvectorの入力リテラル文字列（"[0.1,0.2,...]"）へ変換する', () => {
    expect(toPgVectorLiteral([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
  });

  it('空配列は "[]" になる', () => {
    expect(toPgVectorLiteral([])).toBe('[]');
  });
});

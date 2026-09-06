import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { buildDrawingPartsFromCandidates, runDrawingPartsExtraction } from './drawing-parts';

// lib/env.ts は @cloudflare/next-on-pages（'server-only' マーカーパッケージに依存）を
// 読み込むため、Next.js のビルドパイプライン（webpack）を経由しない vitest 実行では
// モジュール解決に失敗する。client.test.ts / claim-decompose.test.ts と同じ理由で、
// テストでは process.env を直接読む薄いモックに差し替える（本番コードは変更しない）。
vi.mock('@/lib/env', () => ({
  getAnthropicApiKey: () => process.env.ANTHROPIC_API_KEY,
  getAnthropicModel: () => process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
}));

// ADR-0006「実装上の必須ルール3」対応:
// 「ai_citations を作らない AI 実行パス」を検出するテスト。
// AIが返した部品候補の partNo/description が空文字列などで採用できない場合、
// drawing_parts / ai_citations の元となるデータを1件も作れないため、
// その実行パスは必ず status='invalid' になり、parts も空になることを保証する。

describe('buildDrawingPartsFromCandidates', () => {
  it('正常系: partNo/description が非空の候補はすべて採用され status=succeeded になる', () => {
    const result = buildDrawingPartsFromCandidates([
      { partNo: '1', description: '主要部材' },
      { partNo: '2', description: '付随部材' }
    ]);
    expect(result.status).toBe('succeeded');
    expect(result.parts).toEqual([
      { partNo: '1', description: '主要部材' },
      { partNo: '2', description: '付随部材' }
    ]);
  });

  it('前後の空白はトリムされる', () => {
    const result = buildDrawingPartsFromCandidates([{ partNo: '  1  ', description: '  主要部材  ' }]);
    expect(result.parts).toEqual([{ partNo: '1', description: '主要部材' }]);
  });

  it('partNoまたはdescriptionが空白のみの候補は除外される', () => {
    const result = buildDrawingPartsFromCandidates([
      { partNo: '   ', description: '主要部材' },
      { partNo: '1', description: '   ' }
    ]);
    expect(result.status).toBe('invalid');
    expect(result.parts).toHaveLength(0);
  });

  it('候補が0件なら status=invalid（ADR-0006ルール2: ai_citationsを作らないAI実行パスを禁止）', () => {
    const result = buildDrawingPartsFromCandidates([]);
    expect(result.status).toBe('invalid');
    expect(result.parts).toEqual([]);
  });
});

describe('runDrawingPartsExtraction（APIキー未設定時はモックへフォールバック）', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalModel = process.env.ANTHROPIC_MODEL;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.ANTHROPIC_MODEL; else process.env.ANTHROPIC_MODEL = originalModel;
  });

  it('APIキー未設定時は source=mock で status=succeeded、部品が2件生成される', async () => {
    const image = { data: Buffer.from('dummy-image-bytes'), mimeType: 'image/png' as const };
    const result = await runDrawingPartsExtraction(image, { figureNo: '図1', caption: 'ケーソン据付装置の全体図' });
    expect(result.status).toBe('succeeded');
    expect(result.source).toBe('mock');
    expect(result.parts.length).toBeGreaterThan(0);
    for (const part of result.parts) {
      expect(part.partNo).toBeTruthy();
      expect(part.description).toBeTruthy();
    }
    expect(result.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('同一入力なら常に同一ハッシュ（再現性）', async () => {
    const image = { data: Buffer.from('same-bytes'), mimeType: 'image/png' as const };
    const hint = { figureNo: '図2', caption: null };
    const r1 = await runDrawingPartsExtraction(image, hint);
    const r2 = await runDrawingPartsExtraction(image, hint);
    expect(r1.inputHash).toBe(r2.inputHash);
  });
});

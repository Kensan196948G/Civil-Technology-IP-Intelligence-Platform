import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { vi } from 'vitest';
import { buildTechElementsFromCandidates, runTechElementsExtraction } from './tech-elements';

// lib/env.ts は @cloudflare/next-on-pages（'server-only' マーカーパッケージに依存）を
// 読み込むため、Next.js のビルドパイプライン（webpack）を経由しない vitest 実行では
// モジュール解決に失敗する。他のlib/aiテストと同じ理由で薄いモックに差し替える
// （本番コードは変更しない）。
vi.mock('@/lib/env', () => ({
  getAnthropicApiKey: () => process.env.ANTHROPIC_API_KEY,
  getAnthropicModel: () => process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
}));

// ADR-0006「実装上の必須ルール3」対応:
// 「ai_citations を作らない AI 実行パス」を検出するテスト。
// AIが返した技術要素候補の elementLabel が空文字列などで採用できない場合、
// extracted_tech_elements / ai_citations の元となるデータを1件も作れないため、
// その実行パスは必ず status='invalid' になり、elements も空になることを保証する。

describe('buildTechElementsFromCandidates', () => {
  it('正常系: elementLabelが非空の候補はすべて採用され status=succeeded になる', () => {
    const result = buildTechElementsFromCandidates([
      { elementLabel: '工法A', description: '説明A', confidence: 0.8 },
      { elementLabel: '工法B' }
    ]);
    expect(result.status).toBe('succeeded');
    expect(result.elements).toEqual([
      { elementLabel: '工法A', description: '説明A', confidence: 0.8 },
      { elementLabel: '工法B', description: null, confidence: null }
    ]);
  });

  it('前後の空白はトリムされる', () => {
    const result = buildTechElementsFromCandidates([{ elementLabel: '  工法A  ', description: '  説明A  ' }]);
    expect(result.elements).toEqual([{ elementLabel: '工法A', description: '説明A', confidence: null }]);
  });

  it('elementLabelが空白のみの候補は除外される', () => {
    const result = buildTechElementsFromCandidates([{ elementLabel: '   ', description: '説明' }]);
    expect(result.status).toBe('invalid');
    expect(result.elements).toHaveLength(0);
  });

  it('候補が0件なら status=invalid（ADR-0006ルール2: ai_citationsを作らないAI実行パスを禁止）', () => {
    const result = buildTechElementsFromCandidates([]);
    expect(result.status).toBe('invalid');
    expect(result.elements).toEqual([]);
  });
});

describe('runTechElementsExtraction（APIキー未設定時はモックへフォールバック）', () => {
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

  it('photo: APIキー未設定時は source=mock で status=succeeded、要素が生成される', async () => {
    const file = { data: Buffer.from('dummy-photo-bytes'), mimeType: 'image/jpeg', docType: 'photo' as const };
    const result = await runTechElementsExtraction(file, { title: '現場写真_基礎工事.jpg' });
    expect(result.status).toBe('succeeded');
    expect(result.source).toBe('mock');
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.inputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('pdf: APIキー未設定時は source=mock で status=succeeded', async () => {
    const file = { data: Buffer.from('%PDF-1.4 dummy'), mimeType: 'application/pdf', docType: 'pdf' as const };
    const result = await runTechElementsExtraction(file, { title: '施工計画書.pdf' });
    expect(result.status).toBe('succeeded');
    expect(result.source).toBe('mock');
  });

  it('同一入力なら常に同一ハッシュ（再現性）', async () => {
    const file = { data: Buffer.from('same-bytes'), mimeType: 'image/png', docType: 'sketch' as const };
    const hint = { title: 'スケッチ1' };
    const r1 = await runTechElementsExtraction(file, hint);
    const r2 = await runTechElementsExtraction(file, hint);
    expect(r1.inputHash).toBe(r2.inputHash);
  });
});

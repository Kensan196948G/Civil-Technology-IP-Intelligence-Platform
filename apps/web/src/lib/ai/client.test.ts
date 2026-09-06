import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  decomposeClaimText,
  mockDecomposeClaim,
  isAnthropicConfigured,
  ClaimDecompositionSchema,
  CLAIM_DECOMPOSE_PROMPT_VERSION
} from './client';

// lib/env.ts は @cloudflare/next-on-pages（'server-only' マーカーパッケージに依存）を
// 読み込むため、Next.js のビルドパイプライン（webpack）を経由しない vitest 実行では
// モジュール解決に失敗する（next build では webpack のエイリアス解決により問題ない）。
// このモジュールはDBやNext.js固有機能を使わない純粋ロジックのユニットテストなので、
// lib/env.ts を実体化させずテスト対象のロジックだけを検証できるよう、process.env を
// 直接読む薄いモックに差し替える（本番コードは変更しない。vi.mock はファイル先頭へ
// 自動的に巻き上げられるため import 文より後ろに書いても適用される）。
vi.mock('@/lib/env', () => ({
  getAnthropicApiKey: () => process.env.ANTHROPIC_API_KEY,
  getAnthropicModel: () => process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
}));

// ANTHROPIC_API_KEY が未設定の環境（CI・大半のローカル開発）でも決定論的に検証できる
// よう、常にキーを明示的に unset した状態でテストする。
describe('lib/ai/client（Anthropic連携・未設定時はモックへフォールバック）', () => {
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

  it('APIキー未設定なら isAnthropicConfigured は false', () => {
    expect(isAnthropicConfigured()).toBe(false);
  });

  it('mockDecomposeClaim: 日本語の読点で機械的に分割し、常にclaimText範囲内のオフセットを返す', () => {
    const claimText = 'ケーソンを吊り下げる吊具と、当該吊具の姿勢を計測する計測手段と、演算手段と、を備える、ケーソン据付装置。';
    const elements = mockDecomposeClaim(claimText);
    expect(elements.length).toBeGreaterThan(1);
    for (const el of elements) {
      expect(el.charStart).toBeGreaterThanOrEqual(0);
      expect(el.charEnd).toBeGreaterThan(el.charStart);
      expect(el.charEnd).toBeLessThanOrEqual(claimText.length);
      // オフセットが実際にclaimText中の文字列を指していること
      expect(claimText.slice(el.charStart, el.charEnd).length).toBeGreaterThan(0);
    }
    // ラベルは A, B, C... と振られる
    expect(elements[0]!.label).toBe('A');
  });

  it('mockDecomposeClaim: 読点が無い場合は全体を1要素として返す', () => {
    const claimText = 'A device comprising a means for lifting.';
    const elements = mockDecomposeClaim(claimText);
    expect(elements).toHaveLength(1);
    expect(elements[0]!.charStart).toBe(0);
    expect(elements[0]!.charEnd).toBe(claimText.length);
  });

  it('mockDecomposeClaim: 空文字列は要素0件', () => {
    expect(mockDecomposeClaim('')).toEqual([]);
    expect(mockDecomposeClaim('   ')).toEqual([]);
  });

  it('decomposeClaimText: APIキー未設定時は source=mock で決定論的な結果を返す（実APIを呼ばない）', async () => {
    const claimText = '第一の部材と、第二の部材と、を備える装置。';
    const result = await decomposeClaimText(claimText);
    expect(result.source).toBe('mock');
    expect(result.model).toBeTruthy();
    expect(result.promptVersion).toBe(CLAIM_DECOMPOSE_PROMPT_VERSION);
    expect(result.tokenUsage).toBeNull();
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.inputHash).toMatch(/^[0-9a-f]{64}$/);

    // 同一入力なら常に同一ハッシュ（再現性）
    const result2 = await decomposeClaimText(claimText);
    expect(result2.inputHash).toBe(result.inputHash);
  });

  it('decomposeClaimText: ANTHROPIC_MODEL でモデル名を上書きできる', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-custom-test';
    const result = await decomposeClaimText('第一の部材を備える装置。');
    expect(result.model).toBe('claude-custom-test');
  });

  it('ClaimDecompositionSchema: 不正な形式（オフセットが数値でない）は検証エラーになる', () => {
    const parsed = ClaimDecompositionSchema.safeParse({
      elements: [{ label: 'A', charStart: 'not-a-number', charEnd: 5 }]
    });
    expect(parsed.success).toBe(false);
  });

  it('ClaimDecompositionSchema: elements が空配列は検証エラーになる（ai_citations 0件を防ぐ最低限のガード）', () => {
    const parsed = ClaimDecompositionSchema.safeParse({ elements: [] });
    expect(parsed.success).toBe(false);
  });

  it('ClaimDecompositionSchema: 正しい形式は検証を通る', () => {
    const parsed = ClaimDecompositionSchema.safeParse({
      elements: [{ label: 'A', charStart: 0, charEnd: 3 }]
    });
    expect(parsed.success).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  extractQuote,
  buildDecompositionFromCandidates,
  runClaimDecomposition
} from './claim-decompose';

// lib/env.ts は @cloudflare/next-on-pages（'server-only' マーカーパッケージに依存）を
// 読み込むため、Next.js のビルドパイプライン（webpack）を経由しない vitest 実行では
// モジュール解決に失敗する（next build では webpack のエイリアス解決により問題ない）。
// client.test.ts と同じ理由で、テストでは process.env を直接読む薄いモックに差し替える。
vi.mock('@/lib/env', () => ({
  getAnthropicApiKey: () => process.env.ANTHROPIC_API_KEY,
  getAnthropicModel: () => process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
}));

// ADR-0006「実装上の必須ルール3」対応:
// 「ai_citations を作らない AI 実行パス」を検出するテスト。
// AIが返した構成要件候補の charStart/charEnd が claim 原文と整合しない場合、
// quoted_text（＝ai_citations の元）を1件も作れないため、その実行パスは必ず
// status='invalid' になり、claim_elements への insert 相当のデータ（elements）も
// 空になることを保証する。

describe('extractQuote（ADR-0006ルール1: quoted_textはAIに生成させず機械的に切り出す）', () => {
  const claimText = 'ケーソンを吊り下げる吊具と、計測手段と、を備える装置。';

  it('正常な範囲なら claimText から該当文字列をそのまま切り出す', () => {
    expect(extractQuote(claimText, 0, 5)).toBe(claimText.slice(0, 5));
  });

  it('charStart >= charEnd は不正として null', () => {
    expect(extractQuote(claimText, 5, 5)).toBeNull();
    expect(extractQuote(claimText, 8, 3)).toBeNull();
  });

  it('負のオフセットは不正として null', () => {
    expect(extractQuote(claimText, -1, 3)).toBeNull();
  });

  it('claimText の長さを超える charEnd は不正として null', () => {
    expect(extractQuote(claimText, 0, claimText.length + 10)).toBeNull();
  });

  it('非整数のオフセットは不正として null', () => {
    expect(extractQuote(claimText, 0.5, 3)).toBeNull();
  });
});

describe('buildDecompositionFromCandidates', () => {
  const claimText = '第一の部材と、第二の部材と、を備える装置。';

  it('正常系: 有効な候補はすべて採用され status=succeeded になる', () => {
    const result = buildDecompositionFromCandidates(claimText, [
      { label: 'A', charStart: 0, charEnd: 6 },
      { label: 'B', charStart: 7, charEnd: 13 }
    ]);
    expect(result.status).toBe('succeeded');
    expect(result.elements).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    // quoted_text 相当（text）は claimText からの機械的な切り出しそのものであること
    for (const el of result.elements) {
      expect(claimText.includes(el.text)).toBe(true);
    }
  });

  it('異常系（AI実行パスが引用ゼロ）: 全候補が不正なオフセットなら status=invalid、elementsは空', () => {
    const result = buildDecompositionFromCandidates(claimText, [
      { label: 'A', charStart: -1, charEnd: 5 },
      { label: 'B', charStart: 100, charEnd: 200 }
    ]);
    expect(result.status).toBe('invalid');
    expect(result.elements).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every(s => s.reason === 'char_range_invalid')).toBe(true);
  });

  it('部分的に不正な候補は個別にスキップし、正常な候補は採用する（他要素は正常処理）', () => {
    const result = buildDecompositionFromCandidates(claimText, [
      { label: 'A', charStart: 0, charEnd: 6 },
      { label: 'B', charStart: 999, charEnd: 1000 }
    ]);
    expect(result.status).toBe('succeeded');
    expect(result.elements).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it('候補が0件（空配列）なら status=invalid', () => {
    const result = buildDecompositionFromCandidates(claimText, []);
    expect(result.status).toBe('invalid');
    expect(result.elements).toHaveLength(0);
  });
});

describe('runClaimDecomposition（AI/モック呼び出し + 機械抽出のエンドツーエンド）', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('正常系: APIキー未設定（モック）でも ai_citations 相当のデータが必ず作られ status=succeeded になる', async () => {
    const claimText = '第一の部材と、第二の部材と、を備える装置。';
    const run = await runClaimDecomposition(claimText);
    expect(run.status).toBe('succeeded');
    expect(run.source).toBe('mock');
    expect(run.elements.length).toBeGreaterThan(0);
    expect(run.error).toBeNull();
  });

  it('異常系: AI（呼び出し）が例外を投げた場合は status=failed になり elements は空', async () => {
    const clientModule = await import('./client');
    vi.spyOn(clientModule, 'decomposeClaimText').mockRejectedValueOnce(
      new clientModule.AiClientError('モック障害テスト')
    );
    const run = await runClaimDecomposition('第一の部材を備える装置。');
    expect(run.status).toBe('failed');
    expect(run.elements).toHaveLength(0);
    expect(run.error).toContain('モック障害テスト');
  });
});

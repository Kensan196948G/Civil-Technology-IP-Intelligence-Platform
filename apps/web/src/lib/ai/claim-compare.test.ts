import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  buildComparisonFromCandidates,
  runClaimComparison,
  type ClaimElementInput
} from './claim-compare';

// lib/env.ts は @cloudflare/next-on-pages（'server-only' マーカーパッケージに依存）を
// 読み込むため、Next.js のビルドパイプライン（webpack）を経由しない vitest 実行では
// モジュール解決に失敗する（next build では webpack のエイリアス解決により問題ない）。
// client.test.ts / claim-decompose.test.ts と同じ理由で、テストでは process.env を
// 直接読む薄いモックに差し替える。
vi.mock('@/lib/env', () => ({
  getAnthropicApiKey: () => process.env.ANTHROPIC_API_KEY,
  getAnthropicModel: () => process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-5'
}));

// ADR-0006「実装上の必須ルール3」対応:
// 「ai_citations を作らない AI 実行パス」を検出するテスト。
// AIが返した比較候補の charStart/charEnd が自社技術の説明文と整合しない場合、
// quoted_text（＝ai_citations の元）を1件も作れないため、その実行パスは必ず
// status='invalid' になり、claim_chart_rows への insert 相当のデータ（rows）も
// 空になることを保証する。

describe('buildComparisonFromCandidates（ADR-0006ルール1: quoted_textはAIに生成させず機械的に切り出す）', () => {
  const technologyText = '当社が港湾工事で運用する据付管理技術のデモデータ。動揺補償は未実装。';
  const elements: ClaimElementInput[] = [
    { label: 'A', text: 'ケーソンを吊り下げる吊具' },
    { label: 'B', text: '当該吊具の姿勢を計測する計測手段' }
  ];

  it('正常系: 有効な候補はすべて採用され status=succeeded になる', () => {
    const result = buildComparisonFromCandidates(elements, technologyText, [
      { elementLabel: 'A', kind: 'similar', rationale: '吊具に相当する記載がある', charStart: 0, charEnd: 10 },
      { elementLabel: 'B', kind: 'differ', rationale: '計測手段の記載はない', charStart: 11, charEnd: 20 }
    ]);
    expect(result.status).toBe('succeeded');
    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    // quoted_text 相当（quotedText）は technologyText からの機械的な切り出しそのものであること
    for (const row of result.rows) {
      expect(technologyText.includes(row.quotedText)).toBe(true);
    }
    // seq は入力 elements の順序（1始まり）に対応する
    expect(result.rows.find(r => r.elementLabel === 'A')?.seq).toBe(1);
    expect(result.rows.find(r => r.elementLabel === 'B')?.seq).toBe(2);
  });

  it('異常系（AI実行パスが引用ゼロ）: 全候補が不正なオフセットなら status=invalid、rowsは空', () => {
    const result = buildComparisonFromCandidates(elements, technologyText, [
      { elementLabel: 'A', kind: 'match', rationale: 'x', charStart: -1, charEnd: 5 },
      { elementLabel: 'B', kind: 'match', rationale: 'y', charStart: 999, charEnd: 1000 }
    ]);
    expect(result.status).toBe('invalid');
    expect(result.rows).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.skipped.every(s => s.reason === 'char_range_invalid')).toBe(true);
  });

  it('部分的に不正な候補は個別にスキップし、正常な候補は採用する（他要素は正常処理）', () => {
    const result = buildComparisonFromCandidates(elements, technologyText, [
      { elementLabel: 'A', kind: 'match', rationale: 'x', charStart: 0, charEnd: 10 },
      { elementLabel: 'B', kind: 'match', rationale: 'y', charStart: 9999, charEnd: 10000 }
    ]);
    expect(result.status).toBe('succeeded');
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
  });

  it('候補が0件（空配列）なら status=invalid', () => {
    const result = buildComparisonFromCandidates(elements, technologyText, []);
    expect(result.status).toBe('invalid');
    expect(result.rows).toHaveLength(0);
  });

  it('未知の elementLabel はスキップする（reason=unknown_element_label）', () => {
    const result = buildComparisonFromCandidates(elements, technologyText, [
      { elementLabel: 'Z', kind: 'match', rationale: 'x', charStart: 0, charEnd: 5 }
    ]);
    expect(result.status).toBe('invalid');
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe('unknown_element_label');
  });

  it('同じ elementLabel が重複した場合、2件目以降はスキップする（reason=duplicate_element_label）', () => {
    const result = buildComparisonFromCandidates(elements, technologyText, [
      { elementLabel: 'A', kind: 'match', rationale: 'x', charStart: 0, charEnd: 10 },
      { elementLabel: 'A', kind: 'differ', rationale: 'y', charStart: 11, charEnd: 20 }
    ]);
    expect(result.status).toBe('succeeded');
    expect(result.rows).toHaveLength(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toBe('duplicate_element_label');
  });
});

describe('runClaimComparison（AI/モック呼び出し + 機械抽出のエンドツーエンド）', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  const elements: ClaimElementInput[] = [
    { label: 'A', text: 'ケーソンを吊り下げる吊具' },
    { label: 'B', text: '当該吊具の姿勢を計測する計測手段' }
  ];
  const technologyText = '当社が港湾工事で運用する据付管理技術のデモデータ。動揺補償は未実装。';

  it('正常系: APIキー未設定（モック）でも ai_citations 相当のデータが必ず作られ status=succeeded になる', async () => {
    const run = await runClaimComparison(elements, technologyText);
    expect(run.status).toBe('succeeded');
    expect(run.source).toBe('mock');
    expect(run.rows.length).toBeGreaterThan(0);
    expect(run.error).toBeNull();
    for (const row of run.rows) {
      expect(technologyText.includes(row.quotedText)).toBe(true);
    }
  });

  it('異常系: 自社技術の説明文が空の場合は候補が作れず status=invalid になる', async () => {
    const run = await runClaimComparison(elements, '   ');
    expect(run.status).toBe('invalid');
    expect(run.rows).toHaveLength(0);
  });

  it('異常系: AI（呼び出し）が例外を投げた場合は status=failed になり rows は空', async () => {
    const clientModule = await import('./client');
    vi.spyOn(clientModule, 'compareClaimElements').mockRejectedValueOnce(
      new clientModule.AiClientError('モック障害テスト')
    );
    const run = await runClaimComparison(elements, technologyText);
    expect(run.status).toBe('failed');
    expect(run.rows).toHaveLength(0);
    expect(run.error).toContain('モック障害テスト');
  });
});

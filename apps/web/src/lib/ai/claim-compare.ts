// FR-M06-005/006/007: Claim Chart / Claim Matrix 生成のオーケストレーション。
// DBに依存しない純粋ロジックとして切り出し、CI上でユニットテスト可能にする
// （claim-decompose.ts と同じ方針。ADR-0006「実装上の必須ルール3」対応）。
//
// 正とする文書: docs/20-architecture/adr/ADR-0006-provenance-first.md。
// ルール1: quoted_text はAIに生成させず、原文（この機能では自社技術の説明文）から
//          機械的に切り出す。
// ルール2: ai_citations が0件の ai_runs は status='invalid' とし、確定成果物にしない。
import {
  compareClaimElements,
  AiClientError,
  CLAIM_COMPARE_PROMPT_VERSION,
  type ClaimCompareRowCandidate,
  type ClaimElementInput,
  type TokenUsage
} from './client';
import { extractSubstring } from './text-extract';
import { getAnthropicModel } from '@/lib/env';

export type { ClaimElementInput };

export type ClaimMatchKind = 'match' | 'similar' | 'differ';

export interface ComparedRow {
  /** 入力 elements の順序（1始まり）。claim_chart_rows.seq にそのまま使う。 */
  seq: number;
  elementLabel: string;
  kind: ClaimMatchKind;
  rationale: string;
  /** technologyText から charStart/charEnd を使って機械的に切り出した文字列（AI生成ではない）。 */
  quotedText: string;
  charStart: number;
  charEnd: number;
}

export interface SkippedComparisonCandidate {
  elementLabel: string;
  charStart: number;
  charEnd: number;
  reason: 'char_range_invalid' | 'unknown_element_label' | 'duplicate_element_label';
}

export type ClaimComparisonStatus = 'succeeded' | 'invalid' | 'failed';

export interface ClaimComparisonRun {
  status: ClaimComparisonStatus;
  source: 'live' | 'mock' | null;
  model: string;
  promptVersion: string;
  params: Record<string, unknown>;
  inputHash: string | null;
  tokenUsage: TokenUsage | null;
  /** status==='succeeded' の場合のみ非空。ai_citations が0件なら 'invalid' になるため、
   *  ここが空配列の場合は claim_analyses / claim_chart_rows への insert を行ってはならない。 */
  rows: ComparedRow[];
  skipped: SkippedComparisonCandidate[];
  /** status==='failed' の場合のエラーメッセージ。 */
  error: string | null;
}

/**
 * AI（またはモック）が返した比較候補リストから、elements と technologyText に
 * 整合する行のみを採用し、不正な行はスキップしてログに残せる形にする。
 * DBに依存しない純粋関数。
 *
 * 採用しない条件（いずれか該当でスキップ）:
 * - elementLabel が入力 elements のどのラベルとも一致しない（'unknown_element_label'）
 * - 同じ elementLabel の行が既に採用済み（'duplicate_element_label'、AIが同じ要件を
 *   複数回返した場合の重複防止）
 * - charStart/charEnd が technologyText の範囲外・不整合（'char_range_invalid'）
 *
 * ai_citations に相当する行が1件も作れない場合は status='invalid' とする
 * （ADR-0006ルール2）。
 */
export function buildComparisonFromCandidates(
  elements: ClaimElementInput[],
  technologyText: string,
  candidates: ClaimCompareRowCandidate[]
): { status: 'succeeded' | 'invalid'; rows: ComparedRow[]; skipped: SkippedComparisonCandidate[] } {
  const seqByLabel = new Map(elements.map((el, idx) => [el.label, idx + 1]));
  const seenLabels = new Set<string>();
  const rows: ComparedRow[] = [];
  const skipped: SkippedComparisonCandidate[] = [];

  for (const candidate of candidates) {
    const seq = seqByLabel.get(candidate.elementLabel);
    if (seq === undefined) {
      skipped.push({
        elementLabel: candidate.elementLabel,
        charStart: candidate.charStart,
        charEnd: candidate.charEnd,
        reason: 'unknown_element_label'
      });
      console.warn('[ai/claim-compare] 未知の構成要件ラベルのためスキップ', candidate);
      continue;
    }
    if (seenLabels.has(candidate.elementLabel)) {
      skipped.push({
        elementLabel: candidate.elementLabel,
        charStart: candidate.charStart,
        charEnd: candidate.charEnd,
        reason: 'duplicate_element_label'
      });
      console.warn('[ai/claim-compare] 構成要件ラベルが重複したためスキップ', candidate);
      continue;
    }
    const quote = extractSubstring(technologyText, candidate.charStart, candidate.charEnd);
    if (quote === null) {
      skipped.push({
        elementLabel: candidate.elementLabel,
        charStart: candidate.charStart,
        charEnd: candidate.charEnd,
        reason: 'char_range_invalid'
      });
      console.warn('[ai/claim-compare] charStart/charEndが不正なためスキップ', {
        elementLabel: candidate.elementLabel,
        charStart: candidate.charStart,
        charEnd: candidate.charEnd,
        technologyTextLength: technologyText.length
      });
      continue;
    }
    seenLabels.add(candidate.elementLabel);
    rows.push({
      seq,
      elementLabel: candidate.elementLabel,
      kind: candidate.kind,
      rationale: candidate.rationale,
      quotedText: quote,
      charStart: candidate.charStart,
      charEnd: candidate.charEnd
    });
  }

  rows.sort((a, b) => a.seq - b.seq);
  return { status: rows.length > 0 ? 'succeeded' : 'invalid', rows, skipped };
}

/**
 * Claim比較のエンドツーエンド実行（AI/モック呼び出し + 機械的な引用抽出）。
 * DB書き込みは行わない（呼び出し元の Server Action がこの結果を元に
 * claim_analyses / claim_chart_rows / ai_runs / ai_citations へ書き込む）。
 */
export async function runClaimComparison(
  elements: ClaimElementInput[],
  technologyText: string,
  opts: { model?: string } = {}
): Promise<ClaimComparisonRun> {
  try {
    const raw = await compareClaimElements(elements, technologyText, opts);
    const built = buildComparisonFromCandidates(elements, technologyText, raw.rows);
    return {
      status: built.status,
      source: raw.source,
      model: raw.model,
      promptVersion: raw.promptVersion,
      params: raw.params,
      inputHash: raw.inputHash,
      tokenUsage: raw.tokenUsage,
      rows: built.rows,
      skipped: built.skipped,
      error: null
    };
  } catch (err) {
    const message = err instanceof AiClientError || err instanceof Error ? err.message : String(err);
    return {
      status: 'failed',
      source: null,
      model: opts.model ?? getAnthropicModel(),
      promptVersion: CLAIM_COMPARE_PROMPT_VERSION,
      params: {},
      inputHash: null,
      tokenUsage: null,
      rows: [],
      skipped: [],
      error: message
    };
  }
}

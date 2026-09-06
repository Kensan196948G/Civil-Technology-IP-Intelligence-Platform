// Claim（請求項）AI分解のオーケストレーション。DBに依存しない純粋ロジックとして
// 切り出し、CI上でユニットテスト可能にする（ADR-0006 実装上の必須ルール3:
// 「ai_citations を作らない AI 実行パス」を検出するテストを置く、への対応）。
//
// 正とする文書: docs/20-architecture/adr/ADR-0006-provenance-first.md。
// ルール1: quoted_text はAIに生成させず、原文から機械的に切り出す。
// ルール2: ai_citations が0件の ai_runs は status='invalid' とし、確定成果物にしない。
import {
  decomposeClaimText,
  AiClientError,
  CLAIM_DECOMPOSE_PROMPT_VERSION,
  type ClaimElementCandidate,
  type TokenUsage
} from './client';
import { getAnthropicModel } from '@/lib/env';
import { extractSubstring } from './text-extract';

export interface DecomposedElement {
  seq: number;
  label: string;
  /** claimText から charStart/charEnd を使って機械的に切り出した文字列（AI生成ではない）。 */
  text: string;
  charStart: number;
  charEnd: number;
}

export interface SkippedCandidate {
  label: string;
  charStart: number;
  charEnd: number;
  reason: 'char_range_invalid';
}

export type ClaimDecompositionStatus = 'succeeded' | 'invalid' | 'failed';

export interface ClaimDecompositionRun {
  status: ClaimDecompositionStatus;
  source: 'live' | 'mock' | null;
  model: string;
  promptVersion: string;
  params: Record<string, unknown>;
  inputHash: string | null;
  tokenUsage: TokenUsage | null;
  /** status==='succeeded' の場合のみ非空。ai_citations が0件なら 'invalid' になるため、
   *  ここが空配列の場合は claim_elements への insert を行ってはならない。 */
  elements: DecomposedElement[];
  skipped: SkippedCandidate[];
  /** status==='failed' の場合のエラーメッセージ。 */
  error: string | null;
}

/**
 * claimText の charStart/charEnd の範囲が有効な場合のみ、機械的に該当文字列を
 * 切り出して返す。範囲外・不整合（charStart>=charEnd、負数、非整数、claimText
 * の長さを超える等）の場合は null を返す（ADR-0006ルール1の厳格な実装）。
 * 実体は lib/ai/text-extract.ts の共通実装（claim-compare.ts と共用）。
 */
export function extractQuote(claimText: string, charStart: number, charEnd: number): string | null {
  return extractSubstring(claimText, charStart, charEnd);
}

/**
 * AI（またはモック）が返した候補リストから、claimText と整合する要素のみを
 * 採用し、不正な要素はスキップしてログに残せる形にする。DBに依存しない純粋関数。
 * ai_citations に相当する候補が1件も作れない場合は status='invalid' とする
 * （ADR-0006ルール2）。
 */
export function buildDecompositionFromCandidates(
  claimText: string,
  candidates: ClaimElementCandidate[]
): { status: 'succeeded' | 'invalid'; elements: DecomposedElement[]; skipped: SkippedCandidate[] } {
  const elements: DecomposedElement[] = [];
  const skipped: SkippedCandidate[] = [];
  let seq = 1;

  for (const candidate of candidates) {
    const quote = extractQuote(claimText, candidate.charStart, candidate.charEnd);
    if (quote === null) {
      skipped.push({
        label: candidate.label,
        charStart: candidate.charStart,
        charEnd: candidate.charEnd,
        reason: 'char_range_invalid'
      });
      // CI/運用ログで「AIが不正なオフセットを返した」ことを追跡できるようにする。
      console.warn('[ai/claim-decompose] charStart/charEndが不正なためスキップ', {
        label: candidate.label,
        charStart: candidate.charStart,
        charEnd: candidate.charEnd,
        claimTextLength: claimText.length
      });
      continue;
    }
    elements.push({ seq: seq++, label: candidate.label, text: quote, charStart: candidate.charStart, charEnd: candidate.charEnd });
  }

  return { status: elements.length > 0 ? 'succeeded' : 'invalid', elements, skipped };
}

/**
 * Claim分解のエンドツーエンド実行（AI/モック呼び出し + 機械的な引用抽出）。
 * DB書き込みは行わない（呼び出し元の Server Action がこの結果を元に
 * ai_runs / claim_elements / ai_citations へ書き込む）。
 */
export async function runClaimDecomposition(
  claimText: string,
  opts: { model?: string } = {}
): Promise<ClaimDecompositionRun> {
  try {
    const raw = await decomposeClaimText(claimText, opts);
    const built = buildDecompositionFromCandidates(claimText, raw.elements);
    return {
      status: built.status,
      source: raw.source,
      model: raw.model,
      promptVersion: raw.promptVersion,
      params: raw.params,
      inputHash: raw.inputHash,
      tokenUsage: raw.tokenUsage,
      elements: built.elements,
      skipped: built.skipped,
      error: null
    };
  } catch (err) {
    const message = err instanceof AiClientError || err instanceof Error ? err.message : String(err);
    return {
      status: 'failed',
      source: null,
      model: opts.model ?? getAnthropicModel(),
      promptVersion: CLAIM_DECOMPOSE_PROMPT_VERSION,
      params: {},
      inputHash: null,
      tokenUsage: null,
      elements: [],
      skipped: [],
      error: message
    };
  }
}

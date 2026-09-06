// M48 Engineering Document Intelligence — 技術要素抽出のオーケストレーション。
// DBに依存しない純粋ロジックとして切り出し、CI上でユニットテスト可能にする
// （ADR-0006 実装上の必須ルール3: 「ai_citations を作らない AI 実行パス」を
// 検出するテストを置く、への対応）。
//
// 正とする文書: docs/20-architecture/adr/ADR-0006-provenance-first.md。
// 画像/PDF固有の対応: quoted_text はAIに生成させず、DBに実在し閲覧可能な検証可能情報
// （文書タイトル）を呼び出し元（Server Action）で使う。ここでは「AIが返した技術要素候補の
// うち採用可能なもの」を機械的に絞り込むところまでを担う。
// ルール2: 採用可能な要素が0件の場合は status='invalid' とし、確定成果物にしない。
import {
  extractTechElementsFromFile,
  AiClientError,
  TECH_ELEMENTS_PROMPT_VERSION,
  type TechElementCandidate,
  type TokenUsage,
  type EngineeringDocType
} from './client';
import { getAnthropicModel } from '@/lib/env';

export interface ExtractedTechElement {
  elementLabel: string;
  description: string | null;
  confidence: number | null;
}

export type TechElementsExtractionStatus = 'succeeded' | 'invalid' | 'failed';

export interface TechElementsExtractionRun {
  status: TechElementsExtractionStatus;
  source: 'live' | 'mock' | null;
  model: string;
  promptVersion: string;
  params: Record<string, unknown>;
  inputHash: string | null;
  tokenUsage: TokenUsage | null;
  /** status==='succeeded' の場合のみ非空。0件なら 'invalid' になるため、
   *  ここが空配列の場合は extracted_tech_elements への insert を行ってはならない。 */
  elements: ExtractedTechElement[];
  error: string | null;
}

/**
 * AI（またはモック）が返した技術要素候補から、elementLabel が非空の候補のみを採用する。
 * DBに依存しない純粋関数。採用可能な要素が1件も無い場合は status='invalid' とする
 * （ADR-0006ルール2）。
 */
export function buildTechElementsFromCandidates(
  candidates: TechElementCandidate[]
): { status: 'succeeded' | 'invalid'; elements: ExtractedTechElement[] } {
  const elements: ExtractedTechElement[] = [];
  for (const candidate of candidates) {
    const elementLabel = candidate.elementLabel.trim();
    if (!elementLabel) continue;
    const description = candidate.description?.trim();
    elements.push({
      elementLabel,
      description: description ? description : null,
      confidence: candidate.confidence ?? null
    });
  }
  return { status: elements.length > 0 ? 'succeeded' : 'invalid', elements };
}

/**
 * 技術文書ファイルの技術要素抽出のエンドツーエンド実行（AI/モック呼び出し + 機械的な絞り込み）。
 * DB書き込みは行わない（呼び出し元の Server Action がこの結果を元に
 * ai_runs / extracted_tech_elements / ai_citations へ書き込む。quoted_text は文書タイトル等の
 * 検証可能な情報を使うこと。AIの description をそのまま quoted_text にしないこと）。
 */
export async function runTechElementsExtraction(
  file: { data: Buffer; mimeType: string; docType: EngineeringDocType },
  hint: { title: string },
  opts: { model?: string } = {}
): Promise<TechElementsExtractionRun> {
  try {
    const raw = await extractTechElementsFromFile(file, hint, opts);
    const built = buildTechElementsFromCandidates(raw.elements);
    return {
      status: built.status,
      source: raw.source,
      model: raw.model,
      promptVersion: raw.promptVersion,
      params: raw.params,
      inputHash: raw.inputHash,
      tokenUsage: raw.tokenUsage,
      elements: built.elements,
      error: null
    };
  } catch (err) {
    const message = err instanceof AiClientError || err instanceof Error ? err.message : String(err);
    return {
      status: 'failed',
      source: null,
      model: opts.model ?? getAnthropicModel(),
      promptVersion: TECH_ELEMENTS_PROMPT_VERSION,
      params: {},
      inputHash: null,
      tokenUsage: null,
      elements: [],
      error: message
    };
  }
}

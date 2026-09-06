// M47 Patent Drawing / Image Intelligence — 図面部品認識のオーケストレーション。
// DBに依存しない純粋ロジックとして切り出し、CI上でユニットテスト可能にする
// （ADR-0006 実装上の必須ルール3: 「ai_citations を作らない AI 実行パス」を
// 検出するテストを置く、への対応）。
//
// 正とする文書: docs/20-architecture/adr/ADR-0006-provenance-first.md。
// ルール1相当（画像固有の対応）: quoted_text はAIに生成させず、DBに実在し
// 閲覧可能な検証可能情報（図番・キャプション）を呼び出し元（Server Action）で使う。
// ここでは「AIが返した部品候補のうち採用可能なもの」を機械的に絞り込むところまでを担う。
// ルール2: 採用可能な部品が0件の場合は status='invalid' とし、確定成果物にしない。
import {
  extractDrawingPartsFromImage,
  AiClientError,
  DRAWING_PARTS_PROMPT_VERSION,
  type DrawingPartCandidate,
  type TokenUsage,
  type SupportedImageMimeType
} from './client';
import { getAnthropicModel } from '@/lib/env';

export interface ExtractedDrawingPart {
  partNo: string;
  description: string;
}

export type DrawingPartsExtractionStatus = 'succeeded' | 'invalid' | 'failed';

export interface DrawingPartsExtractionRun {
  status: DrawingPartsExtractionStatus;
  source: 'live' | 'mock' | null;
  model: string;
  promptVersion: string;
  params: Record<string, unknown>;
  inputHash: string | null;
  tokenUsage: TokenUsage | null;
  /** status==='succeeded' の場合のみ非空。0件なら 'invalid' になるため、
   *  ここが空配列の場合は drawing_parts への insert を行ってはならない。 */
  parts: ExtractedDrawingPart[];
  error: string | null;
}

/**
 * AI（またはモック）が返した部品候補から、partNo/description の両方が
 * 非空の候補のみを採用する。DBに依存しない純粋関数。
 * 採用可能な部品が1件も無い場合は status='invalid' とする（ADR-0006ルール2）。
 */
export function buildDrawingPartsFromCandidates(
  candidates: DrawingPartCandidate[]
): { status: 'succeeded' | 'invalid'; parts: ExtractedDrawingPart[] } {
  const parts: ExtractedDrawingPart[] = [];
  for (const candidate of candidates) {
    const partNo = candidate.partNo.trim();
    const description = candidate.description.trim();
    if (!partNo || !description) continue;
    parts.push({ partNo, description });
  }
  return { status: parts.length > 0 ? 'succeeded' : 'invalid', parts };
}

/**
 * 図面画像の部品認識のエンドツーエンド実行（AI/モック呼び出し + 機械的な絞り込み）。
 * DB書き込みは行わない（呼び出し元の Server Action がこの結果を元に
 * ai_runs / drawing_parts / ai_citations へ書き込む。quoted_text は図番・キャプション等の
 * 検証可能な情報を使うこと。AIの description をそのまま quoted_text にしないこと）。
 */
export async function runDrawingPartsExtraction(
  image: { data: Buffer; mimeType: SupportedImageMimeType },
  hint: { figureNo: string; caption?: string | null },
  opts: { model?: string } = {}
): Promise<DrawingPartsExtractionRun> {
  try {
    const raw = await extractDrawingPartsFromImage(image, hint, opts);
    const built = buildDrawingPartsFromCandidates(raw.parts);
    return {
      status: built.status,
      source: raw.source,
      model: raw.model,
      promptVersion: raw.promptVersion,
      params: raw.params,
      inputHash: raw.inputHash,
      tokenUsage: raw.tokenUsage,
      parts: built.parts,
      error: null
    };
  } catch (err) {
    const message = err instanceof AiClientError || err instanceof Error ? err.message : String(err);
    return {
      status: 'failed',
      source: null,
      model: opts.model ?? getAnthropicModel(),
      promptVersion: DRAWING_PARTS_PROMPT_VERSION,
      params: {},
      inputHash: null,
      tokenUsage: null,
      parts: [],
      error: message
    };
  }
}

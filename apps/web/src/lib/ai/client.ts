// Anthropic Claude API への薄いラッパー。
//
// 正とする文書: docs/20-architecture/adr/ADR-0006-provenance-first.md 実装上の必須ルール。
// 特に「引用文（quoted_text）はAIに生成させず、検索で取得した原文から機械的に切り出す」
// （ルール1）に従い、このモジュールは根拠となる原文の該当箇所を
// 「charStart/charEnd（文字オフセット）」としてのみ返す（quoted_text 相当の文字列を
// AIに生成させない）。実際の切り出しは呼び出し元（lib/ai/claim-decompose.ts）が行う。
//
// ANTHROPIC_API_KEY が未設定の場合は実APIを一切呼ばず、決定論的なモック応答へ
// フォールバックする（ユーザー決定事項：本番APIキー未発行の間はモックで動作継続）。
// 呼び出し元からは ClaimDecomposeResult.source（'live' | 'mock'）で判別できる以外は
// 透過的に扱える。
import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getAnthropicApiKey, getAnthropicModel } from '@/lib/env';

/** Claim分解プロンプトのバージョン（ai_runs.prompt_version に記録）。 */
export const CLAIM_DECOMPOSE_PROMPT_VERSION = 'claim-decompose-v1';

/**
 * AI（またはモック）が返す構成要件の「候補」。quoted_text 相当の文字列は含めない
 * （ADR-0006ルール1: 引用文はAIに生成させない）。charStart/charEnd は呼び出し元が
 * claimの原文から機械的に検証・切り出すための位置情報にすぎない。
 */
export const ClaimElementCandidateSchema = z.object({
  label: z.string().trim().min(1).max(60),
  charStart: z.number().int(),
  charEnd: z.number().int()
});
export type ClaimElementCandidate = z.infer<typeof ClaimElementCandidateSchema>;

export const ClaimDecompositionSchema = z.object({
  elements: z.array(ClaimElementCandidateSchema).min(1)
});

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ClaimDecomposeResult {
  /** 実APIを呼んだか、モックにフォールバックしたか。 */
  source: 'live' | 'mock';
  model: string;
  promptVersion: string;
  /** ai_runs.params に記録するリクエストパラメータ（再現性のため）。 */
  params: Record<string, unknown>;
  /** ai_runs.input_hash に記録する、プロンプト版・モデル・入力文からのハッシュ。 */
  inputHash: string;
  elements: ClaimElementCandidate[];
  tokenUsage: TokenUsage | null;
}

/** AI呼び出し・応答検証に失敗した場合に投げる。呼び出し元は ai_runs.status='failed' とする。 */
export class AiClientError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AiClientError';
  }
}

export function isAnthropicConfigured(): boolean {
  return !!getAnthropicApiKey();
}

function hashInput(promptVersion: string, model: string, input: string): string {
  return createHash('sha256').update(`${promptVersion}\n${model}\n${input}`).digest('hex');
}

const CLAIM_DECOMPOSE_TOOL_NAME = 'return_claim_elements';

const CLAIM_DECOMPOSE_SYSTEM_PROMPT =
  'あなたは特許請求項を構成要件に分解するアシスタントです。' +
  '与えられた請求項の原文をそのまま解析し、構成要件ごとに raw な文字オフセット' +
  '（0始まり、charStart は開始位置、charEnd は終了位置の直後、JavaScriptの' +
  'string.slice(charStart, charEnd) と同じ規則）を返してください。' +
  '該当箇所の文字列そのものを生成・要約・言い換えしてはいけません。' +
  'label には短い識別子（例: A, B, C、または構成要件の種別を表す短い語）のみを' +
  '入れてください。オフセットは必ず入力文の範囲内かつ charStart < charEnd としてください。';

function buildUserPrompt(claimText: string): string {
  return `次の請求項を構成要件に分解し、return_claim_elements ツールで返してください。\n\n請求項原文:\n${claimText}`;
}

/**
 * 決定論的なモック分解（APIキー未設定時のフォールバック）。
 * 既存シード（lib/db/seed.ts）と同じ方式：日本語の読点「、」（無ければ英語の
 * カンマ区切り）で機械的に分割し、A, B, C... のラベルを振る。AIを一切使わない
 * ため、常に claimText の範囲内に収まるオフセットを返す。
 */
export function mockDecomposeClaim(claimText: string): ClaimElementCandidate[] {
  const trimmed = claimText.trim();
  if (!trimmed) return [];
  const delimiter = trimmed.includes('、') ? '、' : (trimmed.includes(', ') ? ', ' : null);
  const segments = delimiter ? trimmed.split(delimiter) : [trimmed];

  const elements: ClaimElementCandidate[] = [];
  let cursor = 0;
  let seq = 0;
  for (const seg of segments) {
    if (!seg) continue;
    const start = claimText.indexOf(seg, cursor);
    if (start === -1) continue;
    const end = start + seg.length;
    cursor = end;
    elements.push({ label: String.fromCharCode(65 + seq), charStart: start, charEnd: end });
    seq += 1;
  }
  return elements;
}

/**
 * Claim（請求項）テキストをAI（またはモック）で構成要件に分解する。
 * 実APIを呼ぶ場合、レスポンスは Zod スキーマで検証し、不正な形式は AiClientError を
 * 投げる（呼び出し元で ai_runs.status='failed' として扱うこと）。
 */
export async function decomposeClaimText(
  claimText: string,
  opts: { model?: string } = {}
): Promise<ClaimDecomposeResult> {
  const model = opts.model ?? getAnthropicModel();
  const apiKey = getAnthropicApiKey();
  const params = { maxTokens: 1024, temperature: 0 };
  const inputHash = hashInput(CLAIM_DECOMPOSE_PROMPT_VERSION, model, claimText);

  if (!apiKey) {
    return {
      source: 'mock',
      model,
      promptVersion: CLAIM_DECOMPOSE_PROMPT_VERSION,
      params,
      inputHash,
      elements: mockDecomposeClaim(claimText),
      tokenUsage: null
    };
  }

  const client = new Anthropic({ apiKey });
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: CLAIM_DECOMPOSE_SYSTEM_PROMPT,
      tool_choice: { type: 'tool', name: CLAIM_DECOMPOSE_TOOL_NAME },
      tools: [
        {
          name: CLAIM_DECOMPOSE_TOOL_NAME,
          description: '請求項の構成要件（label と文字オフセット）を返す。',
          input_schema: {
            type: 'object',
            properties: {
              elements: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string' },
                    charStart: { type: 'integer' },
                    charEnd: { type: 'integer' }
                  },
                  required: ['label', 'charStart', 'charEnd']
                }
              }
            },
            required: ['elements']
          }
        }
      ],
      messages: [{ role: 'user', content: buildUserPrompt(claimText) }]
    });
  } catch (err) {
    throw new AiClientError(
      `Anthropic API 呼び出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) {
    throw new AiClientError('AI応答に tool_use ブロックが含まれていません（構成要件を取得できませんでした）');
  }

  const parsed = ClaimDecompositionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new AiClientError(`AI応答の形式が不正です: ${parsed.error.message}`);
  }

  const usage = response.usage;
  return {
    source: 'live',
    model,
    promptVersion: CLAIM_DECOMPOSE_PROMPT_VERSION,
    params,
    inputHash,
    elements: parsed.data.elements,
    tokenUsage: usage ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } : null
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FR-M06-005/006/007: Claim Chart / Claim Matrix（他社特許の構成要件 vs 自社技術説明文）
//
// ADR-0006ルール1と同様に、quoted_text 相当の文字列はAIに生成させない。
// このモジュールは自社技術の説明文（technologies.summary 等）中の該当箇所を
// 「charStart/charEnd」としてのみ返し、実際の切り出しは呼び出し元
// （lib/ai/claim-compare.ts）が行う。
// ─────────────────────────────────────────────────────────────────────────

/** Claim比較プロンプトのバージョン（ai_runs.prompt_version に記録）。 */
export const CLAIM_COMPARE_PROMPT_VERSION = 'claim-compare-v1';

/** 比較対象として渡す他社特許の構成要件（既にFR-M06-002で分解済みのもの）。 */
export interface ClaimElementInput {
  label: string;
  text: string;
}

export const ClaimCompareRowCandidateSchema = z.object({
  elementLabel: z.string().trim().min(1).max(60),
  kind: z.enum(['match', 'similar', 'differ']),
  rationale: z.string().trim().min(1).max(2000),
  charStart: z.number().int(),
  charEnd: z.number().int()
});
export type ClaimCompareRowCandidate = z.infer<typeof ClaimCompareRowCandidateSchema>;

export const ClaimComparisonSchema = z.object({
  rows: z.array(ClaimCompareRowCandidateSchema).min(1)
});

export interface ClaimCompareResult {
  source: 'live' | 'mock';
  model: string;
  promptVersion: string;
  params: Record<string, unknown>;
  inputHash: string;
  rows: ClaimCompareRowCandidate[];
  tokenUsage: TokenUsage | null;
}

const CLAIM_COMPARE_TOOL_NAME = 'return_claim_comparison';

const CLAIM_COMPARE_SYSTEM_PROMPT =
  'あなたは他社特許の構成要件と自社技術の説明文を比較する専門家アシスタントです。' +
  '与えられた構成要件（elementLabelごと）ごとに、自社技術の説明文の中から最も関連する' +
  '箇所を raw な文字オフセット（0始まり、charStart は開始位置、charEnd は終了位置の直後、' +
  'JavaScriptの string.slice(charStart, charEnd) と同じ規則）で示し、一致(match)/' +
  '類似(similar)/相違(differ)のいずれかを判定してください。該当箇所の文字列そのものを' +
  '生成・要約・言い換えしてはいけません（charStart/charEndのみを返してください）。' +
  '完全に対応する記載が無い場合でも、自社技術の説明文の中で最も関連性が高い箇所を' +
  '指し示し、kind=differ としてください（説明文全体に一切関連箇所が無い場合を除き、' +
  'charStart/charEnd を必ず有効な範囲で返してください）。elementLabel には入力で' +
  '与えた構成要件のラベルをそのまま使ってください。rationale には判定理由を' +
  '日本語で簡潔に記述してください（この文字列は根拠原文として保存されないため、' +
  '要約や説明として自由に記述してよい）。オフセットは必ず入力した説明文の範囲内かつ' +
  'charStart < charEnd としてください。';

function buildComparisonUserPrompt(elements: ClaimElementInput[], technologyText: string): string {
  const elementsText = elements.map(e => `- ${e.label}: ${e.text}`).join('\n');
  return `他社特許の構成要件一覧:\n${elementsText}\n\n` +
    `自社技術の説明文（この文字列中の位置をcharStart/charEndで示すこと）:\n${technologyText}\n\n` +
    `各構成要件について return_claim_comparison ツールで比較結果を返してください。`;
}

/** 文字集合の重なり具合（Jaccard近似）を [0, 1] で返す。モックの判定に使う簡易指標。 */
function charOverlapRatio(a: string, b: string): number {
  const setA = new Set(Array.from(a));
  const setB = new Set(Array.from(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let common = 0;
  for (const ch of setA) if (setB.has(ch)) common++;
  return common / Math.max(setA.size, setB.size);
}

/**
 * 決定論的なモック比較（APIキー未設定時のフォールバック）。
 * mockDecomposeClaim と同じ方式：technologyText を句読点で機械的に分割し、
 * 構成要件へ順番に（cyclicに）割り当てる。文字集合の重なり率で
 * match/similar/differ を決める。AIを一切使わないため、常に technologyText の
 * 範囲内に収まるオフセットを返す（該当箇所が全く見つからない要素はスキップする）。
 */
export function mockCompareClaimElements(
  elements: ClaimElementInput[],
  technologyText: string
): ClaimCompareRowCandidate[] {
  const trimmed = technologyText.trim();
  if (!trimmed || elements.length === 0) return [];
  const delimiter = trimmed.includes('。')
    ? '。'
    : (trimmed.includes('、') ? '、' : (trimmed.includes(', ') ? ', ' : null));
  const segments = delimiter ? trimmed.split(delimiter) : [trimmed];

  const rows: ClaimCompareRowCandidate[] = [];
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]!;
    const seg = segments[i % segments.length];
    if (!seg) continue;
    const segTrimmed = seg.trim();
    if (!segTrimmed) continue;
    const start = technologyText.indexOf(segTrimmed);
    if (start === -1) continue;
    const end = start + segTrimmed.length;
    const overlap = charOverlapRatio(el.text, segTrimmed);
    const kind: 'match' | 'similar' | 'differ' = overlap >= 0.6 ? 'match' : (overlap >= 0.3 ? 'similar' : 'differ');
    rows.push({
      elementLabel: el.label,
      kind,
      rationale:
        `構成要件「${el.label}」と自社技術説明文の該当箇所を機械的に比較しました` +
        `（モック生成、文字重複率 ${Math.round(overlap * 100)}%）。`,
      charStart: start,
      charEnd: end
    });
  }
  return rows;
}

/**
 * 他社特許の構成要件（elements）と自社技術の説明文（technologyText）をAI（または
 * モック）で比較する。実APIを呼ぶ場合、レスポンスは Zod スキーマで検証し、
 * 不正な形式は AiClientError を投げる（呼び出し元で ai_runs.status='failed' として
 * 扱うこと）。
 */
export async function compareClaimElements(
  elements: ClaimElementInput[],
  technologyText: string,
  opts: { model?: string } = {}
): Promise<ClaimCompareResult> {
  const model = opts.model ?? getAnthropicModel();
  const apiKey = getAnthropicApiKey();
  const params = { maxTokens: 2048, temperature: 0 };
  const inputHash = hashInput(
    CLAIM_COMPARE_PROMPT_VERSION,
    model,
    JSON.stringify({ elements, technologyText })
  );

  if (!apiKey) {
    return {
      source: 'mock',
      model,
      promptVersion: CLAIM_COMPARE_PROMPT_VERSION,
      params,
      inputHash,
      rows: mockCompareClaimElements(elements, technologyText),
      tokenUsage: null
    };
  }

  const client = new Anthropic({ apiKey });
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: CLAIM_COMPARE_SYSTEM_PROMPT,
      tool_choice: { type: 'tool', name: CLAIM_COMPARE_TOOL_NAME },
      tools: [
        {
          name: CLAIM_COMPARE_TOOL_NAME,
          description: '各構成要件についての比較結果（一致/類似/相違・根拠・自社説明文中の文字オフセット）を返す。',
          input_schema: {
            type: 'object',
            properties: {
              rows: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  properties: {
                    elementLabel: { type: 'string' },
                    kind: { type: 'string', enum: ['match', 'similar', 'differ'] },
                    rationale: { type: 'string' },
                    charStart: { type: 'integer' },
                    charEnd: { type: 'integer' }
                  },
                  required: ['elementLabel', 'kind', 'rationale', 'charStart', 'charEnd']
                }
              }
            },
            required: ['rows']
          }
        }
      ],
      messages: [{ role: 'user', content: buildComparisonUserPrompt(elements, technologyText) }]
    });
  } catch (err) {
    throw new AiClientError(
      `Anthropic API 呼び出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) {
    throw new AiClientError('AI応答に tool_use ブロックが含まれていません（比較結果を取得できませんでした）');
  }

  const parsed = ClaimComparisonSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new AiClientError(`AI応答の形式が不正です: ${parsed.error.message}`);
  }

  const usage = response.usage;
  return {
    source: 'live',
    model,
    promptVersion: CLAIM_COMPARE_PROMPT_VERSION,
    params,
    inputHash,
    rows: parsed.data.rows,
    tokenUsage: usage ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } : null
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Vision AI基盤（M47 Patent Drawing / M48 Engineering Document 共通）
//
// 画像（PNG/JPEG/WebP）・PDF文書を入力として渡し、構造化された抽出結果を
// Zodスキーマで検証して返す（Anthropic Messages APIのvision入力: content配列に
// {type:'image', source:{type:'base64', media_type, data}} または PDFの場合
// {type:'document', source:{type:'base64', media_type:'application/pdf', data}}
// を含める）。ANTHROPIC_API_KEY 未設定時は、他のAI機能と同様に決定論的な
// モック応答（画像・PDFの中身は実際には見ずに、呼び出し元が渡したメタデータ
// [図番・キャプション・文書タイトル等]から機械的に生成するダミー結果）へ
// フォールバックする。
//
// ADR-0006 provenance-first 実装上の注意（画像/PDF固有）:
// テキスト解析（decomposeClaimText 等）と異なり、画像・PDFからは「原文の該当箇所」を
// charStart/charEnd のような形で機械的に切り出すことができない。そのため
// 呼び出し元（lib/ai/drawing-parts.ts, lib/ai/tech-elements.ts）は、
// ai_citations.quoted_text にAIが生成した説明文をそのまま使わず、解析対象そのものを
// 特定できる検証可能な情報（図番・キャプション・文書タイトル等、実際にDBに存在し
// 閲覧可能な値）を用いる。この設計判断はPR本文にも明記する。
// ─────────────────────────────────────────────────────────────────────────

/** Anthropic Messages APIのvision入力でサポートする画像MIMEタイプ。 */
export type SupportedImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

/** 画像/PDFなどバイナリ入力用の input_hash 計算（テキストと違いバイト列を直接ハッシュに含める）。 */
function hashBinaryInput(promptVersion: string, model: string, data: Buffer, extra: string): string {
  return createHash('sha256')
    .update(promptVersion).update('\n')
    .update(model).update('\n')
    .update(extra).update('\n')
    .update(data)
    .digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────
// M47: 特許図面の部品（符号）自動認識
// ─────────────────────────────────────────────────────────────────────────

/** 図面部品認識プロンプトのバージョン（ai_runs.prompt_version に記録）。 */
export const DRAWING_PARTS_PROMPT_VERSION = 'drawing-parts-extract-v1';

export const DrawingPartCandidateSchema = z.object({
  partNo: z.string().trim().min(1).max(20),
  description: z.string().trim().min(1).max(300)
});
export type DrawingPartCandidate = z.infer<typeof DrawingPartCandidateSchema>;

export const DrawingPartsExtractionSchema = z.object({
  parts: z.array(DrawingPartCandidateSchema)
});

export interface DrawingPartsExtractResult {
  source: 'live' | 'mock';
  model: string;
  promptVersion: string;
  params: Record<string, unknown>;
  inputHash: string;
  parts: DrawingPartCandidate[];
  tokenUsage: TokenUsage | null;
}

const DRAWING_PARTS_TOOL_NAME = 'return_drawing_parts';

const DRAWING_PARTS_SYSTEM_PROMPT =
  'あなたは特許図面を解析し、図面中に記載されている部品の符号を認識するアシスタントです。' +
  '与えられた図面画像を見て、図中に実際に記載されている符号（数字・アルファベット等）と、' +
  'その符号が指す部品についての短い説明を列挙してください。画像から読み取れない・' +
  '推測が必要な部品は含めないでください。partNo には図中の符号をそのまま、' +
  'description には日本語で簡潔な説明を入れてください。1件も符号を認識できない場合は' +
  '空配列を返してください。';

/**
 * 決定論的なモック部品認識（APIキー未設定時のフォールバック）。
 * 画像を実際には見ず、呼び出し元が渡した図番・キャプションのメタデータのみから
 * 機械的にダミー部品を生成する。
 */
export function mockExtractDrawingParts(hint: { figureNo: string; caption?: string | null }): DrawingPartCandidate[] {
  const base = hint.caption?.trim() || hint.figureNo;
  return [
    { partNo: '1', description: `${base}に示される主要部材（モック生成・対象図番: ${hint.figureNo}）` },
    { partNo: '2', description: `${base}に示される付随部材（モック生成・対象図番: ${hint.figureNo}）` }
  ];
}

/**
 * 特許図面の画像をAI（またはモック）で解析し、部品（符号・説明）候補を取得する。
 * 実APIを呼ぶ場合、レスポンスは Zod スキーマで検証し、不正な形式は AiClientError を
 * 投げる（呼び出し元で ai_runs.status='failed' として扱うこと）。
 */
export async function extractDrawingPartsFromImage(
  image: { data: Buffer; mimeType: SupportedImageMimeType },
  hint: { figureNo: string; caption?: string | null },
  opts: { model?: string } = {}
): Promise<DrawingPartsExtractResult> {
  const model = opts.model ?? getAnthropicModel();
  const apiKey = getAnthropicApiKey();
  const params = { maxTokens: 1024, temperature: 0 };
  const inputHash = hashBinaryInput(DRAWING_PARTS_PROMPT_VERSION, model, image.data, `${hint.figureNo}\n${hint.caption ?? ''}`);

  if (!apiKey) {
    return {
      source: 'mock',
      model,
      promptVersion: DRAWING_PARTS_PROMPT_VERSION,
      params,
      inputHash,
      parts: mockExtractDrawingParts(hint),
      tokenUsage: null
    };
  }

  const client = new Anthropic({ apiKey });
  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
      system: DRAWING_PARTS_SYSTEM_PROMPT,
      tool_choice: { type: 'tool', name: DRAWING_PARTS_TOOL_NAME },
      tools: [
        {
          name: DRAWING_PARTS_TOOL_NAME,
          description: '図面から認識した部品（符号・説明）の一覧を返す。',
          input_schema: {
            type: 'object',
            properties: {
              parts: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    partNo: { type: 'string' },
                    description: { type: 'string' }
                  },
                  required: ['partNo', 'description']
                }
              }
            },
            required: ['parts']
          }
        }
      ],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.data.toString('base64') } },
            {
              type: 'text',
              text: `この特許図面（${hint.figureNo}${hint.caption ? ` / ${hint.caption}` : ''}）に記載されている` +
                '部品符号と説明を return_drawing_parts ツールで返してください。'
            }
          ]
        }
      ]
    });
  } catch (err) {
    throw new AiClientError(
      `Anthropic API 呼び出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err }
    );
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
  );
  if (!toolUse) {
    throw new AiClientError('AI応答に tool_use ブロックが含まれていません（部品を取得できませんでした）');
  }

  const parsed = DrawingPartsExtractionSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    throw new AiClientError(`AI応答の形式が不正です: ${parsed.error.message}`);
  }

  const usage = response.usage;
  return {
    source: 'live',
    model,
    promptVersion: DRAWING_PARTS_PROMPT_VERSION,
    params,
    inputHash,
    parts: parsed.data.parts,
    tokenUsage: usage ? { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens } : null
  };
}

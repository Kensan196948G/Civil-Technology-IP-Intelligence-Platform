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

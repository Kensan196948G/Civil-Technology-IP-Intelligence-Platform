// Voyage AI Embeddings API への薄いラッパー（Next.js実行時向け）。
//
// 正とする文書: docs/30-design/06-search-and-rag-design.md（ADR-0003）§4.3「意味検索（pgvector）」。
// 埋め込みモデルベンダーとして Voyage AI を採用（ユーザー決定事項）。ただし本番APIキー
// （VOYAGE_API_KEY）は今はまだ発行されない前提のため、lib/ai/client.ts（Anthropic連携）と
// 同じ設計思想を踏襲する: キー未設定時は実APIを一切呼ばず、常に undefined を返す
// （例外は投げない）。呼び出し元（api/search/route.ts 等）はこれをnullチェックして
// 意味検索をスキップできる。
//
// 実際のAPI呼び出しロジックは ./embeddings-core.ts に切り出している。db:seed
// （`tsx src/lib/db/seed.ts` でNext.js/webpackを経由せず直接実行するスクリプト）から
// 埋め込みを使う場合は、本ファイル（`@/lib/env` に依存）ではなく embeddings-core.ts を
// 直接importすること。lib/env.ts は `@cloudflare/next-on-pages`（package.jsonにexports
// フィールドが無い）に依存しており、webpackを経由しない実行（tsx等）ではモジュール解決に
// 失敗する（apps/web/src/lib/ai/client.test.ts のコメント参照。同種の制約）。
import { getVoyageApiKey, getVoyageModel } from '@/lib/env';
import {
  embedTextsWithCredentials,
  toPgVectorLiteral,
  VOYAGE_EMBEDDING_DIMENSIONS,
  type EmbedOptions,
  type VoyageInputType
} from './embeddings-core';

export { toPgVectorLiteral, VOYAGE_EMBEDDING_DIMENSIONS };
export type { EmbedOptions, VoyageInputType };

/** VOYAGE_API_KEY が設定されているか（意味検索レイヤーを有効化してよいか）を返す。 */
export function isVoyageConfigured(): boolean {
  return !!getVoyageApiKey();
}

/**
 * 複数テキストの埋め込みベクトルをまとめて取得する。
 *
 * - VOYAGE_API_KEY 未設定の場合: 実APIを一切呼ばず、全要素 undefined の配列を返す。
 * - API呼び出しに失敗した場合（ネットワークエラー・非2xxレスポンス等）: 例外を投げず、
 *   該当チャンクの要素を undefined のままにして処理を継続する（呼び出し元の他の処理を止めない）。
 *
 * 戻り値の配列は `texts` と同じ長さ・同じ順序。各要素は埋め込みベクトル、または
 * 取得できなかったことを示す undefined。
 */
export async function embedTexts(
  texts: readonly string[],
  options: EmbedOptions = {}
): Promise<Array<number[] | undefined>> {
  return embedTextsWithCredentials(texts, getVoyageApiKey(), getVoyageModel(), options);
}

/**
 * 単一テキストの埋め込みベクトルを取得する（主に意味検索のクエリ側で使用）。
 * VOYAGE_API_KEY未設定・API呼び出し失敗のいずれの場合も undefined を返す（例外は投げない）。
 */
export async function embedText(text: string, options: EmbedOptions = {}): Promise<number[] | undefined> {
  const [result] = await embedTexts([text], options);
  return result;
}

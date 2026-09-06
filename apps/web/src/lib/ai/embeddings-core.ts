// Voyage AI Embeddings API 呼び出しのコア実装。
//
// 正とする文書: docs/30-design/06-search-and-rag-design.md（ADR-0003）§4.3「意味検索（pgvector）」。
//
// ⚠️ 重要: このモジュールは意図的に `@/lib/env`（`@cloudflare/next-on-pages` に依存）を
// import しない。db:seed（`tsx src/lib/db/seed.ts` で実行するスクリプト）はNext.jsの
// ビルドパイプライン（webpack）を経由せずに直接実行されるため、`@cloudflare/next-on-pages`
// の package.json（exportsフィールド未定義）をNode/tsxのモジュール解決が失敗させる
// （apps/web/src/lib/ai/client.test.ts のコメント参照。同種の制約）。
// APIキー・モデル名を呼び出し元から明示的に受け取る形にすることで、Next.js実行時向け
// ラッパー（./embeddings.ts。api/search/route.ts から使用）と db:seed（seed.ts。
// process.env を直接参照）の両方から安全に共有できるようにしている。
//
// npm の公式SDK（`voyageai`）は存在するが、依存追加によるsupply chainリスク・pnpm audit対象の
// 増加を避け、シンプルなREST呼び出し（fetch）で直接実装する（エンドポイント・リクエスト/
// レスポンス形式は Voyage AI 公式ドキュメントで確認済み: POST https://api.voyageai.com/v1/embeddings）。

/** 次元数。VOYAGE_MODEL既定値（voyage-4-lite）の既定次元数(1024)に合わせる。DB側 `vector(1024)` と一致させること。 */
export const VOYAGE_EMBEDDING_DIMENSIONS = 1024;

const VOYAGE_EMBEDDINGS_URL = 'https://api.voyageai.com/v1/embeddings';

// Voyage AI は1リクエストで複数テキストをまとめて埋め込み可能（input は配列を受け付ける）。
// 大量件数（seed投入時）でAPI呼び出し回数を抑えるため、一定件数ごとにバッチ処理する。
const MAX_BATCH_SIZE = 128;

export type VoyageInputType = 'query' | 'document';

export interface EmbedOptions {
  /** Voyage AI の input_type。クエリ埋め込みは 'query'、保存対象（DB側）は 'document' を指定する。 */
  inputType?: VoyageInputType;
}

interface VoyageEmbeddingsResponseItem {
  embedding: number[];
  index: number;
}

interface VoyageEmbeddingsResponse {
  data: VoyageEmbeddingsResponseItem[];
}

/**
 * 複数テキストの埋め込みベクトルをまとめて取得する（APIキー・モデル名は呼び出し元が渡す）。
 *
 * - apiKey が未設定（undefined・空文字）の場合: 実APIを一切呼ばず、全要素 undefined の配列を返す。
 * - API呼び出しに失敗した場合（ネットワークエラー・非2xxレスポンス等）: 例外を投げず、
 *   該当チャンクの要素を undefined のままにして処理を継続する（呼び出し元の他の処理を止めない）。
 *
 * 戻り値の配列は `texts` と同じ長さ・同じ順序。各要素は埋め込みベクトル、または
 * 取得できなかったことを示す undefined。
 */
export async function embedTextsWithCredentials(
  texts: readonly string[],
  apiKey: string | undefined,
  model: string,
  options: EmbedOptions = {}
): Promise<Array<number[] | undefined>> {
  if (texts.length === 0) return [];
  if (!apiKey) return texts.map(() => undefined);

  const results: Array<number[] | undefined> = new Array(texts.length).fill(undefined);

  for (let offset = 0; offset < texts.length; offset += MAX_BATCH_SIZE) {
    const chunk = texts.slice(offset, offset + MAX_BATCH_SIZE);
    try {
      const res = await fetch(VOYAGE_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          input: chunk,
          model,
          input_type: options.inputType ?? null,
          output_dimension: VOYAGE_EMBEDDING_DIMENSIONS
        })
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        console.error(`[voyage] embeddings API が ${res.status} を返しました: ${bodyText.slice(0, 500)}`);
        continue; // このチャンクは undefined のまま（呼び出し元でスキップ）
      }

      const json = (await res.json()) as VoyageEmbeddingsResponse;
      for (const item of json.data ?? []) {
        results[offset + item.index] = item.embedding;
      }
    } catch (err) {
      console.error('[voyage] embeddings API の呼び出しに失敗しました', err);
      // このチャンクは undefined のまま（呼び出し元でスキップ）
    }
  }

  return results;
}

/**
 * 埋め込みベクトルを Postgres (pgvector) の入力リテラル文字列（例: "[0.1,0.2,...]"）へ変換する。
 * postgres.js 経由でパラメータ化クエリに `${literal}::vector` として渡すために使う。
 */
export function toPgVectorLiteral(embedding: readonly number[]): string {
  return `[${embedding.join(',')}]`;
}

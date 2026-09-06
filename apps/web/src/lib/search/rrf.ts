// ADR-0003 / docs/30-design/06-search-and-rag-design.md §4.4 の RRF（Reciprocal Rank Fusion）実装。
//
// 今回のスコープは①構造検索＋②字句検索（pg_trgm）のみで、③意味検索（pgvector）は
// 埋め込みモデル・次元数が未確定（docs/40-infrastructure/02-neon-setup.md）のため見送っている。
// そのため現時点で融合するリストは「構造検索」「字句検索（テーブルごと）」のみだが、
// 将来 pgvector を導入した際に意味検索のリストを1つ追加するだけで済むよう、
// 「複数の順位付きリストを重み付きで融合する」汎用ロジックとして切り出す。
//
// DBアクセスを含まない純粋関数にすることで、SQL/実DB無しで vitest によるユニットテストが書ける
// ようにしている（route.ts 側は SQL 結果から RankedList を組み立てて渡すだけにする）。

/** RRF の減衰定数 k。設計書§4.4で k=60 を初期値とする、と定義されている。 */
export const RRF_K_DEFAULT = 60;

/**
 * 検索レイヤーごとの重み（w_lex 等）。設定値として外出しし、将来
 * 意味検索（w_sem）等を実測に基づいて追加・調整できるようにする。
 * ⚠️ 初期値は仮置き。設計書§8のPhase 1評価（Recall@20等の実測）で調整する。
 */
export const SEARCH_WEIGHTS = {
  /** ①構造検索（特許番号・NETIS番号の完全一致/前方一致）。ほぼ確実に意図した1件のため高めに設定 */
  structured: 2.0,
  /** ②字句検索（pg_trgm類似度） */
  lexical: 1.0
  // semantic（③意味検索・pgvector）は embedding モデル未確定のため未導入。
  // 導入時はここに `semantic: <weight>` を追加し、fuseRrf へ渡すリストを1つ増やすだけでよい。
} as const;

export interface RankedList<K extends string = string> {
  /** リスト名（例: "lexical:patents"）。ログ・デバッグ用途で融合結果には影響しない */
  name: string;
  /** このリストの重み（w_lex 等） */
  weight: number;
  /** 順位順（1位が先頭）に並んだID一覧。同じIDの重複は先頭の順位のみが使われる */
  ids: readonly K[];
}

export interface RrfScore<K extends string = string> {
  id: K;
  /** RRF融合スコア（降順ソート用）。生の類似度とスケールが異なる点に注意 */
  score: number;
}

/**
 * 複数の順位付きリストを RRF で融合する。
 *
 *   RRF(d) = Σ_over_lists  weight_i * 1 / (k + rank_i(d))
 *
 * @param lists 順位付きリストの配列（リストごとに重みを持つ）
 * @param k 減衰定数（既定 60）
 * @returns スコア降順にソートされた {id, score} の配列
 */
export function fuseRrf<K extends string = string>(
  lists: readonly RankedList<K>[],
  k: number = RRF_K_DEFAULT
): RrfScore<K>[] {
  const scores = new Map<K, number>();

  for (const list of lists) {
    const seen = new Set<K>();
    list.ids.forEach((id, index) => {
      // 同一リスト内に同じIDが複数回現れても、最初（最も高い順位）だけを採用する。
      if (seen.has(id)) return;
      seen.add(id);
      const rank = index + 1; // 1-based
      const contribution = list.weight * (1 / (k + rank));
      scores.set(id, (scores.get(id) ?? 0) + contribution);
    });
  }

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * テキスト正規化（設計書§3の一部）。
 *
 * DB側（ddl.sql の `ctiip_text_norm()`）は Postgres 標準関数のみで実装しているため
 * 全角→半角・大文字小文字統一・空白圧縮のみを行うが、TypeScript側では
 * `String.prototype.normalize('NFKC')` が使えるため、より広いNFKC正規化を適用したうえで
 * 同様に小文字化・空白圧縮を行う。
 *
 * 用途: ①構造検索（特許番号・NETIS番号）の入力側トリム・空白圧縮、および
 * クエリ文字列の前処理全般。DB側の生成列（title_norm/name_norm）と完全に同一の規則ではない点に
 * 注意（表示には使わず、検索の前処理にのみ使う）。
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

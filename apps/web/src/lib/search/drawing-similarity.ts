// M47 Patent Drawing / Image Intelligence — 類似図面検索（drawing_similarities）。
//
// 背景: 画像ペアごとにVision AIで直接比較すると呼び出し回数が組合せ爆発する
// （N枚の図面で N^2 回のAI呼び出しが必要）ため、既にVision AIで抽出済みの
// drawing_parts（符号・部品説明文）とcaptionを対象にしたテキスト類似度で代替する。
// 新規のAI画像解析呼び出しを増やさない設計。
//
// VOYAGE_API_KEY設定時は意味検索と同じVoyage AI埋め込み（コサイン類似度）を使う。
// 未設定時は、依存なしで常に動く字句類似度（正規化した単語集合のJaccard係数）へ
// フォールバックする。呼び出し元（drawings/actions.ts）がどちらの経路かを選ぶ。

/** 図面の比較対象テキスト（part_no・description・caption）を1つの文字列にまとめる。 */
export function buildDrawingCompareText(caption: string | null, parts: readonly { partNo: string; description: string }[]): string {
  const partsText = parts.map(p => `${p.partNo}:${p.description}`).join(' / ');
  return [caption ?? '', partsText].filter(Boolean).join(' — ');
}

/** NFKC正規化・小文字化・空白圧縮した単語（1文字以上の連続する非空白）の集合を返す。 */
function tokenize(text: string): Set<string> {
  const normalized = text.normalize('NFKC').toLowerCase().trim();
  const tokens = normalized.split(/[\s、。・,.\-—/:]+/).filter(t => t.length > 0);
  return new Set(tokens);
}

/** 単語集合のJaccard係数（0-1）。埋め込みが使えない場合のフォールバック類似度。 */
export function jaccardSimilarity(textA: string, textB: string): number {
  const a = tokenize(textA);
  const b = tokenize(textB);
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** コサイン類似度（-1〜1）。次元数が一致しない場合は0を返す。 */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    normA += ai * ai;
    normB += bi * bi;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 0-1の類似度スコアを drawing_similarities.similarity_score（0-100, 小数第2位）用に変換する。 */
export function toSimilarityScore(ratio: number): number {
  const clamped = Math.max(0, Math.min(1, ratio));
  return Math.round(clamped * 10000) / 100;
}

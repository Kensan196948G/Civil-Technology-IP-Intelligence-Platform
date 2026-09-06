// ADR-0006「実装上の必須ルール1」の共通実装。
//
// 正とする文書: docs/20-architecture/adr/ADR-0006-provenance-first.md。
// 「引用文（quoted_text）はAIに生成させず、検索・DB取得で得た原文から機械的に
// 切り出す」ルールを、claim-decompose（特許請求項の原文）と claim-compare
// （自社技術の説明文）の両方から共通利用できる形に切り出したもの。
/**
 * sourceText の charStart/charEnd の範囲が有効な場合のみ、機械的に該当文字列を
 * 切り出して返す。範囲外・不整合（charStart>=charEnd、負数、非整数、sourceText
 * の長さを超える等）の場合は null を返す。
 */
export function extractSubstring(sourceText: string, charStart: number, charEnd: number): string | null {
  if (!Number.isInteger(charStart) || !Number.isInteger(charEnd)) return null;
  if (charStart < 0 || charEnd <= charStart || charEnd > sourceText.length) return null;
  const slice = sourceText.slice(charStart, charEnd);
  return slice.length > 0 ? slice : null;
}

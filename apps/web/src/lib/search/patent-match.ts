// M48 Engineering Document Intelligence — 抽出技術要素と特許のマッチング。
// FR仕様上の設計判断: AIに直接特許検索させるのではなく、抽出済みの element_label を
// 用いて既存のハイブリッド検索基盤（app/api/search/route.ts）と同じ字句検索技術
// （pg_trgm類似度 + ILIKE、ADR-0003）で関連特許候補を検索する。新たな高コストAI呼び出しを
// 追加しない設計とする（理由はPR本文に明記）。
import { sql } from 'drizzle-orm';
import type { getDb } from '@/lib/db/client';

export interface PatentMatchCandidate {
  id: string;
  title: string;
  /** 0-100スケール。pg_trgm類似度が取れた場合は similarity*100、ILIKEのみ一致の場合は
   *  固定値（DEFAULT_ILIKE_ONLY_SCORE）とする。 */
  score: number;
}

const MATCH_LIMIT = 5;
/** pg_trgm類似度が算出できない（ILIKEのみ一致）候補に付与する固定スコア。 */
const DEFAULT_ILIKE_ONLY_SCORE = 40;

/**
 * 抽出された技術要素ラベルから関連特許候補を検索する（字句検索のみ。意味検索は
 * app/api/search/route.ts と同様に埋め込みモデル未確定のためスコープ外）。
 */
export async function findPatentCandidatesForLabel(
  db: ReturnType<typeof getDb>,
  label: string
): Promise<PatentMatchCandidate[]> {
  const trimmed = label.trim();
  if (!trimmed) return [];
  const like = `%${trimmed}%`;

  const result = await db.execute(sql`
    select id, title, similarity(title_norm, ctiip_text_norm(${trimmed})) as sim
    from patents
    where title_norm % ctiip_text_norm(${trimmed}) or title ilike ${like} or abstract ilike ${like}
    order by sim desc nulls last, title asc
    limit ${MATCH_LIMIT}
  `);

  const rows = result.rows as Array<{ id: string; title: string; sim: number | string | null }>;
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    score: r.sim != null ? Math.round(Number(r.sim) * 10000) / 100 : DEFAULT_ILIKE_ONLY_SCORE
  }));
}

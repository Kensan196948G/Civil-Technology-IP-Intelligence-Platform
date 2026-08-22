// 08. 土木技術・現場適用 / 工種区分（civil-category）ページ共通クエリ。
// このファイルは page.tsx ではないため Next.js のルートにはならない（内部ヘルパー）。
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';

export type CivilCategoryRow = {
  id: string;
  kind: 'patent' | 'technology' | 'netis';
  title: string;
  sub: string;
  href: string;
  isSample: boolean;
};

export const KIND_LABEL: Record<CivilCategoryRow['kind'], string> = {
  patent: '他社特許', technology: '自社技術', netis: 'NETIS登録技術'
};

// work_types 配列に指定コードのいずれかを含むか（技術・特許の分類タグ）を判定する
// SQL断片を毎回新規生成する。同一クエリ内で複数回埋め込んでも安全にするため。
function workTypeMatch(codes: string[]) {
  const conditions = codes.map(code => sql`work_types @> ARRAY[${code}]::text[]`);
  return sql.join(conditions, sql` OR `);
}

// 工種区分（港湾・海洋、河川、道路…）に該当する他社特許・自社技術・NETIS登録技術を横断取得する。
// patents / technologies は work_types 配列でのタグ一致、NETIS は category（自由記述）の部分一致で判定する。
export async function loadCivilCategoryRows(workTypeCodes: string[], netisKeyword: string): Promise<CivilCategoryRow[]> {
  const db = getDb(getDatabaseUrl());
  const netisLike = `%${netisKeyword}%`;

  const result = await db.execute(sql`
    select 'patent' as kind, id, title, applicant_name as sub, is_sample
    from patents
    where ${workTypeMatch(workTypeCodes)}
    union all
    select 'technology' as kind, id, name as title, kind as sub, is_sample
    from technologies
    where ${workTypeMatch(workTypeCodes)}
    union all
    select 'netis' as kind, id, name as title, category as sub, is_sample
    from netis_technologies
    where category ilike ${netisLike}
    order by title
  `);

  return (result.rows as Array<{ kind: string; id: string; title: string; sub: string | null; is_sample: boolean }>).map(row => {
    const kind = row.kind as CivilCategoryRow['kind'];
    return {
      id: `${kind}:${row.id}`,
      kind,
      title: row.title,
      sub: row.sub ?? '—',
      href: kind === 'patent' ? `/patents/${row.id}` : kind === 'netis' ? `/netis/${row.id}` : '',
      isSample: !!row.is_sample
    };
  });
}

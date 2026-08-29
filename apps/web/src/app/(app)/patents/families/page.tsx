import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


// CodeRabbit指摘: titleでのgroup byは、無関係な特許を誤って同一ファミリーに
// 統合したり（表記揺れ）、真に同一発明でも表記差異で別集計になったりする
// （書誌データ由来のファミリーID・優先権関係がMVPスキーマに無いため）。
// 正式な「特許ファミリー」を名乗らず、実際の集計方法をそのまま画面名にする。
type FamilyRow = {
  id: string;
  title: string;
  n: number;
  countries: string[];
  applicants: string[];
  ids: string[];
};

export default async function PatentFamiliesPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      title,
      count(*)::int as n,
      array_agg(distinct country order by country) as countries,
      array_agg(distinct applicant_name order by applicant_name) as applicants,
      array_agg(id::text) as ids
    from patents
    group by title
    order by n desc, title asc
  `);
  const rows: FamilyRow[] = (result.rows as any[]).map(r => ({
    id: r.title,
    title: r.title,
    n: Number(r.n),
    countries: r.countries as string[],
    applicants: r.applicants as string[],
    ids: r.ids as string[]
  }));

  return (
    <ListView
      title="同一タイトル集計（特許ファミリー簡易表示）"
      moduleCode="S-03 / TITLE-BASED GROUPING"
      description="タイトル文字列が完全一致する特許をまとめた簡易集計です。書誌データ上の正式なファミリーID・優先権関係には基づいていないため、表記違いの同一発明は別集計に、無関係な同名特許は同一集計になる場合があります。1件のみの集計は詳細ページへ遷移できます。"
      badge="簡易集計"
      rows={rows}
      emptyMessage="特許データがまだありません。"
      rowHref={row => row.ids.length === 1 ? `/patents/${row.ids[0]}` : ''}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'countries', mono: true, render: row => row.countries.join(' / ') },
        { key: 'applicants', render: row => row.applicants.join('、') },
        { key: 'n', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.n}件</span> }
      ]}
    />
  );
}

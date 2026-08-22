import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

// 特許ファミリー = 同一発明について国・地域をまたいで出願された特許群。
// MVPでは明示的なファミリーIDを保持しないため、同一タイトルで出願された
// 特許をまとめてファミリーとして扱う（現状のサンプルデータでは1件=1ファミリー
// になるが、同一発明が複数国に出願されるとそのままファミリーとして集約される）。
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
      title="特許ファミリー"
      moduleCode="S-03 / PATENT FAMILIES"
      description="同一タイトル（同一発明）で複数国・地域に出願された特許をファミリー単位でまとめた一覧です。1件のみのファミリーは詳細ページへ遷移できます。"
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

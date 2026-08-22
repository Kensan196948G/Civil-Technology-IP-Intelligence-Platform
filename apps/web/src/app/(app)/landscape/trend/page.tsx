import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = { application: '出願', publication: '公開' };

type Row = { id: string; kind: string; year: number; n: number };
type RawRow = { kind: string; year: number; n: number };

export default async function LandscapeTrendPage() {
  const db = getDb(getDatabaseUrl());
  const res = await db.execute(sql`
    select 'application' as kind, extract(year from application_date)::int as year, count(*)::int as n
    from patents where application_date is not null group by year
    union all
    select 'publication' as kind, extract(year from publication_date)::int as year, count(*)::int as n
    from patents where publication_date is not null group by year
    order by kind asc, year asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map((r, i) => ({
    id: `${r.kind}:${r.year}:${i}`, kind: r.kind, year: r.year, n: r.n
  }));

  return (
    <ListView
      title="出願推移"
      moduleCode="S-09 / LANDSCAPE — FILING TREND"
      description="取り込み済み特許を出願年・公開年別に集計した推移です。取り込み件数が少ないため、現時点では単年集計にとどまります。"
      rows={rows}
      emptyMessage="出願日・公開日が登録された特許データがまだありません。"
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'year', grow: true, mono: true, render: row => `${row.year} 年` },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}

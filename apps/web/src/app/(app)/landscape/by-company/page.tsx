import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; applicantName: string; n: number; countries: number };
type RawRow = { applicant_name: string; n: number; countries: number };

export default async function LandscapeByCompanyPage() {
  const db = getDb(getDatabaseUrl());
  const res = await db.execute(sql`
    select applicant_name, count(*)::int as n, count(distinct country)::int as countries
    from patents
    group by applicant_name
    order by n desc, applicant_name asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map(r => ({
    id: r.applicant_name, applicantName: r.applicant_name, n: r.n, countries: r.countries
  }));

  return (
    <ListView
      title="企業別出願分析"
      moduleCode="S-09 / LANDSCAPE — BY APPLICANT"
      description="取り込み済み特許を出願人（企業）単位で集計した件数です。"
      rows={rows}
      emptyMessage="集計対象の特許データがまだありません。"
      fields={[
        { key: 'applicantName', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.applicantName}</span> },
        { key: 'countries', render: row => `${row.countries} か国・地域` },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}

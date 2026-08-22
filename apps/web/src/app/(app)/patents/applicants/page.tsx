import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type ApplicantRow = {
  id: string;
  applicant: string;
  n: number;
  countries: string[];
  latestPublicationDate: string | null;
};

export default async function PatentApplicantsPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      applicant_name,
      count(*)::int as n,
      array_agg(distinct country order by country) as countries,
      max(publication_date) as latest_publication_date
    from patents
    group by applicant_name
    order by n desc, applicant_name asc
  `);
  const rows: ApplicantRow[] = (result.rows as any[]).map(r => ({
    id: r.applicant_name,
    applicant: r.applicant_name,
    n: Number(r.n),
    countries: r.countries as string[],
    latestPublicationDate: r.latest_publication_date as string | null
  }));

  return (
    <ListView
      title="出願人分析"
      moduleCode="S-03 / APPLICANT ANALYSIS"
      description="取り込み済み特許を出願人ごとに集計した一覧です。件数が多い順に表示します。"
      rows={rows}
      emptyMessage="特許データがまだありません。"
      fields={[
        { key: 'applicant', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.applicant}</span> },
        { key: 'countries', mono: true, render: row => row.countries.join(' / ') },
        { key: 'latest', mono: true, render: row => row.latestPublicationDate ?? '—' },
        { key: 'n', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.n}件</span> }
      ]}
    />
  );
}

import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type CompanyRow = {
  id: string; name: string; patentN: number; licenseN: number; isTrackedCompetitor: boolean;
  firstSeen: string | null; lastSeen: string | null;
};
type RawRow = {
  applicant_name: string; patent_n: number; license_n: number; competitor_match: number;
  first_seen: string | null; last_seen: string | null;
};

export default async function CompanyMasterPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      p.applicant_name,
      count(distinct p.id)::int as patent_n,
      (select count(*)::int from licenses l where lower(trim(l.counterpart_name)) = lower(trim(p.applicant_name))) as license_n,
      (select count(*)::int from competitors c where lower(trim(c.name)) = lower(trim(p.applicant_name))) as competitor_match,
      min(p.application_date) as first_seen,
      max(p.publication_date) as last_seen
    from patents p
    group by p.applicant_name
    order by patent_n desc, p.applicant_name asc
  `);
  const rows: CompanyRow[] = (result.rows as unknown as RawRow[]).map(r => ({
    id: r.applicant_name, name: r.applicant_name, patentN: Number(r.patent_n), licenseN: Number(r.license_n),
    isTrackedCompetitor: Number(r.competitor_match) > 0, firstSeen: r.first_seen, lastSeen: r.last_seen
  }));

  return (
    <ListView
      title="企業マスタ"
      moduleCode="S-18e / COMPANY MASTER"
      description="特許出願人名を正規名として集約した企業マスタです。競合企業マスタとの紐づき有無、ライセンス案件との関連件数も併せて確認できます。"
      badge="MVP"
      rows={rows}
      emptyMessage="企業マスタのデータがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'patentN', mono: true, render: row => `特許 ${row.patentN}件` },
        { key: 'licenseN', mono: true, render: row => `ライセンス ${row.licenseN}件` },
        { key: 'competitor', render: row => row.isTrackedCompetitor ? (
          <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>競合マスタ紐付済</span>
        ) : (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line)' }}>未紐付</span>
        ) },
        { key: 'lastSeen', mono: true, render: row => row.lastSeen ?? '—' }
      ]}
    />
  );
}

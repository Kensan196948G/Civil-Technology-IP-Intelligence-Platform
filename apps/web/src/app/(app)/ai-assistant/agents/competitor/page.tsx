import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function CompetitorAgentPage() {
  const db = getDb(getDatabaseUrl());
  const competitors = await db.select().from(s.competitors).orderBy(desc(s.competitors.createdAt));

  const patentCountRows = await db.execute(sql`select applicant_name, count(*)::int as n from patents group by applicant_name`);
  const patentCountByName = new Map((patentCountRows.rows as Array<{ applicant_name: string; n: number }>).map(r => [r.applicant_name, r.n]));

  return (
    <ListView
      title="Competitor Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="競合企業の出願動向をモニタリングするAgentです。competitors台帳を、特許（patents.applicant_name）の出願件数と突き合わせて表示します。"
      rows={competitors}
      emptyMessage="モニタリング対象の競合企業が登録されていません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'category', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.category ?? '—'}</span> },
        { key: 'patents', mono: true, render: row => `出願 ${patentCountByName.get(row.name) ?? 0} 件` }
      ]}
    />
  );
}

import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function PriorPatentsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.patents).orderBy(desc(s.patents.retrievedAt));

  return (
    <ListView
      title="先行特許"
      moduleCode="S-04a / PRIOR PATENTS"
      description="先行技術調査の対象となる、取り込み済みの他社特許の一覧です。"
      rows={rows}
      emptyMessage="特許データがまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'applicant', render: row => row.applicantName },
        { key: 'country', mono: true, render: row => row.country },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) }
      ]}
    />
  );
}

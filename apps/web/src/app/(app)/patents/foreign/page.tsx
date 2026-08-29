export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, ne } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function ForeignPatentsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.patents)
    .where(ne(s.patents.country, 'JP'))
    .orderBy(desc(s.patents.publicationDate));

  return (
    <ListView
      title="海外特許"
      moduleCode="S-03 / FOREIGN PATENTS"
      description="日本国外（JP以外）に出願・公開された特許の一覧です。"
      rows={rows}
      emptyMessage="海外特許データがまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'country', mono: true, render: row => row.country },
        { key: 'applicant', render: row => row.applicantName },
        { key: 'pubNo', mono: true, render: row => row.publicationNo ?? '—' },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

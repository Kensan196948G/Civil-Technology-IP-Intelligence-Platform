export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function DomesticPatentsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.patents)
    .where(eq(s.patents.country, 'JP'))
    .orderBy(desc(s.patents.publicationDate));

  return (
    <ListView
      title="国内特許"
      moduleCode="S-03 / DOMESTIC PATENTS"
      description="日本国内（JP）に出願・公開された特許の一覧です。"
      rows={rows}
      emptyMessage="国内特許データがまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'applicant', render: row => row.applicantName },
        { key: 'pubNo', mono: true, render: row => row.publicationNo ?? '—' },
        { key: 'pubDate', mono: true, render: row => row.publicationDate ?? '—' },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

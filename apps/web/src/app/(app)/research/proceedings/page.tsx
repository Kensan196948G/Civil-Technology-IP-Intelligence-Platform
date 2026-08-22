import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function ResearchProceedingsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.papers).orderBy(desc(s.papers.publishedOn));

  return (
    <ListView
      title="学会資料"
      moduleCode="S-07a / CONFERENCE PROCEEDINGS"
      description="学会論文集・シンポジウム予稿集など、外部で発表された論文・学会資料の一覧です。"
      rows={rows}
      emptyMessage="学会資料はまだありません。"
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'venue', render: row => row.venue ?? '—' },
        { key: 'publishedOn', mono: true, render: row => row.publishedOn ?? '—' },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

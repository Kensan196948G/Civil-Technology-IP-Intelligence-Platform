export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function PriorPapersPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.papers).orderBy(desc(s.papers.publishedOn));

  return (
    <ListView
      title="先行論文"
      moduleCode="S-04b / PRIOR PAPERS"
      description="先行技術調査の対象となる、取り込み済みの論文・研究情報の一覧です。"
      rows={rows}
      emptyMessage="論文データがまだありません。"
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'venue', render: row => row.venue ?? '—' },
        { key: 'publishedOn', mono: true, render: row => row.publishedOn ?? '—' },
        { key: 'source', render: row => row.source }
      ]}
    />
  );
}

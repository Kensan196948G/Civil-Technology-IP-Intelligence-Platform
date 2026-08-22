import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function QueriesPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.investigations).orderBy(desc(s.investigations.createdAt));

  return (
    <ListView
      title="調査検索式"
      moduleCode="S-04g / SEARCH QUERIES"
      description="各調査案件に登録された検索式（キーワード）の一覧です。過去の検索式の再利用や見直しに使えます。"
      rows={rows}
      emptyMessage="検索式データがまだありません。"
      fields={[
        { key: 'query', mono: true, grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.query}</span> },
        { key: 'title', render: row => row.title },
        { key: 'terms', mono: true, render: row => `${row.query.split(/\s+/).filter(Boolean).length} 語` }
      ]}
    />
  );
}

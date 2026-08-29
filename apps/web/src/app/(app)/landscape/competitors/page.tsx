import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function LandscapeCompetitorsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.competitors).orderBy(asc(s.competitors.category), asc(s.competitors.name));

  return (
    <ListView
      title="競合企業"
      moduleCode="S-09 / COMPETITOR INTELLIGENCE"
      description="特許・技術動向を継続的にウォッチしている競合企業の一覧です。"
      rows={rows}
      emptyMessage="登録済みの競合企業がまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'category', render: row => row.category ?? '—' },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

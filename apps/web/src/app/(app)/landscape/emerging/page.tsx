import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function LandscapeEmergingPage() {
  const db = getDb(getDatabaseUrl());
  // NETIS登録日が新しい順＝直近登場した新興技術の候補とみなす。
  const rows = await db.select().from(s.netisTechnologies).orderBy(desc(s.netisTechnologies.registeredOn));

  return (
    <ListView
      title="新興技術"
      moduleCode="S-09 / LANDSCAPE — EMERGING TECH"
      description="NETIS登録日が新しい技術ほど、直近登場した新興技術の候補として上位に表示します。"
      rows={rows}
      emptyMessage="NETIS登録技術のデータがまだありません。"
      rowHref={row => `/netis/${row.id}`}
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'category', render: row => row.category ?? '—' },
        { key: 'registeredOn', mono: true, render: row => row.registeredOn ?? '—' },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

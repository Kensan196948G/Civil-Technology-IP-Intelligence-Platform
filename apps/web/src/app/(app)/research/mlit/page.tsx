import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function ResearchMlitPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.netisTechnologies).orderBy(desc(s.netisTechnologies.registeredOn));

  return (
    <ListView
      title="国交省技術資料"
      moduleCode="S-07e / MLIT TECHNICAL DOCUMENTS"
      description="国土交通省NETIS（新技術情報提供システム）に登録された公開技術資料の一覧です。"
      rows={rows}
      emptyMessage="国交省技術資料（NETIS）データはまだありません。"
      rowHref={row => `/netis/${row.id}`}
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'netisNo', mono: true, render: row => row.netisNo },
        { key: 'category', render: row => row.category ?? '—' },
        { key: 'registeredOn', mono: true, render: row => row.registeredOn ?? '—' }
      ]}
    />
  );
}

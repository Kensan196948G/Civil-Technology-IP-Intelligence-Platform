import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function TechMethodsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.technologies)
    .where(eq(s.technologies.kind, 'method'))
    .orderBy(desc(s.technologies.createdAt))
    .limit(100);

  return (
    <ListView
      title="工法一覧"
      moduleCode="S-06 / TECHNOLOGY INTELLIGENCE"
      description="技術台帳のうち種別が「工法（method）」の技術の一覧です。"
      rows={rows}
      emptyMessage="工法として登録された技術データがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'workTypes', render: row => row.workTypes.length > 0 ? row.workTypes.join(' / ') : '—' },
        { key: 'maturity', render: row => row.maturity ?? '—' },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

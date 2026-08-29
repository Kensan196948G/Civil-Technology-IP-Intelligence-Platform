import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function TechMachineryPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.technologies)
    .where(eq(s.technologies.kind, 'machine'))
    .orderBy(desc(s.technologies.createdAt));

  return (
    <ListView
      title="建設機械・設備"
      moduleCode="S-06 / TECHNOLOGY INTELLIGENCE"
      description="技術台帳のうち種別が「機械（machine）」の建設機械・設備の一覧です。"
      rows={rows}
      emptyMessage="建設機械・設備として登録された技術データがまだありません。"
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

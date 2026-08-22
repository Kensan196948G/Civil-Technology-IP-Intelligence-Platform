import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function ResearchersPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.researchers).orderBy(asc(s.researchers.name)).limit(100);

  return (
    <ListView
      title="発明者"
      moduleCode="S-07d / RESEARCHERS"
      description="社内外の発明者・研究者の一覧です。特許の発明者分析、論文著者、ウォッチ対象の把握に利用します。"
      rows={rows}
      emptyMessage="発明者・研究者データはまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'affiliation', render: row => row.affiliation ?? '—' },
        { key: 'field', render: row => row.field ?? '—' },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

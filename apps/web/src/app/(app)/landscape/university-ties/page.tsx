import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, or, ilike } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function LandscapeUniversityTiesPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.researchers)
    .where(or(ilike(s.researchers.affiliation, '%大学%'), ilike(s.researchers.affiliation, '%univ%')))
    .orderBy(asc(s.researchers.affiliation), asc(s.researchers.name))
    .limit(100);

  return (
    <ListView
      title="大学連携分析"
      moduleCode="S-09 / LANDSCAPE — UNIVERSITY TIES"
      description="所属（affiliation）に大学・Universityを含む研究者を、大学連携候補として一覧化します。"
      rows={rows}
      emptyMessage="大学所属の研究者データがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'affiliation', render: row => row.affiliation ?? '—' },
        { key: 'field', render: row => row.field ? (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.field}</span>
        ) : null },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

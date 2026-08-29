import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, or, ilike } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function TechRoboticsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.technologies)
    .where(or(
      ilike(s.technologies.name, '%ロボット%'), ilike(s.technologies.summary, '%ロボット%'),
      ilike(s.technologies.name, '%ロボティクス%'), ilike(s.technologies.summary, '%ロボティクス%')
    ))
    .orderBy(desc(s.technologies.createdAt));

  return (
    <ListView
      title="ロボティクス"
      moduleCode="S-06 / TECHNOLOGY INTELLIGENCE"
      description="技術台帳から名称・概要に「ロボット」「ロボティクス」を含む技術を抽出した一覧です。"
      rows={rows}
      emptyMessage="ロボティクスに関連する技術データがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'maturity', render: row => row.maturity ?? '—' },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

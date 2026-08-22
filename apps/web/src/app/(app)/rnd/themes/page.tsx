import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = {
  technology: '技術', method: '工法', material: '材料', machine: '建設機械'
};

export default async function RndThemesPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.technologies).orderBy(desc(s.technologies.createdAt));

  return (
    <ListView
      title="研究テーマ"
      moduleCode="S-10 / RESEARCH THEMES"
      description="R&Dが取り組んでいる自社技術・工法・材料の研究テーマ一覧です。"
      rows={rows}
      emptyMessage="研究テーマがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'kind', mono: true, render: row => KIND_LABEL[row.kind] ?? row.kind },
        { key: 'maturity', render: row => row.maturity ?? '—' },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

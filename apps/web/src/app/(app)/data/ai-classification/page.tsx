export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const KIND_LABEL: Record<string, string> = { patent: '特許', technology: '技術' };
const CLASS_COLOR: Record<string, string> = {
  C1: 'var(--ink-2)', C2: 'var(--blue)', C3: 'var(--amber)', C4: 'var(--brick)'
};

type ClassRow = { id: string; entityId: string; kind: string; name: string; classification: string };
type RawRow = { id: string; kind: string; name: string; classification: string };

export default async function AiClassificationPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select id, 'patent' as kind, title as name, classification::text as classification from patents
    union all
    select id, 'technology' as kind, name, classification::text as classification from technologies
    order by classification asc, kind asc, name asc
  `);
  const rows: ClassRow[] = (result.rows as unknown as RawRow[]).map(r => ({
    id: `${r.kind}-${r.id}`, entityId: r.id, kind: r.kind, name: r.name, classification: r.classification
  }));

  return (
    <ListView
      title="AI分類"
      moduleCode="S-18j / AI CLASSIFICATION"
      description="特許・技術情報に付与された秘密区分（C1〜C4）の一覧です。区分はAI一次判定を含む登録時ワークフローで設定され、最終確定は承認フロー（human_check）を経ます。区分の妥当性確認・監査に使用します。"
      badge="MVP"
      rows={rows}
      emptyMessage="分類済みのデータがまだありません。"
      rowHref={row => row.kind === 'patent' ? `/patents/${row.entityId}` : ''}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: CLASS_COLOR[row.classification] ?? 'var(--ink-2)', border: `1px solid ${CLASS_COLOR[row.classification] ?? 'var(--ink-2)'}` }}>
            {row.classification}
          </span>
        ) }
      ]}
    />
  );
}

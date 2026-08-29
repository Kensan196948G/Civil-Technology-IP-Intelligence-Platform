import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


// 特許スキーマは出願人（applicant_name）のみを保持し、発明者個人を紐づけるカラムを
// 持たない（MVPスキーマの制約）。そのため、社内外の技術者・研究者を管理する
// researchers テーブルを「発明者分析」の母集団として代用する。
export default async function PatentInventorsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.researchers).orderBy(asc(s.researchers.name));

  return (
    <ListView
      title="発明者分析"
      moduleCode="S-03 / INVENTOR ANALYSIS"
      description="技術分野に関連する研究者・発明者の一覧です。特許データは出願人単位のみを保持するため、個人単位の分析には researchers データを使用しています。"
      badge="MVP"
      rows={rows}
      emptyMessage="研究者・発明者データがまだありません。"
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

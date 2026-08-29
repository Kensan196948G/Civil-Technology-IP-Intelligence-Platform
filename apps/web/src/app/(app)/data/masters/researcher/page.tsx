import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function ResearcherMasterPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.researchers).orderBy(asc(s.researchers.affiliation), asc(s.researchers.name));

  return (
    <ListView
      title="発明者マスタ"
      moduleCode="S-18f / RESEARCHER MASTER"
      description="社内外の発明者・研究者の氏名・所属を正規化して管理するマスタです。発明者分析・ウォッチ対象登録・論文著者照合など、複数画面から共通参照されます。"
      badge="MVP"
      rows={rows}
      emptyMessage="発明者マスタのデータがまだありません。"
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

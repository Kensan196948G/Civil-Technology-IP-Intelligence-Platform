import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function TechMasterPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.technologies).orderBy(asc(s.technologies.kind), asc(s.technologies.name));

  return (
    <ListView
      title="技術マスタ"
      moduleCode="S-18b / TECHNOLOGY MASTER"
      description="社内で保有・調査した技術・工法・材料・機械の名称マスタです。他画面（技術一覧・現場適用性判定・発明起票）から共通で参照される正規データとして管理します。"
      badge="MVP"
      rows={rows}
      emptyMessage="技術マスタのデータがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'workTypes', render: row => row.workTypes.length ? row.workTypes.join(' / ') : '—' },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; counterpart_name: string; deal_n: number; category: string | null };

export default async function LicensorsPage() {
  const db = getDb(getDatabaseUrl());
  // ライセンサー = 技術導入（license_in）案件の相手方。competitors マスタと名称一致すれば
  // カテゴリを補完する（一致しない場合はマスタ未登録の相手方として '—' 表示）。
  const result = await db.execute(sql`
    select min(l.counterpart_name) as id, l.counterpart_name, count(*) as deal_n, min(c.category) as category
    from licenses l
    left join competitors c on c.name = l.counterpart_name
    where l.kind = 'license_in'
    group by l.counterpart_name
    order by deal_n desc, l.counterpart_name
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="ライセンサー"
      moduleCode="S-11e / LICENSING & IP PORTFOLIO"
      description="技術導入（ライセンスイン）案件の相手方＝ライセンサーを、案件件数の多い順に一覧します。"
      rows={rows}
      emptyMessage="ライセンサーの登録はまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpart_name}</span> },
        { key: 'category', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.category ?? '—'}</span> },
        { key: 'deal_n', mono: true, render: row => `導入案件 ${row.deal_n} 件` }
      ]}
    />
  );
}

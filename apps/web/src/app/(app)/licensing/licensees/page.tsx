import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; counterpart_name: string; deal_n: number; category: string | null };

export default async function LicenseesPage() {
  const db = getDb(getDatabaseUrl());
  // ライセンシー = ライセンスアウト（license_out）案件の相手方。competitors マスタと
  // 名称一致すればカテゴリを補完する。
  const result = await db.execute(sql`
    select min(l.counterpart_name) as id, l.counterpart_name, count(*) as deal_n, min(c.category) as category
    from licenses l
    left join competitors c on c.name = l.counterpart_name
    where l.kind = 'license_out'
    group by l.counterpart_name
    order by deal_n desc, l.counterpart_name
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="ライセンシー"
      moduleCode="S-11f / LICENSING & IP PORTFOLIO"
      description="ライセンスアウト案件の相手方＝ライセンシーを、案件件数の多い順に一覧します。"
      rows={rows}
      emptyMessage="ライセンシーの登録はまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpart_name}</span> },
        { key: 'category', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.category ?? '—'}</span> },
        { key: 'deal_n', mono: true, render: row => `供与案件 ${row.deal_n} 件` }
      ]}
    />
  );
}

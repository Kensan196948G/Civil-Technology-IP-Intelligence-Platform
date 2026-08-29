export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; name: string; kind: string; maturity: string | null; field_n: number; license_n: number };

// 「活用状況」は、発明届ワークフロー（審査中〜登録前）ではなく、
// 実際に活用実績が発生し得る自社技術資産（technologies）を対象に、
// 現場適用（field_applications）とライセンス化（licenses）の実件数を集計して示す。
// CodeRabbit指摘: licensesを状態で絞らないと、見送り（rejected）・評価中
// （evaluating/candidate）の案件まで「活用実績あり」に計上されてしまう。
// 契約済み（agreed）の案件のみをライセンス化実績として数える。
export default async function PortfolioUsagePage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select t.id, t.name, t.kind, t.maturity,
      count(distinct fa.id) as field_n,
      count(distinct l.id) as license_n
    from technologies t
    left join field_applications fa on fa.candidate_type = 'technology' and fa.candidate_id = t.id
    left join licenses l on l.subject_type = 'technology' and l.subject_id = t.id and l.status = 'agreed'
    group by t.id, t.name, t.kind, t.maturity
    order by (count(distinct fa.id) + count(distinct l.id)) desc, t.name
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="活用状況"
      moduleCode="S-11n / LICENSING & IP PORTFOLIO"
      description="自社技術資産ごとに、現場適用件数（field_applications）とライセンス化件数（licenses）を集計し、実際の活用実績を示します。"
      badge="MVP"
      rows={rows}
      emptyMessage="自社技術資産の登録がまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'field_n', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>現場適用 {row.field_n} 件</span> },
        { key: 'license_n', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>ライセンス化 {row.license_n} 件</span> },
        { key: 'total', render: row => {
          const total = Number(row.field_n) + Number(row.license_n);
          return (
            <span className="badge" style={{ color: total > 0 ? 'var(--green)' : 'var(--ink-2)', border: `1px solid ${total > 0 ? 'var(--green)' : 'var(--line)'}` }}>
              {total > 0 ? '活用実績あり' : '未活用'}
            </span>
          );
        } }
      ]}
    />
  );
}

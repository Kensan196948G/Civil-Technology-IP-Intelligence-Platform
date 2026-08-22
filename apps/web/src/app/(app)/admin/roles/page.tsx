import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

// role_t enum（schema.ts）に対応するロール定義。権限テーブルは持たないため、
// enumで定義された固定ロールに対し、実際の割当人数を users テーブルから集計する。
const ROLE_META: { role: string; label: string; description: string }[] = [
  { role: 'sysadmin', label: 'システム管理者', description: 'ユーザー・権限・システム設定の管理権限を持つ。' },
  { role: 'executive', label: '経営層', description: '経営判断に関わる案件の閲覧・承認権限を持つ。' },
  { role: 'legal', label: '法務', description: 'ライセンス・契約関連案件の承認権限を持つ。' },
  { role: 'ip', label: '知財担当', description: '特許・発明届のIPレビュー権限を持つ。' },
  { role: 'tech_manager', label: '技術管理者', description: '技術案件の技術レビュー権限を持つ。' },
  { role: 'rnd', label: '研究開発', description: '技術・論文の調査・登録権限を持つ。' },
  { role: 'engineer', label: '技術者', description: '現場適用・発明届の起案権限を持つ。' },
  { role: 'viewer', label: '閲覧者', description: '閲覧のみの権限を持つ。' }
];

export default async function AdminRolesPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`select role, count(*)::int as n from users group by role`);
  const countByRole = new Map<string, number>((result.rows as any[]).map(r => [r.role as string, Number(r.n)]));

  const rows = ROLE_META.map(m => ({ ...m, id: m.role, n: countByRole.get(m.role) ?? 0 }));

  return (
    <ListView
      title="ロール・権限"
      moduleCode="S-19 / SYSTEM ADMIN"
      description="システムで定義されているロールの一覧です。件数は現在割り当てられている利用者数です。"
      rows={rows}
      emptyMessage="ロール定義がありません。"
      fields={[
        { key: 'label', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.label}</span> },
        { key: 'role', mono: true, render: row => row.role },
        { key: 'description', grow: true, render: row => <span style={{ color: 'var(--ink-2)' }}>{row.description}</span> },
        { key: 'n', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.n} 名</span> }
      ]}
    />
  );
}

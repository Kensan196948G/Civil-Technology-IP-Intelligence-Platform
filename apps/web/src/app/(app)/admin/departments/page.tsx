import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type DeptRow = { id: string; code: string; name: string; n: number };

export default async function AdminDepartmentsPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select d.id, d.code, d.name, count(u.id)::int as n
    from departments d
    left join users u on u.department_id = d.id
    group by d.id, d.code, d.name
    order by d.code asc
  `);
  const rows: DeptRow[] = (result.rows as any[]).map(r => ({
    id: r.id as string, code: r.code as string, name: r.name as string, n: Number(r.n)
  }));

  return (
    <ListView
      title="部門管理"
      moduleCode="S-19 / SYSTEM ADMIN"
      description="登録されている部門の一覧です。件数は所属する利用者数です。"
      rows={rows}
      emptyMessage="登録済みの部門はありません。"
      fields={[
        { key: 'code', mono: true, render: row => row.code },
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'n', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.n} 名</span> }
      ]}
    />
  );
}

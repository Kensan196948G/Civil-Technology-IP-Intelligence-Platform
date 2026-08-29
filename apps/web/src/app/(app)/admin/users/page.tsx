import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const ROLE_LABEL: Record<string, string> = {
  engineer: '技術者', tech_manager: '技術管理者', rnd: '研究開発',
  ip: '知財担当', legal: '法務', executive: '経営層', sysadmin: 'システム管理者', viewer: '閲覧者'
};

export default async function AdminUsersPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db
    .select({
      id: s.users.id,
      email: s.users.email,
      displayName: s.users.displayName,
      role: s.users.role,
      isActive: s.users.isActive,
      createdAt: s.users.createdAt,
      departmentName: s.departments.name
    })
    .from(s.users)
    .leftJoin(s.departments, eq(s.users.departmentId, s.departments.id))
    .orderBy(asc(s.users.displayName));

  return (
    <ListView
      title="ユーザー管理"
      moduleCode="S-19 / SYSTEM ADMIN"
      description="登録されている利用者の一覧です。氏名・所属部門・ロール・有効状態を確認できます。"
      rows={rows}
      emptyMessage="登録済みの利用者はいません。"
      fields={[
        { key: 'displayName', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.displayName}</span> },
        { key: 'email', mono: true, render: row => row.email },
        { key: 'department', render: row => row.departmentName ?? '—' },
        { key: 'role', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{ROLE_LABEL[row.role] ?? row.role}</span>
        ) },
        { key: 'isActive', render: row => row.isActive
          ? <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>有効</span>
          : <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>無効</span>
        }
      ]}
    />
  );
}

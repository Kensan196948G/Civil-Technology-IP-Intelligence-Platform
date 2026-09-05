import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明（C3）は R ロールまたは起案者本人のみ一覧に出す。

export default async function ResearchResultsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const rows = await db.select().from(s.inventions)
    .where(visibleWhere(s.inventions.classification, s.inventions.submittedBy, { role: user.role, viewerUserId: me?.id }))
    .orderBy(desc(s.inventions.createdAt));

  const userIds = [...new Set(rows.map(r => r.submittedBy))];
  const users = userIds.length ? await db.select().from(s.users).where(inArray(s.users.id, userIds)) : [];
  const userById = new Map(users.map(u => [u.id, u]));

  return (
    <ListView
      title="研究成果"
      moduleCode="S-07b / RESEARCH RESULTS"
      description="現場・技術者から届け出られた発明届など、社内の研究開発成果の一覧です。各件から審査ワークフローの状況を確認できます。"
      rows={rows}
      emptyMessage="研究成果（発明届）はまだありません。"
      rowHref={row => `/inventions/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'submittedBy', render: row => userById.get(row.submittedBy)?.displayName ?? '—' },
        { key: 'createdAt', mono: true, render: row => ymd(row.createdAt) }
      ]}
    />
  );
}

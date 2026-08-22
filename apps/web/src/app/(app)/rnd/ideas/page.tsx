import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function RndIdeasPage() {
  const db = getDb(getDatabaseUrl());
  const inventions = await db.select().from(s.inventions).orderBy(desc(s.inventions.createdAt));

  const userIds = [...new Set(inventions.map(i => i.submittedBy))];
  const users = userIds.length ? await db.select().from(s.users).where(inArray(s.users.id, userIds)) : [];
  const userById = new Map(users.map(u => [u.id, u]));

  const siteIds = [...new Set(inventions.map(i => i.siteId).filter((v): v is string => !!v))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];
  const siteById = new Map(sites.map(sv => [sv.id, sv]));

  return (
    <ListView
      title="発明アイデア"
      moduleCode="S-10 / INVENTION IDEAS"
      description="現場や技術者の工夫を発明の種として整理した発明届の一覧です。各件から審査状況を確認できます。"
      rows={inventions}
      emptyMessage="発明アイデア（発明届）はまだありません。"
      rowHref={row => `/inventions/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'site', render: row => row.siteId ? siteById.get(row.siteId)?.name ?? '—' : '—' },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'submitter', mono: true, render: row => userById.get(row.submittedBy)?.displayName ?? '—' }
      ]}
    />
  );
}

import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function AdminFeatureFlagsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.featureFlags).orderBy(asc(s.featureFlags.key));

  return (
    <ListView
      title="Feature Flags"
      moduleCode="S-19 / SYSTEM ADMIN"
      description="機能フラグの一覧です（本番では管理画面から切替可能にする予定。現在は参照のみ）。"
      badge="参照のみ"
      rows={rows}
      emptyMessage="登録済みのFeature Flagはありません。"
      fields={[
        { key: 'key', mono: true, grow: true, render: row => row.key },
        { key: 'description', grow: true, render: row => <span style={{ color: 'var(--ink-2)' }}>{row.description ?? '—'}</span> },
        { key: 'enabled', render: row => row.enabled
          ? <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>有効</span>
          : <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line)' }}>無効</span>
        },
        { key: 'updatedAt', mono: true, render: row => String(row.updatedAt).slice(0, 19).replace('T', ' ') }
      ]}
    />
  );
}

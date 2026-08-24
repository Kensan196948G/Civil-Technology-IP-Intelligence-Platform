import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { stampSec } from '@/lib/labels';

export const runtime = 'edge';

// settings.key の接頭辞でグループを分ける（lib/db/seed.ts の settingDefs 参照）。
const GROUP_META: Record<string, { label: string; prefix: string }> = {
  'ai-model': { label: 'AIモデル設定', prefix: 'ai.model.' },
  agent: { label: 'Agent設定', prefix: 'agent.' },
  api: { label: 'API設定', prefix: 'api.' },
  integration: { label: '外部データ連携', prefix: 'integration.' },
  notification: { label: '通知設定', prefix: 'notification.' },
  workflow: { label: 'ワークフロー設定', prefix: 'workflow.' },
  master: { label: 'マスタ設定', prefix: 'master.' }
};

export default async function AdminSettingsPage({ searchParams }: { searchParams: { group?: string } }) {
  const db = getDb(getDatabaseUrl());
  const groupKey = searchParams.group && GROUP_META[searchParams.group] ? searchParams.group : 'ai-model';
  const meta = GROUP_META[groupKey]!;

  const all = await db.select().from(s.settings).orderBy(asc(s.settings.key));
  const rows = all.filter(row => row.key.startsWith(meta.prefix));

  return (
    <ListView
      title={`システム設定 — ${meta.label}`}
      moduleCode="S-19 / SYSTEM ADMIN"
      description="MVP環境の設定値です（本番では管理画面から編集可能にする予定。現在は参照のみ）。"
      badge="参照のみ"
      rows={rows}
      emptyMessage="このグループの設定はまだ登録されていません。"
      fields={[
        { key: 'key', mono: true, grow: true, render: row => row.key },
        { key: 'description', render: row => row.description ?? '—' },
        { key: 'value', mono: true, render: row => (
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{JSON.stringify(row.value)}</span>
        ) },
        { key: 'updatedAt', mono: true, render: row => stampSec(row.updatedAt) }
      ]}
    />
  );
}

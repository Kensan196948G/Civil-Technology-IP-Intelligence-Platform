export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const KIND_LABEL: Record<string, string> = { license_in: 'ライセンスIN', license_out: 'ライセンスOUT' };
const STATUS_LABEL: Record<string, string> = { candidate: '候補', evaluating: '評価中', agreed: '合意', declined: '見送り' };

export default async function LicensingAgentPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.licenses).orderBy(desc(s.licenses.createdAt));

  return (
    <ListView
      title="Licensing Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="ライセンスIN／OUT案件を評価するAgentです。licenses台帳を一覧表示します。対象が特許の場合は特許詳細へ遷移できます。"
      rows={rows}
      emptyMessage="ライセンス案件はまだありません。"
      rowHref={row => row.subjectType === 'patent' ? `/patents/${row.subjectId}` : ''}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: row.kind === 'license_in' ? 'var(--blue)' : 'var(--green)', border: `1px solid ${row.kind === 'license_in' ? 'var(--blue)' : 'var(--green)'}` }}>
            {KIND_LABEL[row.kind] ?? row.kind}
          </span>
        ) },
        { key: 'counterpart', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.counterpartName}</span> },
        { key: 'subject', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>対象：{row.subjectType}</span> },
        { key: 'status', render: row => <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>{STATUS_LABEL[row.status] ?? row.status}</span> }
      ]}
    />
  );
}

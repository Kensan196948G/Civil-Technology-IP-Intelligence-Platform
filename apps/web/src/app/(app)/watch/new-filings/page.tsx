import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function WatchNewFilingsPage() {
  const db = getDb(getDatabaseUrl());
  // 「新規出願」＝システムに新しく取り込まれた（retrieved_at が新しい）特許を監視する。
  const rows = await db.select().from(s.patents).orderBy(desc(s.patents.retrievedAt));

  return (
    <ListView
      title="新規出願ウォッチ"
      moduleCode="S-19 / WATCH — NEW FILINGS"
      description="新たに取り込まれた他社特許出願の一覧です。出願日・公開日・出願人を確認し、必要に応じて個別ウォッチへ登録してください。"
      rows={rows}
      emptyMessage="新規出願データはまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'applicant', render: row => row.applicantName },
        { key: 'country', mono: true, render: row => row.country },
        { key: 'applicationDate', mono: true, render: row => `出願 ${row.applicationDate ?? '—'}` },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}

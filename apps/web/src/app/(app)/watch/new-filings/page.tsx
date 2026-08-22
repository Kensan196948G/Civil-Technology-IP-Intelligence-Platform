import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function WatchNewFilingsPage() {
  const db = getDb(getDatabaseUrl());
  // CodeRabbit指摘: 「新規出願」と称しているが、既読・未読を区別するウォーターマーク
  // （最終確認時刻等）を持たないため、実際には取込み済み特許の全件を毎回表示している。
  // MVPでは正直に「取込み日時順の全件表示」と説明し、上限を設ける。
  // 本番設計では利用者ごとの既読カーソルを追加し、真の「新規」判定を実装する。
  const rows = await db.select().from(s.patents).orderBy(desc(s.patents.retrievedAt)).limit(100);

  return (
    <ListView
      title="特許取込み一覧（新着順）"
      moduleCode="S-19 / WATCH — NEW FILINGS"
      description="取込み日時が新しい順に特許を表示します。利用者ごとの既読管理は未実装のため、既に確認済みの特許も含めて全件表示しています（本番設計でのバックログ）。"
      badge="全件表示"
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

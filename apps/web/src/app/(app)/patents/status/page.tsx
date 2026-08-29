import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


// MVPスキーマは特許庁の公式な権利状態（登録・拒絶・存続期間満了等）を保持しない。
// 出願日・公開日という実データから、特許法上の存続期間（出願から原則20年）を
// 目安に推定表示する（あくまで参考表示であり、公式な権利状態確認には各国特許庁の
// 公式データベース照会が必要）。
const YEARS_20_MS = 20 * 365.25 * 24 * 60 * 60 * 1000;

// CodeRabbit指摘: publicationDate（公開日）だけでは「登録」「存続中」を断定できない
// （未収録・未公開・取下げ等と区別できないため）。取得済みの日付事実のみを中立的に示す。
function estimateStatus(applicationDate: string | null, publicationDate: string | null) {
  if (!applicationDate) return { label: '出願日不明', color: 'var(--ink-2)' };
  const applied = new Date(applicationDate).getTime();
  if (Number.isNaN(applied)) return { label: '出願日不明', color: 'var(--ink-2)' };
  const expiryEstimate = applied + YEARS_20_MS;
  if (Date.now() > expiryEstimate) return { label: '出願から20年経過', color: 'var(--ink-2)' };
  if (publicationDate) return { label: '公開日収録済み', color: 'var(--blue)' };
  return { label: '公開日未収録', color: 'var(--ink-2)' };
}

export default async function PatentStatusPage() {
  const db = getDb(getDatabaseUrl());
  const patents = await db.select().from(s.patents).orderBy(desc(s.patents.applicationDate));
  const rows = patents.map(p => ({ ...p, status: estimateStatus(p.applicationDate, p.publicationDate) }));

  return (
    <ListView
      title="権利状態確認"
      moduleCode="S-03 / RIGHTS STATUS"
      description="出願日・公開日から存続期間（出願から原則20年）を目安に推定した権利状態です。公式な権利状態は各国特許庁の原簿を確認してください。"
      badge="推定"
      rows={rows}
      emptyMessage="特許データがまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'country', mono: true, render: row => row.country },
        { key: 'applicationDate', mono: true, render: row => row.applicationDate ?? '—' },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: row.status.color, border: `1px solid ${row.status.color}` }}>{row.status.label}</span>
        ) }
      ]}
    />
  );
}

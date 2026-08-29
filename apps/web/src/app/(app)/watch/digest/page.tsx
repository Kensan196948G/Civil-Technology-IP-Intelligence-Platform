import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, desc } from 'drizzle-orm';
import { InfoPage } from '@/components/InfoPage';
import { stamp } from '@/lib/labels';


const AI_KIND_LABEL: Record<string, string> = {
  examine: 'AI模擬審査', claim_compare: 'Claim比較', field_score: '現場適用性スコアリング'
};

export default async function WatchDigestPage() {
  const db = getDb(getDatabaseUrl());

  const [[patentsCount], [papersCount], [netisCount], [watchesCount], recentRuns] = await Promise.all([
    db.select({ n: count() }).from(s.patents),
    db.select({ n: count() }).from(s.papers),
    db.select({ n: count() }).from(s.netisTechnologies),
    db.select({ n: count() }).from(s.watches),
    db.select().from(s.aiRuns).orderBy(desc(s.aiRuns.createdAt)).limit(5)
  ]);

  return (
    <InfoPage
      title="週次AIダイジェスト"
      moduleCode="S-19 / WATCH — WEEKLY AI DIGEST"
      description="登録済みウォッチ・監視対象データをAIが要約した週次ダイジェストです（MVPでは蓄積データの件数サマリーと直近のAI実行を表示。本番設計では週次バッチによる自動要約配信を予定）。"
      badge="MVP"
      blocks={[
        { label: '登録ウォッチ件数', value: `${watchesCount?.n ?? 0} 件` },
        { label: '特許データ件数', value: `${patentsCount?.n ?? 0} 件` },
        { label: '論文データ件数', value: `${papersCount?.n ?? 0} 件` },
        { label: 'NETIS技術件数', value: `${netisCount?.n ?? 0} 件` }
      ]}
      note="このページは本番設計フェーズで、ウォッチ条件に基づく週次メール配信・Slack通知と連携する予定です（バックログ）。"
    >
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          直近のAI実行（ダイジェスト対象）
        </div>
        {recentRuns.length === 0 && (
          <div style={{ padding: '13px 16px', fontSize: 13, color: 'var(--ink-2)' }}>直近のAI実行はまだありません。</div>
        )}
        {recentRuns.map((run, i) => (
          <div key={run.id} style={{ padding: '11px 16px', borderBottom: i < recentRuns.length - 1 ? '1px solid var(--line-2)' : 'none', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
            <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{AI_KIND_LABEL[run.kind] ?? run.kind}</span>
            <span className="mono" style={{ color: 'var(--ink-2)' }}>{run.model}</span>
            <span style={{ flexGrow: 1 }} />
            <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{stamp(run.createdAt)}</span>
          </div>
        ))}
      </div>
    </InfoPage>
  );
}

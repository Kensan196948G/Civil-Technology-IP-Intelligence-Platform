import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, desc, sql } from 'drizzle-orm';
import { InfoPage } from '@/components/InfoPage';


export default async function ResearchTrendsPage() {
  const db = getDb(getDatabaseUrl());

  const [[papersCount], [netisCount], [researchersCount], fieldsResult, latestPapers, latestNetis] = await Promise.all([
    db.select({ n: count() }).from(s.papers),
    db.select({ n: count() }).from(s.netisTechnologies),
    db.select({ n: count() }).from(s.researchers),
    db.execute(sql`select string_agg(distinct field, '、' order by field) as fields from researchers where field is not null`),
    db.select().from(s.papers).orderBy(desc(s.papers.publishedOn)).limit(3),
    db.select().from(s.netisTechnologies).orderBy(desc(s.netisTechnologies.registeredOn)).limit(3)
  ]);
  const activeFields = (fieldsResult.rows as { fields: string | null }[])[0]?.fields ?? '—';

  return (
    <InfoPage
      title="最新研究トレンド"
      moduleCode="S-07i / RESEARCH TRENDS"
      description="蓄積された論文・NETIS・研究者データから見た、研究動向のサマリーです。"
      badge="MVP"
      blocks={[
        { label: '学会資料・論文件数', value: `${papersCount?.n ?? 0} 件` },
        { label: 'NETIS登録技術件数', value: `${netisCount?.n ?? 0} 件` },
        { label: '発明者・研究者数', value: `${researchersCount?.n ?? 0} 名` },
        { label: '主要研究分野', value: activeFields }
      ]}
      note="このページは本番設計フェーズで、外部データソース（学会DB・NETIS API等）からの定期取得と時系列トレンド分析に拡張する予定です（バックログ）。"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
            直近の学会資料
          </div>
          {latestPapers.length === 0 ? (
            <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>学会資料はまだありません。</div>
          ) : (
            latestPapers.map(p => (
              <div key={p.id} style={{ padding: '11px 16px', borderBottom: '1px solid var(--line-2)', fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{p.title}</span>
                <span style={{ color: 'var(--ink-2)', marginLeft: 8 }}>{p.venue ?? '—'} ｜ <span className="mono">{p.publishedOn ?? '—'}</span></span>
              </div>
            ))
          )}
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
            直近のNETIS登録技術
          </div>
          {latestNetis.length === 0 ? (
            <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>NETIS登録技術はまだありません。</div>
          ) : (
            latestNetis.map(n => (
              <div key={n.id} style={{ padding: '11px 16px', borderBottom: '1px solid var(--line-2)', fontSize: 13 }}>
                <span style={{ fontWeight: 700 }}>{n.name}</span>
                <span style={{ color: 'var(--ink-2)', marginLeft: 8 }}>{n.category ?? '—'} ｜ 登録 <span className="mono">{n.registeredOn ?? '—'}</span></span>
              </div>
            ))
          )}
        </div>
      </div>
    </InfoPage>
  );
}

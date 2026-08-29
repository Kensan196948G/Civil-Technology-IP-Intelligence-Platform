import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray, sql } from 'drizzle-orm';
import Link from 'next/link';
import { FilterChips, Notice, Tag } from '@/components/ui';
import { DetailRow } from '@/components/detail/DetailOpener';
import { ymd } from '@/lib/labels';


// 設計案（design-B-copilot）の「調査案件」。
// AIが調べ、人が確認する先行技術調査の一覧。進行中／完了で絞り込み、行から詳細ドロワーを開く。

const FILTERS = ['active', 'done', 'all'] as const;
type Filter = (typeof FILTERS)[number];

const STATUS: Record<string, { label: string; tone: 'purple' | 'green' | 'amber' }> = {
  open: { label: '実行中', tone: 'purple' },
  closed: { label: '完了', tone: 'green' }
};

export default async function InvestigationsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const filter: Filter = FILTERS.includes(searchParams.filter as Filter) ? (searchParams.filter as Filter) : 'active';

  const db = getDb(getDatabaseUrl());
  const all = await db.select().from(s.investigations).orderBy(desc(s.investigations.createdAt));

  const creatorIds = [...new Set(all.map(r => r.createdBy))];
  const creators = creatorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, creatorIds)) : [];
  const creatorById = new Map(creators.map(u => [u.id, u]));

  // 根拠件数は ai_runs → ai_citations を調査案件ごとに数える（0件の実行は保存されない前提）。
  const evidenceRows = await db.execute(sql`
    select r.target_id::text as target_id, count(c.id)::int as n
    from ai_runs r left join ai_citations c on c.ai_run_id = r.id
    where r.target_type = 'investigation'
    group by r.target_id
  `);
  const evidenceByTarget = new Map(
    (evidenceRows.rows as Array<{ target_id: string; n: number }>).map(e => [e.target_id, Number(e.n)])
  );

  const openCount = all.filter(r => r.status === 'open').length;
  const doneCount = all.filter(r => r.status === 'closed').length;
  const rows = filter === 'all' ? all : all.filter(r => (filter === 'active' ? r.status === 'open' : r.status === 'closed'));

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <FilterChips
          basePath="/investigations"
          param="filter"
          current={filter}
          chips={[
            { key: 'active', label: '進行中', count: openCount },
            { key: 'done', label: '完了', count: doneCount },
            { key: 'all', label: 'すべて', count: all.length }
          ]}
        />
        <span style={{ flex: 1 }} />
        <Link href="/ai-assistant" className="btn btn-primary">＋ Copilotから新規調査</Link>
      </div>

      <div className="panel row-list" style={{ overflow: 'hidden' }}>
        {rows.length === 0 && (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>
            該当する調査案件はありません。「Copilotから新規調査」または「新規調査」から登録してください。
          </div>
        )}
        {rows.map(r => {
          const st = STATUS[r.status] ?? { label: r.status, tone: 'amber' as const };
          const owner = creatorById.get(r.createdBy)?.displayName ?? '—';
          const evidence = evidenceByTarget.get(r.id) ?? 0;
          return (
            <DetailRow
              key={r.id}
              className="row row-top"
              detail={{
                title: r.title,
                tag: st.label,
                tone: st.tone,
                meta: [
                  { k: '状態', v: st.label },
                  { k: '検索式', v: r.query },
                  { k: '根拠', v: `${evidence}件` },
                  { k: '担当', v: owner },
                  { k: '登録', v: ymd(r.createdAt) }
                ],
                body: r.status === 'open'
                  ? 'AIが検索式を組み立て、ヒットした文献を関連度順に精査しています。完了後は重要文献ランキングの人の確認ステップに進みます。'
                  : 'AI調査と人の確認が完了した案件です。成果物は先行技術調査書としてレポートに残ります。',
                note: 'AI調査の直後には必ず人の確認ステップが入ります。根拠が1件も付かないAI実行は保存されません。',
                actions: [
                  { label: '重要文献ランキングを見る', href: '/investigations/ranking', primary: true },
                  { label: '検索式を見る', href: '/investigations/queries' },
                  { label: '調査レポート', href: '/reports?kind=prior-art' }
                ]
              }}
            >
              <Tag tone={st.tone} style={{ flex: 'none', marginTop: 2 }}>{st.label}</Tag>
              <div className="row-main">
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.6 }}>{r.title}</div>
                <div className="row-sub" style={{ marginTop: 3 }}>
                  検索式 <span className="mono">{r.query}</span>
                </div>
              </div>
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <span className="badge tag-green mono">根拠 {evidence}件</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>担当 {owner} ・ {ymd(r.createdAt)}</span>
              </div>
            </DetailRow>
          );
        })}
      </div>

      <Notice>
        AI調査の直後には必ず人の確認ステップが入ります。根拠が1件も付かないAI実行は保存されません。
      </Notice>
    </div>
  );
}

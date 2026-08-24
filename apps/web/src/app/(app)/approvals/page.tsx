import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { FilterChips, Notice, Tag } from '@/components/ui';
import { DetailChip } from '@/components/detail/DetailOpener';
import { CLASSIFICATION, WORKFLOW_KIND, WORKFLOW_STATUS } from '@/lib/labels';

export const runtime = 'edge';

// 設計案（design-B-copilot）の「承認・レビュー」。
//
// 設計案では行クリックで詳細ドロワーを開き、その中に承認／差戻／保留のボタンがあったが、
// 実装では行から承認詳細ページ（/approvals/<id>）へ遷移させている。承認操作には
// 自己承認の禁止・人間確認事項の完了チェック・履歴の記録といったサーバ側の実処理があり、
// ドロワー内のダミーボタンに置き換えるとその実装を失うため。
// 一覧上で中身だけ確認したい場合のために、各行に「概要」のドロワーを併置している。

type Row = {
  id: string; kind: string; title: string; status: string; classification: string;
  due_on: string | null; author: string; human_check_required: boolean; human_check_completed_at: string | null;
};

const ACTIVE_STATUSES = ['draft', 'researching', 'ai_reviewed', 'technical_review', 'ip_review', 'legal_review', 'hold'];

/** 絞り込みキー → 対象ステータス。'mine'/'pending' は「まだ決着していない案件」。 */
function statusesFor(filter: string): string[] {
  if (filter === 'mine' || filter === 'pending') return ACTIVE_STATUSES;
  if (filter in WORKFLOW_STATUS) return [filter];
  return ACTIVE_STATUSES;
}

export default async function ApprovalsPage({ searchParams }: { searchParams: { filter?: string } }) {
  const filter = searchParams.filter ?? 'mine';
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select wi.id::text as id, wi.kind, wi.title, wi.status, wi.classification,
           wi.due_on::text as due_on, u.display_name as author,
           wi.human_check_required, wi.human_check_completed_at::text as human_check_completed_at
    from workflow_instances wi join users u on u.id = wi.author_id
    order by wi.due_on nulls last, wi.created_at desc
  `);
  const all = result.rows as Row[];

  const countFor = (key: string) => {
    const target = statusesFor(key);
    return all.filter(r => target.includes(r.status)).length;
  };

  const target = statusesFor(filter);
  const rows = all.filter(r => target.includes(r.status));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FilterChips
        basePath="/approvals"
        param="filter"
        current={filter}
        chips={[
          { key: 'mine', label: 'マイタスク', count: countFor('mine') },
          { key: 'technical_review', label: '技術レビュー', count: countFor('technical_review') },
          { key: 'ip_review', label: '知財レビュー', count: countFor('ip_review') },
          { key: 'legal_review', label: '法務レビュー', count: countFor('legal_review') },
          { key: 'approved', label: '承認済', count: countFor('approved') },
          { key: 'archived', label: 'アーカイブ', count: countFor('archived') }
        ]}
      />

      <div className="panel row-list" style={{ overflow: 'hidden' }}>
        {rows.length === 0 && (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>該当する案件はありません。</div>
        )}
        {rows.map(w => {
          const kind = WORKFLOW_KIND[w.kind] ?? { label: w.kind, tone: 'gray' as const };
          const status = WORKFLOW_STATUS[w.status] ?? { label: w.status, tone: 'gray' as const };
          const overdue = !!w.due_on && w.due_on < today;
          const humanBlocked = w.human_check_required && !w.human_check_completed_at;

          return (
            <div key={w.id} className="row">
              <Tag tone={kind.tone} style={{ flex: 'none' }}>{kind.label}</Tag>
              <div className="row-main">
                {/* 承認操作は案件ページ側にあるため、行の見出しはそこへのリンクにする。 */}
                <Link href={`/approvals/${w.id}`} className="row-title" style={{ color: 'var(--ink)', display: 'block' }}>
                  {w.title}
                </Link>
                <div className="row-sub">
                  起案 {w.author} ・ 段階 {status.label} ・ 機密区分 {w.classification}
                  {humanBlocked && ' ・ 人間確認 未完了'}
                </div>
              </div>
              <Tag tone={CLASSIFICATION[w.classification] ?? 'gray'} style={{ flex: 'none' }}>
                <span className="mono">{w.classification}</span>
              </Tag>
              <span className="mono" style={{ fontSize: 12, color: overdue ? 'var(--brick)' : 'var(--ink-2)', flex: 'none' }}>
                {w.due_on ? (overdue ? `${w.due_on} 超過` : `期限 ${w.due_on}`) : '期限なし'}
              </span>
              <DetailChip
                className="btn btn-secondary"
                style={{ flex: 'none' }}
                detail={{
                  title: w.title,
                  tag: status.label,
                  tone: status.tone,
                  meta: [
                    { k: '種別', v: kind.label },
                    { k: '起案', v: w.author },
                    { k: '段階', v: status.label },
                    { k: '機密区分', v: w.classification },
                    { k: '期限', v: w.due_on ? `${w.due_on}${overdue ? '（超過）' : ''}` : '—' },
                    { k: '人間確認', v: w.human_check_required ? (humanBlocked ? '未完了' : '完了') : '不要' }
                  ],
                  body: humanBlocked
                    ? 'この案件はAIステップの後の人間確認事項が未完了です。確認を記録するまで承認へ進めません。'
                    : 'ワークフローのAIステップの直後には、必ず人の確認ステップが入ります。AIから直接「決定」へ進む道はありません。',
                  note: '承認・差戻・保留の操作は案件ページで行います（自己承認は禁止され、操作はすべて監査ログに残ります）。',
                  actions: [
                    { label: '案件を開いて承認する', href: `/approvals/${w.id}`, primary: true },
                    { label: '承認履歴を見る', href: '/workflow/history' }
                  ]
                }}
              >
                概要
              </DetailChip>
              <Link href={`/approvals/${w.id}`} className="btn btn-ghost" style={{ flex: 'none' }}>開く</Link>
            </div>
          );
        })}
      </div>

      <Notice>
        ワークフローのAIステップの直後には、必ず人の確認ステップが入ります。AIから直接「決定」へ進む道はありません。
      </Notice>
    </div>
  );
}

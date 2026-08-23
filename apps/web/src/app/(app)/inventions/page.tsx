import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray, sql } from 'drizzle-orm';
import { Notice, Tag } from '@/components/ui';
import { DetailChip, DetailTr } from '@/components/detail/DetailOpener';
import { CLASSIFICATION, WORKFLOW_STATUS, ymd } from '@/lib/labels';

export const runtime = 'edge';

// 設計案（design-B-copilot）の「発明・出願」。
// 現場の工夫を発明として蓄え、出願するかは人が決める。表の行から詳細ドロワーを開く。

type WfRow = { subject_id: string; status: string; due_on: string | null };
type ExamRow = { target_id: string; runs: number; citations: number };

export default async function InventionsPage() {
  const db = getDb(getDatabaseUrl());
  const inventions = await db.select().from(s.inventions).orderBy(desc(s.inventions.createdAt));

  const userIds = [...new Set(inventions.map(i => i.submittedBy))];
  const users = userIds.length ? await db.select().from(s.users).where(inArray(s.users.id, userIds)) : [];
  const userById = new Map(users.map(u => [u.id, u]));

  const siteIds = [...new Set(inventions.map(i => i.siteId).filter((v): v is string => !!v))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];
  const siteById = new Map(sites.map(sv => [sv.id, sv]));

  // 段階はワークフロー案件（subject_type = 'invention'）から引く。
  const wf = await db.execute(sql`
    select subject_id::text as subject_id, status, due_on::text as due_on
    from workflow_instances where subject_type = 'invention'
  `);
  const wfBySubject = new Map((wf.rows as WfRow[]).map(w => [w.subject_id, w]));

  // AI模擬審査の実行と根拠件数。
  const exams = await db.execute(sql`
    select r.target_id::text as target_id, count(distinct r.id)::int as runs, count(c.id)::int as citations
    from ai_runs r left join ai_citations c on c.ai_run_id = r.id
    where r.target_type = 'invention' and r.kind = 'examine'
    group by r.target_id
  `);
  const examByTarget = new Map((exams.rows as ExamRow[]).map(e => [e.target_id, e]));

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="notice notice-brick" style={{ flex: 1, minWidth: 320 }}>
          <strong>出願前の発明は最高レベルの機密（C4）です。</strong>関係者以外には、存在すること自体が見えません。
        </div>
        <DetailChip
          className="btn btn-primary"
          style={{ flex: 'none' }}
          detail={{
            title: '現場の工夫を書き込む',
            tag: '発明届',
            tone: 'purple',
            form: [
              { label: '現場', placeholder: '例: 新潟東港 防波堤改良工事' },
              {
                label: '工夫の内容（普通の文章でOK・1分で終わります）',
                textarea: true,
                placeholder: '例: ケーソンの据付時、カメラ映像にAIで目標位置を重ねて表示する治具を作った'
              }
            ],
            body: '必須はこの2つだけ。写真も添付できます。分類・整理と類似特許の確認はAIが行います。',
            note: '書き込んだ内容はC4機密として扱われ、関係者以外には存在自体が見えません。',
            actions: [
              { label: '現場から登録する', href: '/sites', primary: true },
              { label: 'キャンセル' }
            ]
          }}
        >
          ＋ 現場の工夫を書き込む
        </DetailChip>
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        {inventions.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>発明届はまだありません。</div>
        ) : (
          <table className="plain">
            <thead>
              <tr><th>発明名</th><th>発明者</th><th>段階</th><th>機密区分</th><th>AI模擬審査</th><th>登録</th></tr>
            </thead>
            <tbody>
              {inventions.map(inv => {
                const inventor = userById.get(inv.submittedBy)?.displayName ?? '—';
                const w = wfBySubject.get(inv.id);
                const stage = w ? (WORKFLOW_STATUS[w.status] ?? { label: w.status, tone: 'gray' as const }) : { label: '下書き', tone: 'gray' as const };
                const exam = examByTarget.get(inv.id);
                const examLabel = exam && exam.runs > 0 ? `実行済 ・ 根拠${exam.citations}件` : '未実行';
                const site = inv.siteId ? siteById.get(inv.siteId) : undefined;

                return (
                  <DetailTr
                    key={inv.id}
                    detail={{
                      title: inv.title,
                      tag: `${inv.classification} 機密`,
                      tone: CLASSIFICATION[inv.classification] ?? 'gray',
                      meta: [
                        { k: '発明者', v: inventor },
                        { k: '現場', v: site?.name ?? '—' },
                        { k: '段階', v: `${stage.label}${w?.due_on ? `（期限 ${w.due_on}）` : ''}` },
                        { k: '機密区分', v: inv.classification },
                        { k: 'AI模擬審査', v: examLabel },
                        { k: '登録', v: ymd(inv.createdAt) }
                      ],
                      body: inv.summary
                        ?? 'AI模擬審査は参考情報です。出願するかを決めるのは技術部門・知財部門・経営です。',
                      note: '出願するかを決めるのは技術部門・知財部門・経営です。AIは決めません。',
                      actions: [
                        { label: '発明届を開く', href: `/inventions/${inv.id}`, primary: true },
                        ...(w ? [{ label: 'レビューを開く', href: '/approvals' }] : []),
                        { label: 'AI模擬審査を見る', href: '/examiner' }
                      ]
                    }}
                  >
                    <td style={{ fontWeight: 500 }}>{inv.title}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{inventor}</td>
                    <td><Tag tone={stage.tone}>{stage.label}</Tag></td>
                    <td>
                      <Tag tone={CLASSIFICATION[inv.classification] ?? 'gray'}>
                        <span className="mono">{inv.classification}</span>
                      </Tag>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-2)' }}>{examLabel}</td>
                    <td className="mono">{ymd(inv.createdAt)}</td>
                  </DetailTr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.8 }}>
        必須入力は「現場」と「工夫の内容（普通の文章）」だけ。分類・整理と類似特許の確認はAIが行い、出願するかを決めるのは技術部門・知財部門・経営です。
      </div>

      <Notice>
        AI模擬審査の拒絶リスク評価は<strong>見る場所を絞るための目印</strong>です。出願可否の判断ではありません。
      </Notice>
    </div>
  );
}

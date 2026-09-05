import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { decideAction, completeHumanCheck } from '../actions';
import { stamp } from '@/lib/labels';
import { canViewRow } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御（詳細・404秘匿）: ワークフロー案件は発明 workflow で C3 になる。
// R ロール以外（engineer/viewer）は自分が起案した案件以外を 404 として存在を見せない。
// 正: docs/10-requirements/05-rbac-matrix.md §4 / docs/30-design/01-detailed-design.md §3.1

export default async function ApprovalDetail({ params }: { params: { id: string } }) {
  const db = getDb(getDatabaseUrl());
  // CodeRabbit指摘: !アサーションだけでは実行時にセッションが失効した場合に
  // TypeErrorで500になり、UIのisSelf判定もundefinedを暗黙にfalse扱いしてしまう
  // （サーバー側decideActionは requireCurrentDbUser で再検証するため実害はないが、
  //  UIとサーバーの判定がずれるのはユーザー体験として好ましくない）。
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [w] = await db.select().from(s.workflowInstances).where(eq(s.workflowInstances.id, params.id)).limit(1);
  if (!w) notFound();
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  if (!me) redirect('/login');
  // #11: C3/C4 案件で権限が無い場合は存在自体を出さず 404（403 にしない）
  const isOwner = me.id === w.authorId;
  if (!canViewRow(user.role, w.classification as 'C1' | 'C2' | 'C3' | 'C4', isOwner)) notFound();
  const [author] = await db.select().from(s.users).where(eq(s.users.id, w.authorId)).limit(1);
  const history = await db.select().from(s.approvals).where(eq(s.approvals.instanceId, w.id)).orderBy(desc(s.approvals.decidedAt));

  const isSelf = me.id === w.authorId;
  const humanBlocked = w.humanCheckRequired && !w.humanCheckCompletedAt;
  const canDecide = !isSelf;
  const canApprove = canDecide && !humanBlocked;

  const risk = w.aiRiskSummary as any;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 20 }}>{w.title}</h1>
        <span className="pill" style={{ color: w.classification === 'C3' ? 'var(--amber)' : 'var(--green)' }}>{w.classification}</span>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>起案 {author?.displayName} ／ 現在 {w.status} ／ 期限 {w.dueOn ?? '—'}</div>

      {risk && (
        <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>AI模擬審査の結果 <span style={{ fontWeight: 400, fontSize: 11.5, color: 'var(--ink-2)' }}>— 判断ではありません</span></div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['novelty', 'inventive', 'description', 'overlap'].map(k => (
              <span key={k} className="badge" style={{
                border: `1px solid ${risk[k] === 'low' ? 'var(--green)' : 'var(--amber)'}`,
                color: risk[k] === 'low' ? 'var(--green)' : 'var(--amber)'
              }}>{k}: {risk[k] === 'low' ? '低リスク' : '中リスク'}</span>
            ))}
          </div>
          {humanBlocked && (
            <div className="notice notice-amber">
              <strong>人間確認事項が未完了です。</strong> {risk.note}
              <form action={completeHumanCheck} style={{ marginLeft: 'auto' }}>
                <input type="hidden" name="instanceId" value={w.id} />
                <button type="submit" className="btn btn-secondary" style={{ height: 28, padding: '0 12px', fontSize: 11.5 }}>確認完了を記録</button>
              </form>
            </div>
          )}
        </div>
      )}

      {isSelf && (
        <div className="notice notice-brick">
          <strong>起案者はご自身の案件を承認できません。</strong> 別の承認者でログインして操作してください（自己承認の禁止）。
        </div>
      )}

      <form action={decideAction} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input type="hidden" name="instanceId" value={w.id} />
        <textarea name="comment" placeholder="コメント（差戻し時は理由を記入）" rows={2}
          style={{ padding: 8, border: '1px solid var(--line)', borderRadius: 3, fontSize: 13, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="submit" name="decision" value="approved" className="btn btn-primary" disabled={!canApprove}>承認</button>
          <button type="submit" name="decision" value="rejected" className="btn btn-ghost" disabled={!canDecide}>差戻し</button>
          <button type="submit" name="decision" value="hold" className="btn btn-ghost" disabled={!canDecide}>保留</button>
        </div>
      </form>

      {history.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontSize: 12, fontWeight: 700 }}>履歴</div>
          <table className="plain">
            <tbody>
              {history.map(h => (
                <tr key={h.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{stamp(h.decidedAt)}</td>
                  <td>{h.decision}</td>
                  <td>{h.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

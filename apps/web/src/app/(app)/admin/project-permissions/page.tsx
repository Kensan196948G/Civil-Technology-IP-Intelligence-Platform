import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql, asc } from 'drizzle-orm';
import * as s from '@/lib/db/schema';
import { ListView } from '@/components/ListView';
import { getCurrentUser } from '@/lib/auth/current-user';
import { stampSec } from '@/lib/labels';
import { grantAccessAction, revokeAccessAction } from './actions';

// #11 C4 個別付与（grant）モデル: docs/10-requirements/05-rbac-matrix.md §4 の
// C4「個別付与された利用者のみ」を運用するための管理画面。
// 一覧は既存どおり全ロール（executive/sysadmin。middleware.ts が /admin/* を許可するロール）に
// 表示するが、付与・取消フォームは sysadmin にのみ表示する（actions.ts 側でも二重に検証する）。

const KIND_LABEL: Record<string, string> = {
  invention: '発明届', field_adoption: '現場導入', license_in: 'ライセンスイン'
};

type ProjectPermRow = {
  id: string;
  title: string;
  kind: string;
  classification: string;
  status: string;
  authorName: string;
  role: string;
  departmentName: string | null;
  humanCheckRequired: boolean;
};

type GrantRow = {
  id: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  userName: string;
  userEmail: string;
  grantedByName: string;
  grantedAt: string;
  note: string | null;
};

export default async function AdminProjectPermissionsPage() {
  const db = getDb(getDatabaseUrl());
  const currentUser = await getCurrentUser();
  const isSysadmin = currentUser?.role === 'sysadmin';

  const result = await db.execute(sql`
    select wi.id, wi.title, wi.kind, wi.classification, wi.status, wi.human_check_required,
           u.display_name as author_name, u.role as role, d.name as department_name
    from workflow_instances wi
    join users u on u.id = wi.author_id
    left join departments d on d.id = u.department_id
    order by wi.created_at desc
  `);
  const rows: ProjectPermRow[] = (result.rows as any[]).map(r => ({
    id: r.id as string,
    title: r.title as string,
    kind: r.kind as string,
    classification: r.classification as string,
    status: r.status as string,
    authorName: r.author_name as string,
    role: r.role as string,
    departmentName: r.department_name as string | null,
    humanCheckRequired: Boolean(r.human_check_required)
  }));

  // 案件選択肢（発明届 workflow は同時に起点 inventions へも grant するため、
  // subject_type='invention' の場合のみ、その旨をラベルに補足する）。
  const instanceOptions = rows.map(r => ({
    id: r.id,
    label: `${KIND_LABEL[r.kind] ?? r.kind}｜${r.title}（${r.classification}・${r.status}）`
  }));

  const allUsers = await db.select({
    id: s.users.id, email: s.users.email, displayName: s.users.displayName, role: s.users.role
  }).from(s.users).orderBy(asc(s.users.displayName));

  // 既存の個別付与一覧（invention / workflow_instance の両対象を横断表示）。
  const grantResult = await db.execute(sql`
    select ag.id, ag.target_type, ag.target_id, ag.note, ag.granted_at,
           gu.display_name as user_name, gu.email as user_email,
           bu.display_name as granted_by_name
    from access_grants ag
    join users gu on gu.id = ag.user_id
    join users bu on bu.id = ag.granted_by
    order by ag.granted_at desc
  `);
  const workflowTitleById = new Map(rows.map(r => [r.id, `${KIND_LABEL[r.kind] ?? r.kind}｜${r.title}`]));
  const inventionRows = await db.select({ id: s.inventions.id, title: s.inventions.title }).from(s.inventions);
  const inventionTitleById = new Map(inventionRows.map(i => [i.id, i.title]));

  const grants: GrantRow[] = (grantResult.rows as any[]).map(g => {
    const targetType = g.target_type as string;
    const targetId = g.target_id as string;
    const targetLabel = targetType === 'invention'
      ? (inventionTitleById.get(targetId) ?? `発明届（${targetId}）`)
      : (workflowTitleById.get(targetId) ?? `案件（${targetId}）`);
    return {
      id: g.id as string,
      targetType,
      targetId,
      targetLabel,
      userName: g.user_name as string,
      userEmail: g.user_email as string,
      grantedByName: g.granted_by_name as string,
      grantedAt: g.granted_at as string,
      note: g.note as string | null
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ListView
        title="プロジェクト権限"
        moduleCode="S-19 / SYSTEM ADMIN"
        description="案件（プロジェクト）ごとの起案者権限と必要な機密区分です。起案者がその案件の編集権限を持ちます。行をクリックすると案件詳細（承認）画面に遷移します。"
        rows={rows}
        emptyMessage="登録済みの案件はありません。"
        rowHref={row => `/approvals/${row.id}`}
        fields={[
          { key: 'kind', mono: true, render: row => KIND_LABEL[row.kind] ?? row.kind },
          { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
          { key: 'owner', render: row => `起案 ${row.authorName}（${row.departmentName ?? '所属不明'}）` },
          { key: 'classification', render: row => (
            <span className="badge" style={{ color: row.classification === 'C3' || row.classification === 'C4' ? 'var(--amber)' : 'var(--green)', border: `1px solid ${row.classification === 'C3' || row.classification === 'C4' ? 'var(--amber)' : 'var(--green)'}` }}>{row.classification}</span>
          ) },
          { key: 'humanCheck', render: row => row.humanCheckRequired
            ? <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>人間確認必須</span>
            : null
          }
        ]}
      />

      <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h2 style={{ fontSize: 15 }}>個別アクセス権の付与（C4 grant）</h2>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-2)' }}>RBAC §4 MUST</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          C4（最高機密）は個別に付与された利用者のみ閲覧できます。ここで案件に対して利用者を個別指定すると、
          発明届の場合はその発明本体（inventions）にも同時に付与されます。付与・取消は sysadmin のみ実行できます。
        </p>

        {isSysadmin ? (
          <form action={grantAccessAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 280px' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>対象案件<span style={{ color: 'var(--brick)' }}> *</span></span>
              <select name="instanceId" required
                style={{ height: 34, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13 }}>
                {instanceOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>付与する利用者<span style={{ color: 'var(--brick)' }}> *</span></span>
              <select name="userEmail" required
                style={{ height: 34, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13 }}>
                {allUsers.map(u => <option key={u.id} value={u.email}>{u.displayName}（{u.role}）</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 200px' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700 }}>備考（任意）</span>
              <input name="note" placeholder="例: 係争対応のため経営層のみ閲覧"
                style={{ height: 34, padding: '0 8px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13 }} />
            </label>
            <button type="submit" className="btn btn-primary" style={{ height: 34 }}>付与する</button>
          </form>
        ) : (
          <div className="notice notice-amber" style={{ fontSize: 12 }}>
            付与・取消は sysadmin ロールのみ実行できます（現在のロール: {currentUser?.role ?? '—'}）。
          </div>
        )}

        {grants.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>個別付与はまだありません。</div>
        ) : (
          <table className="plain">
            <thead>
              <tr>
                <th>対象</th><th>案件・発明</th><th>付与先</th><th>付与者</th><th>付与日時</th><th>備考</th>
                {isSysadmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {grants.map(g => (
                <tr key={g.id}>
                  <td className="mono" style={{ fontSize: 11 }}>{g.targetType === 'invention' ? '発明' : '案件'}</td>
                  <td>{g.targetLabel}</td>
                  <td>{g.userName}（{g.userEmail}）</td>
                  <td>{g.grantedByName}</td>
                  <td className="mono" style={{ fontSize: 11 }}>{stampSec(new Date(g.grantedAt))}</td>
                  <td style={{ color: 'var(--ink-2)' }}>{g.note ?? '—'}</td>
                  {isSysadmin && (
                    <td>
                      <form action={revokeAccessAction}>
                        <input type="hidden" name="grantId" value={g.id} />
                        <button type="submit" className="btn btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 11.5 }}>取消</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

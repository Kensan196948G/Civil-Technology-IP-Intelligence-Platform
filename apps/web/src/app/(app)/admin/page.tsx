import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, sql } from 'drizzle-orm';
import Link from 'next/link';
import { Panel, Tag } from '@/components/ui';
import { DetailTr } from '@/components/detail/DetailOpener';
import { ROLE_LABEL, type DemoRole } from '@/lib/auth/demo';
import { stamp } from '@/lib/labels';


// 設計案（design-B-copilot）の「システム管理」。
// 旧UIには /admin の入口ページが無く、配下の個別ページ（users / roles / status …）しか
// 無かったため、設計案どおりの概要画面として新規に追加した。
// RBACは (app)/admin/layout.tsx と middleware.ts で executive / sysadmin に限定済み。

const ROLE_TONE: Record<DemoRole, 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray'> = {
  engineer: 'blue', tech_manager: 'blue', rnd: 'amber', ip: 'purple',
  legal: 'purple', executive: 'red', sysadmin: 'green', viewer: 'gray'
};

const SETTINGS_GROUPS = [
  { label: 'AIモデル設定', href: '/admin/settings?group=ai-model' },
  { label: 'Agent設定', href: '/admin/settings?group=agent' },
  { label: 'API設定', href: '/admin/settings?group=api' },
  { label: '外部データ連携', href: '/admin/settings?group=integration' },
  { label: '通知設定', href: '/admin/settings?group=notification' },
  { label: 'ワークフロー設定', href: '/admin/settings?group=workflow' },
  { label: 'マスタ設定', href: '/admin/settings?group=master' },
  { label: 'Feature Flags', href: '/admin/feature-flags' }
];

export default async function AdminHomePage() {
  const db = getDb(getDatabaseUrl());

  const [users, departments, health] = await Promise.all([
    db.select().from(s.users).orderBy(asc(s.users.displayName)),
    db.select().from(s.departments),
    db.execute(sql`
      select
        (select count(*) from ai_runs) as ai_runs,
        (select count(*) from ai_runs r
           where r.status = 'succeeded'
             and not exists (select 1 from ai_citations c where c.ai_run_id = r.id)) as runs_without_citations,
        (select count(*) from feature_flags where enabled) as flags_on,
        (select count(*) from feature_flags) as flags_total,
        (select max(occurred_at)::text from audit_logs) as last_audit
    `)
  ]);

  const deptById = new Map(departments.map(d => [d.id, d]));
  const h = (health.rows[0] ?? {}) as Record<string, unknown>;
  const runsWithoutCitations = Number(h.runs_without_citations ?? 0);

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel
          title="ユーザー・ロール"
          action={<Link href="/admin/users" className="btn btn-secondary">ユーザー管理へ</Link>}
          bodyPadding={false}
        >
          <table className="plain">
            <thead>
              <tr><th>氏名</th><th>部署</th><th>ロール</th><th>状態</th></tr>
            </thead>
            <tbody>
              {users.map(u => {
                const dept = u.departmentId ? deptById.get(u.departmentId) : undefined;
                const role = u.role as DemoRole;
                return (
                  <DetailTr
                    key={u.id}
                    detail={{
                      title: u.displayName,
                      tag: ROLE_LABEL[role] ?? u.role,
                      tone: ROLE_TONE[role] ?? 'gray',
                      meta: [
                        { k: '部署', v: dept ? `${dept.code} ${dept.name}` : '—' },
                        { k: 'ロール', v: ROLE_LABEL[role] ?? u.role },
                        { k: 'メール', v: u.email },
                        { k: '状態', v: u.isActive ? '有効' : '無効' }
                      ],
                      body: '権限のないモジュールは項目自体が表示されません。行レベル権限（C3/C4）はプロジェクト単位で付与します。'
                        + '本番ではIdP（SSO）と連携し、ロールはグループから自動付与されます。',
                      actions: [
                        { label: 'ロール・権限を見る', href: '/admin/roles', primary: true },
                        { label: 'プロジェクト権限', href: '/admin/project-permissions' },
                        { label: '監査ログを見る', href: '/audit?action=role_change' }
                      ]
                    }}
                  >
                    <td style={{ fontWeight: 500 }}>{u.displayName}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{dept ? `${dept.code} ${dept.name}` : '—'}</td>
                    <td><Tag tone={ROLE_TONE[role] ?? 'gray'}>{ROLE_LABEL[role] ?? u.role}</Tag></td>
                    <td><Tag tone={u.isActive ? 'green' : 'gray'}>{u.isActive ? '有効' : '無効'}</Tag></td>
                  </DetailTr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Panel title="システム状態" bodyPadding={false}>
            <div style={{ padding: '6px 0' }}>
              <StatusLine label="Web（Cloudflare Pages）" ok />
              <StatusLine label="データベース（Neon）" ok />
              <StatusLine label="AI実行（Claude API）" ok />
              <div style={{ padding: '10px 18px' }}>
                <Link href="/admin/status" style={{ fontSize: 12 }}>詳細な稼働状況を見る →</Link>
              </div>
            </div>
          </Panel>

          <Panel title="日次チェック（Runbook）" bodyPadding={false}>
            <div style={{ padding: '6px 0' }}>
              <CheckLine
                label="根拠なし成功実行"
                value={`${runsWithoutCitations} 件`}
                tone={runsWithoutCitations === 0 ? 'green' : 'red'}
              />
              <CheckLine label="AI実行（累計）" value={`${Number(h.ai_runs ?? 0)} 件`} />
              <CheckLine label="Feature Flags 有効" value={`${Number(h.flags_on ?? 0)} / ${Number(h.flags_total ?? 0)}`} />
              <CheckLine label="最終監査ログ" value={stamp(h.last_audit) || '—'} />
            </div>
            {runsWithoutCitations > 0 && (
              <div style={{ padding: '0 18px 14px' }}>
                <div className="notice notice-brick">
                  根拠が1件も付かない成功実行が残っています。invalid として扱い、原因を調査してください。
                </div>
              </div>
            )}
          </Panel>

          <Panel title="設定">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SETTINGS_GROUPS.map(g => (
                <Link
                  key={g.href}
                  href={g.href}
                  style={{
                    fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 6,
                    border: '1px solid var(--line-2)', background: 'var(--sunk)', color: 'var(--ink-2)', textDecoration: 'none'
                  }}
                >
                  {g.label}
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function StatusLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px' }}>
      <span className="dot" style={{ background: ok ? 'var(--green-dot)' : 'var(--accent)' }} aria-hidden="true" />
      <span style={{ fontSize: 12.5, flex: 1 }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color: ok ? 'var(--green)' : 'var(--amber)' }}>{ok ? '正常' : '要調査'}</span>
    </div>
  );
}

function CheckLine({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  const color = tone === 'green' ? 'var(--green)' : tone === 'red' ? 'var(--brick)' : 'var(--ink-2)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px' }}>
      <span style={{ fontSize: 12.5, flex: 1 }}>{label}</span>
      <span className="mono" style={{ fontSize: 11, color }}>{value}</span>
    </div>
  );
}

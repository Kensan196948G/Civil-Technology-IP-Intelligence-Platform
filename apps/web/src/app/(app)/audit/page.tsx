import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Notice, Tag } from '@/components/ui';
import { DetailTr } from '@/components/detail/DetailOpener';
import { AUDIT_ACTION, stamp } from '@/lib/labels';


// 設計案（design-B-copilot）の「セキュリティ・監査」。
// 操作種別のチップ（nav.ts の ?action= と同じ）＋監査ログの表。行から詳細ドロワー。

const ACTION_CHIPS = ['login', 'ai_run', 'search', 'view', 'export', 'update', 'role_change', 'security_event'] as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string }> })
{
  // Next.js 15: searchParams は Promise になったため await する
  const sp = await searchParams;
  const db = getDb(getDatabaseUrl());
  const action = sp.action;
  const base = db.select().from(s.auditLogs);
  const rows = await (action ? base.where(eq(s.auditLogs.action, action)) : base)
    .orderBy(desc(s.auditLogs.occurredAt))
    .limit(200);

  const actorIds = [...new Set(rows.map(r => r.actorUserId).filter((v): v is string => !!v))];
  const actors = actorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, actorIds)) : [];
  const actorById = new Map(actors.map(a => [a.id, a]));

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/audit" className={`chip${action ? '' : ' active'}`}>すべて</Link>
        {ACTION_CHIPS.map(a => (
          <Link key={a} href={`/audit?action=${a}`} className={`chip${action === a ? ' active' : ''}`}>
            {AUDIT_ACTION[a]?.label ?? a}
          </Link>
        ))}
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>該当する監査ログはありません。</div>
        ) : (
          <table className="plain">
            <thead>
              <tr><th>日時</th><th>操作</th><th>ユーザー</th><th>対象</th><th>結果</th></tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const meta = AUDIT_ACTION[r.action] ?? { label: r.action, tone: 'gray' as const };
                const actor = r.actorUserId ? (actorById.get(r.actorUserId)?.displayName ?? '—') : '—';
                const success = r.result === 'success';
                const target = [r.targetType, r.targetId ? r.targetId.slice(0, 8) : null].filter(Boolean).join(' / ') || '—';

                return (
                  <DetailTr
                    key={r.id}
                    detail={{
                      title: `${meta.label} — ${stamp(r.occurredAt)}`,
                      tag: meta.label,
                      tone: meta.tone,
                      meta: [
                        { k: '日時', v: stamp(r.occurredAt) },
                        { k: 'ユーザー', v: actor },
                        { k: '対象', v: target },
                        { k: '結果', v: r.result },
                        ...(r.reason ? [{ k: '理由', v: r.reason }] : [])
                      ],
                      body: '監査ログは追記専用です。UPDATE・DELETEはデータベース権限のレベルで禁止されています。'
                        + 'C3/C4のデータは権限がない場合、403ではなく404を返し、存在自体を表示しません。',
                      note: '原文の閲覧・Exportを含め、拒否された操作も記録されます。',
                      actions: [
                        { label: 'AI利用履歴を見る', href: '/audit?action=ai_run', primary: true },
                        { label: '権限設定を見る', href: '/admin/roles' }
                      ]
                    }}
                  >
                    <td className="mono" style={{ fontSize: 11.5 }}>{stamp(r.occurredAt)}</td>
                    <td><Tag tone={meta.tone}><span className="mono">{meta.label}</span></Tag></td>
                    <td style={{ color: 'var(--ink-2)' }}>{actor}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>{target}</td>
                    <td><Tag tone={success ? 'green' : 'red'}>{success ? '成功' : r.result}</Tag></td>
                  </DetailTr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Notice>
        監査ログは<strong>追記専用</strong>です。UPDATE・DELETEはデータベース権限のレベルで禁止されています。
        C3/C4のデータは権限がない場合、存在自体を表示しません（404）。
      </Notice>
    </div>
  );
}

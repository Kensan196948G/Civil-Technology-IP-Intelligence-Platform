import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth/current-user';
import { submitSiteIssue } from '../../actions';
import { notFound } from 'next/navigation';

export const runtime = 'edge';

export default async function SiteIssuePage({ params }: { params: { id: string } }) {
  const db = getDb(getDatabaseUrl());
  const user = getCurrentUser()!;
  const [site] = await db.select().from(s.sites).where(eq(s.sites.id, params.id)).limit(1);
  if (!site) notFound();
  const issues = await db.select().from(s.siteIssues).where(eq(s.siteIssues.siteId, params.id)).orderBy(desc(s.siteIssues.createdAt));

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="mobile-shell card" style={{ padding: 0 }}>
        <div className="topbar" style={{ borderRadius: '3px 3px 0 0' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>現場の困りごと</span>
          <span style={{ flexGrow: 1 }} />
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: '.14em', color: '#63C2E0' }}>CTIIP</span>
        </div>
        <div className="mvp-banner" style={{ fontSize: 11.5 }}><strong>MVP環境</strong> — サンプルです</div>

        <div style={{ padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.5 }}>困っていることを、そのまま書いてください</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>現場：<strong>{site.name}</strong></div>
          </div>

          <form action={submitSiteIssue} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="hidden" name="siteId" value={site.id} />
            <input type="hidden" name="userEmail" value={user.email} />
            <textarea name="body" required rows={5}
              placeholder="例：波が高い日にケーソンの据付がなかなか決まらない…"
              style={{ padding: 12, border: '1px solid var(--blue)', borderRadius: 3, fontSize: 14.5, fontFamily: 'inherit', resize: 'vertical' }} />
            <button type="submit" className="btn btn-primary" style={{ height: 48, fontSize: 15 }}>この内容で送る</button>
            <div style={{ fontSize: 11, color: 'var(--ink-2)', textAlign: 'center' }}>送信は1分以内で終わることを目標にしています</div>
          </form>

          {issues.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>これまでの登録（{issues.length}件）</div>
              {issues.map(i => (
                <div key={i.id} className="card" style={{ padding: 10, fontSize: 12.5 }}>
                  {i.body}
                  <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 4 }}>{String(i.createdAt).slice(0, 16)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

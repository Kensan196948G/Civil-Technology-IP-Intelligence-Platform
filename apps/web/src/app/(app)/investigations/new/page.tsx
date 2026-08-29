import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { createInvestigation } from '../actions';


export default async function NewInvestigationPage() {
  const db = getDb(getDatabaseUrl());
  const recent = await db.select().from(s.investigations).orderBy(desc(s.investigations.createdAt)).limit(5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>新規調査</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-04 / PRIOR ART INVESTIGATION</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        先行技術調査の案件を新規登録します。調査タイトルと検索式（キーワード）を入力してください。
      </p>

      <form action={createInvestigation} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          調査タイトル
          <input name="title" required placeholder="例：港湾ケーソン据付自動化の先行技術調査"
            style={{ height: 34, border: '1px solid var(--line)', borderRadius: 3, padding: '0 8px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          検索式（キーワード）
          <input name="query" required placeholder="例：ケーソン 据付 自動化" className="mono"
            style={{ height: 34, border: '1px solid var(--line)', borderRadius: 3, padding: '0 8px' }} />
        </label>
        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>調査案件を登録</button>
      </form>

      <div className="notice notice-blue" style={{ fontSize: 12 }}>
        MVPでは調査案件の登録・一覧のみ行います（特許庁DB・論文DB・NETIS等の外部横断検索の自動実行は本番設計で実装予定のバックログです）。
      </div>

      {recent.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>直近の登録（{recent.length}件）</div>
          {recent.map(r => (
            <div key={r.id} className="card" style={{ padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700, flexGrow: 1 }}>{r.title}</span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{r.query}</span>
              <span className="badge" style={{ color: r.status === 'open' ? 'var(--blue)' : 'var(--ink-2)', border: `1px solid ${r.status === 'open' ? 'var(--blue)' : 'var(--line)'}` }}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

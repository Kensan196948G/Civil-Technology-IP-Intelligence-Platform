export const runtime = 'edge';
import { DEMO_USERS, ROLE_LABEL } from '@/lib/auth/demo';
import { loginAsAction } from './actions';

// Cloudflare Pages上では静的プリレンダーされたページにはWorker関数が
// 割り当てられず、同一パスへのServer Action POSTが405になる
// （next start ローカル/CI環境では発生しないため見過ごされていた）。
// 動的レンダリングを強制してPOSTを受けられるようにする。
export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
      <div className="card" style={{ width: 480, padding: '28px 30px' }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: 'var(--ink-2)', marginBottom: 6 }}>
          CTIIP MVP — デモログイン
        </div>
        <h1 style={{ fontSize: 20, marginBottom: 6 }}>誰として操作しますか</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 0, marginBottom: 18, lineHeight: 1.8 }}>
          本番はCloudflare Access（SSO＋多要素認証）を使用します。
          このMVPでは架空のデモ利用者からロールを選び、権限による画面差を確認できます。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {DEMO_USERS.map(u => (
            <form key={u.email} action={loginAsAction}>
              <input type="hidden" name="email" value={u.email} />
              <button type="submit" className="btn btn-ghost" style={{ width: '100%', justifyContent: 'space-between' }}>
                <span>{u.name}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--blue)' }}>{ROLE_LABEL[u.role]}</span>
              </button>
            </form>
          ))}
        </div>
        <div className="notice notice-amber" style={{ marginTop: 18, fontSize: 11.5 }}>
          全員デモ用の架空人物です。実在の人物・企業とは関係ありません。
        </div>
      </div>
    </div>
  );
}

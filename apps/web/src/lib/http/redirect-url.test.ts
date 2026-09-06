import { describe, it, expect } from 'vitest';
import { buildRedirectUrl } from './redirect-url';

// Cloudflare Tunnel経由（`next start -H 127.0.0.1 -p <port>`）だと req.url が
// トンネルの接続先（127.0.0.1:<port>）を反映してしまい、素の
// `new URL(path, req.url)` では到達不能なLocationヘッダーになる不具合の回帰テスト。
// x-forwarded-host / x-forwarded-proto から実際の公開ホスト名を組み立てられることを確認する。
describe('buildRedirectUrl', () => {
  it('x-forwarded-host / x-forwarded-proto があれば公開ホスト名でURLを組み立てる', () => {
    const headers = new Headers({
      host: '127.0.0.1:18940', 'x-forwarded-host': 'ctip.mirai-dx-platform.com', 'x-forwarded-proto': 'https'
    });
    expect(buildRedirectUrl(headers, '127.0.0.1:18940', '/login')).toBe('https://ctip.mirai-dx-platform.com/login');
  });

  it('x-forwarded-proto が無い場合、ホストがlocalhost/127.系ならhttpにフォールバックする', () => {
    const headers = new Headers({ host: '127.0.0.1:18940' });
    expect(buildRedirectUrl(headers, '127.0.0.1:18940', '/not-found')).toBe('http://127.0.0.1:18940/not-found');
  });

  it('x-forwarded-proto が無く公開ホストの場合はhttpsにフォールバックする', () => {
    const headers = new Headers({ host: 'ctip.mirai-dx-platform.com' });
    expect(buildRedirectUrl(headers, 'ctip.mirai-dx-platform.com', '/login')).toBe('https://ctip.mirai-dx-platform.com/login');
  });

  it('ヘッダーが無い場合はnextUrlHostにフォールバックする', () => {
    const headers = new Headers();
    expect(buildRedirectUrl(headers, 'ctiip-mvp.mirai-dx-platform.com', '/dashboard')).toBe('https://ctiip-mvp.mirai-dx-platform.com/dashboard');
  });
});

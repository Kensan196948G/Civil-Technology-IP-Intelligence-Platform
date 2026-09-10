// セキュリティヘッダの回帰テスト。
//
// Deep Debug (2026-09-10): middleware が付与していたのは3ヘッダのみで、
// HSTS と Permissions-Policy が欠けていた（実測）。再発防止のため固定する。
import { describe, expect, it } from 'vitest';
import { HSTS_MAX_AGE_SECONDS, PERMISSIONS_POLICY, securityHeaders } from './security-headers';

describe('securityHeaders', () => {
  it('常に付与する基本ヘッダ（既存3つ＋Permissions-Policy）', () => {
    const headers = securityHeaders({ isHttps: true });

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Permissions-Policy']).toBe(PERMISSIONS_POLICY);
  });

  it('HTTPS のときだけ HSTS を付与する', () => {
    expect(securityHeaders({ isHttps: true })['Strict-Transport-Security']).toBe(
      `max-age=${HSTS_MAX_AGE_SECONDS}`
    );
    // HTTP（ローカル開発等）では付与しない
    expect(securityHeaders({ isHttps: false })['Strict-Transport-Security']).toBeUndefined();
  });

  it('Permissions-Policy で未使用のブラウザ機能を無効化している', () => {
    // 本アプリはカメラ・マイク・位置情報・決済・USB を使用しない（src 全体を grep して確認済み）
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
      expect(PERMISSIONS_POLICY).toContain(`${feature}=()`);
    }
  });

  it('HSTS の max-age は段階導入のため短期間に留める（復旧不能な設定を避ける）', () => {
    // 1年(31536000)等をいきなり設定しないこと。延長は運用確認後に行う。
    expect(HSTS_MAX_AGE_SECONDS).toBeLessThanOrEqual(604800); // 1週間以下
    expect(HSTS_MAX_AGE_SECONDS).toBeGreaterThan(0);
  });
});

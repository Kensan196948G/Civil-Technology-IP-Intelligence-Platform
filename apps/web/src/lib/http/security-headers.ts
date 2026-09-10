// レスポンスのセキュリティヘッダ（アプリ側で付与する分）。
//
// Deep Debug (2026-09-10) で判明した不足への対応:
//   middleware は X-Content-Type-Options / Referrer-Policy / X-Frame-Options の3つしか
//   付与しておらず、**HSTS** と **Permissions-Policy** が無かった（実測）。
//   アプリはカメラ・マイク・位置情報・決済・USB を一切使用していないため、
//   Permissions-Policy で既定無効化できる（最小権限）。
//
// 設計方針:
//   - 本来 HSTS は Cloudflare（エッジ）側で付与するのが望ましく、そちらが正となる
//     （docs/40-infrastructure/01-cloudflare-setup.md）。アプリ側はその補完であり、
//     Cloudflare 側で設定された場合は同一値となるため競合しない。
//   - HSTS の max-age は**段階導入**とする。いきなり1年等にすると、万一 HTTPS 以外で
//     配信せざるを得ない事態が起きた際にブラウザ側の記憶を戻せず復旧が困難になる。
//     まず短期間で運用し、問題がないことを確認してから延長する。
//   - ヘッダを文字列連結で組み立てる純粋関数にしておく（middleware は
//     `next/server` を値importするためVitestで扱いにくい。既存の buildRedirectUrl と
//     同じ理由でロジックを分離し、テスト可能にしている）。

/** 本アプリが使用しないブラウザ機能を既定で無効化する（最小権限）。 */
export const PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()';

/**
 * HSTS の max-age（秒）。段階導入の第一段として1日。
 * 問題がないことを確認したうえで 1 週間 → 1 か月 → 1 年 と段階的に延長する。
 */
export const HSTS_MAX_AGE_SECONDS = 86400;

export type SecurityHeaderOptions = {
  /** HTTPS で配信された応答かどうか（x-forwarded-proto 等から判定した結果）。 */
  isHttps: boolean;
};

/** アプリ側で付与するセキュリティヘッダを返す。 */
export function securityHeaders({ isHttps }: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': PERMISSIONS_POLICY
  };
  // HSTS は HTTPS の応答にのみ付与する。HTTP で付けてもブラウザは無視するが、
  // ローカル開発の平文配信に紛れ込ませないよう明示的に条件分岐する。
  if (isHttps) {
    headers['Strict-Transport-Security'] = `max-age=${HSTS_MAX_AGE_SECONDS}`;
  }
  return headers;
}

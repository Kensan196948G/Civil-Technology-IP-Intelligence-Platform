// @cloudflare/next-on-pages が参照する CloudflareEnv 型に、
// このアプリで使うバインディング/環境変数を宣言する。
interface CloudflareEnv {
  DATABASE_URL: string;
  CTIIP_DEMO_COOKIE_SECRET: string;
  CTIIP_COOKIE_SECURE: string;
  // AI (Anthropic Claude API) 連携。未設定時はモック（決定論的フォールバック）で動作する。
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
}

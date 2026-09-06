// @cloudflare/next-on-pages が参照する CloudflareEnv 型に、
// このアプリで使うバインディング/環境変数を宣言する。
interface CloudflareEnv {
  DATABASE_URL: string;
  CTIIP_DEMO_COOKIE_SECRET: string;
  CTIIP_COOKIE_SECURE: string;
  // AI (Anthropic Claude API) 連携。未設定時はモック（決定論的フォールバック）で動作する。
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL: string;
  // 意味検索（pgvector, ADR-0003）用の埋め込みAPI（Voyage AI）連携。
  // 未設定時は意味検索レイヤーを無効化する（字句検索・構造検索のみで動作継続）。
  VOYAGE_API_KEY: string;
  VOYAGE_MODEL: string;
}

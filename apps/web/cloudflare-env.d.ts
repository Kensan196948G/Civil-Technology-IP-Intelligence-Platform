// @cloudflare/next-on-pages が参照する CloudflareEnv 型に、
// このアプリで使うバインディング/環境変数を宣言する。
interface CloudflareEnv {
  DATABASE_URL: string;
}

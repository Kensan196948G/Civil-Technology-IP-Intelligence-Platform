import { getRequestContext } from '@cloudflare/next-on-pages';

// Cloudflare Pages/Workers 実行時は process.env ではなく
// リクエストコンテキストの env バインディングから取得する。
// CodeRabbit指摘: Edge RuntimeのESM実行環境では require() が使えないため
// 静的importに変更。またエラーを握りつぶさず、未設定時は明確に失敗させる。
export function getDatabaseUrl(): string {
  const fromProcess = typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined;
  if (fromProcess) return fromProcess;

  let fromBinding: unknown;
  try {
    fromBinding = getRequestContext().env.DATABASE_URL;
  } catch (cause) {
    throw new Error(
      'DATABASE_URL を取得できません（ローカルは .env.local、Cloudflareはシークレットを確認してください）',
      { cause }
    );
  }
  if (typeof fromBinding !== 'string' || fromBinding.length === 0) {
    throw new Error('DATABASE_URL が未設定です（Cloudflareの環境変数/シークレットを確認してください）');
  }
  return fromBinding;
}

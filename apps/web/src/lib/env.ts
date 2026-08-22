// Cloudflare Pages/Workers 実行時は process.env ではなく
// リクエストコンテキストの env バインディングから取得する。
// next-on-pages では getRequestContext().env で参照できる。
export function getDatabaseUrl(): string {
  const fromProcess = typeof process !== 'undefined' ? process.env.DATABASE_URL : undefined;
  if (fromProcess) return fromProcess;
  try {
    const { getRequestContext } = require('@cloudflare/next-on-pages');
    return getRequestContext().env.DATABASE_URL as string;
  } catch {
    throw new Error('DATABASE_URL を取得できません（ローカルは .env.local、Cloudflareはシークレットを確認）');
  }
}

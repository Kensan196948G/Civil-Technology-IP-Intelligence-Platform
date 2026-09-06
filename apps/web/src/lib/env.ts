import { getRequestContext } from '@cloudflare/next-on-pages';

// Cloudflare Pages/Workers 実行時は process.env ではなく
// リクエストコンテキストの env バインディング（Secrets/環境変数）から取得する。
// ローカル/CI（next dev・next start）では process.env、Cloudflare上では
// getRequestContext().env を見る。この2系統の違いに気づかず特定の変数だけ
// process.env のみを見る実装にすると、Cloudflare上でのみ実行時に失敗する
// （実際にMVPデプロイ時、ログイン用の署名鍵がこれで取得できず気づいた）。
function getEnvVar(name: keyof CloudflareEnv & string): string | undefined {
  const fromProcess = typeof process !== 'undefined' ? process.env[name] : undefined;
  if (fromProcess) return fromProcess;
  try {
    const value = getRequestContext().env[name];
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function requireEnvVar(name: keyof CloudflareEnv & string, hint: string): string {
  const value = getEnvVar(name);
  if (!value) {
    throw new Error(`${name} が設定されていません（${hint}）`);
  }
  return value;
}

export function getDatabaseUrl(): string {
  return requireEnvVar('DATABASE_URL', 'ローカルは .env.local、Cloudflareはシークレットを確認してください');
}

export function getDemoCookieSecret(): string {
  return requireEnvVar(
    'CTIIP_DEMO_COOKIE_SECRET',
    'ローカルは .env.local、Cloudflareはシークレットへ、ランダムな文字列を設定してください'
  );
}

export function isCookieSecureEnabled(): boolean {
  return getEnvVar('CTIIP_COOKIE_SECURE') === 'true';
}

// AI (Anthropic Claude API) 連携。requireEnvVar は使わない — 本番APIキーが
// まだ発行されていない前提のため、未設定は正常系として扱い（呼び出し元は
// lib/ai/client.ts のモックフォールバックへ切り替える）、ここでは例外を投げない。
export function getAnthropicApiKey(): string | undefined {
  return getEnvVar('ANTHROPIC_API_KEY');
}

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5';

export function getAnthropicModel(): string {
  return getEnvVar('ANTHROPIC_MODEL') ?? DEFAULT_ANTHROPIC_MODEL;
}

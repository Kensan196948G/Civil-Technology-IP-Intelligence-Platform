// /api/health の回帰テスト。
//
// Deep Debug (2026-09-10): 従来は env が 'mvp' 固定で、本番でも MVP でも同じ値を返していた。
// 「環境の取り違え」と「動作中のコミットが分からない」状態を二度と作らないための回帰防止。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET } from './route';

const MANAGED_KEYS = ['DATABASE_URL', 'CTIIP_ENV', 'CTIIP_COMMIT_SHA'] as const;

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of MANAGED_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe('/api/health', () => {
  it('DATABASE_URL 未設定なら db=unconfigured・status=ok・200 を返す', async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.db).toBe('unconfigured');
    // 環境を推測して嘘の値を返さないこと（旧実装は 'mvp' 固定だった）
    expect(body.env).toBe('unknown');
    expect(body.version).toBeNull();
  });

  it('CTIIP_ENV / CTIIP_COMMIT_SHA をそのまま返す（ハードコードしない）', async () => {
    process.env.CTIIP_ENV = 'production';
    process.env.CTIIP_COMMIT_SHA = '162fe3f';

    const body = await (await GET()).json();

    expect(body.env).toBe('production');
    expect(body.version).toBe('162fe3f');
  });

  it('DBへ到達できない場合は db=error・status=degraded・503 を返す', async () => {
    // 到達不能なポート（接続拒否が即座に返る）を指定する
    process.env.DATABASE_URL = 'postgresql://nobody:nobody@127.0.0.1:1/nothing';

    const res = await GET();
    const body = await res.json();

    expect(body.db).toBe('error');
    expect(body.status).toBe('degraded');
    expect(res.status).toBe(503);
  }, 15000);
});

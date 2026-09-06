import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logAudit, logAuditDenied, auditLogTxnStatement, type AuditLogInput } from './log';

// NFR-L-001（監査ログは改変不可・追記専用、拒否操作を含む完全な記録）に対する
// 単体テスト。DBへは接続せず、drizzle/raw SQLの呼び出し形だけを検証する
// （row-visibility.test.ts と同じ方針: 実際の永続化保証は各画面・Server Action側で担保）。

function createFakeDb() {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values }));
  return { db: { insert } as unknown as Parameters<typeof logAudit>[0], insert, values };
}

const baseEntry: AuditLogInput = {
  actorUserId: 'user-1',
  action: 'update',
  targetType: 'site',
  targetId: 'site-1',
  result: 'success'
};

describe('logAudit', () => {
  it('db.insert(auditLogs).values(...) を1回だけ呼び、必須項目を含む行を書き込む', async () => {
    const { db, insert, values } = createFakeDb();
    await logAudit(db, baseEntry);

    expect(insert).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledTimes(1);
    const row = values.mock.calls[0]![0];
    expect(row).toMatchObject({
      actorUserId: 'user-1',
      action: 'update',
      targetType: 'site',
      targetId: 'site-1',
      result: 'success',
      reason: null,
      meta: {}
    });
    expect(typeof row.id).toBe('string');
    expect(row.id.length).toBeGreaterThan(0);
  });

  it('reason / meta を明示的に渡した場合はそのまま記録する', async () => {
    const { db, values } = createFakeDb();
    await logAudit(db, { ...baseEntry, result: 'denied', reason: 'self_approval_forbidden', meta: { k: 1 } });

    const row = values.mock.calls[0]![0];
    expect(row.result).toBe('denied');
    expect(row.reason).toBe('self_approval_forbidden');
    expect(row.meta).toEqual({ k: 1 });
  });

  it('actorUserId が null（未解決利用者）でも書き込める', async () => {
    const { db, values } = createFakeDb();
    await logAudit(db, { ...baseEntry, actorUserId: null });
    expect(values.mock.calls[0]![0].actorUserId).toBeNull();
  });
});

describe('auditLogTxnStatement', () => {
  it('txn テンプレートタグを1回呼び、result/reason/meta(jsonb文字列化)を含める', () => {
    const txn = vi.fn((_strings: TemplateStringsArray, ...values: unknown[]) => Promise.resolve(values));
    auditLogTxnStatement(txn as never, { ...baseEntry, result: 'denied', reason: 'already_terminal', meta: { status: 'approved' } });

    expect(txn).toHaveBeenCalledTimes(1);
    const values = txn.mock.calls[0]!.slice(1); // [strings, ...values] -> values only
    // id, actorUserId, action, targetType, targetId, result, reason, meta(JSON文字列)
    expect(values).toContain('user-1');
    expect(values).toContain('update');
    expect(values).toContain('site');
    expect(values).toContain('site-1');
    expect(values).toContain('denied');
    expect(values).toContain('already_terminal');
    expect(values).toContain(JSON.stringify({ status: 'approved' }));
  });
});

describe('logAuditDenied', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { errorSpy.mockRestore(); });

  it('result を明示しない場合は denied として記録する', async () => {
    const { db, values } = createFakeDb();
    await logAuditDenied(db, { actorUserId: 'u1', action: 'view', targetType: 'invention', targetId: 'inv-1', reason: 'row_visibility_denied' });

    expect(values.mock.calls[0]![0].result).toBe('denied');
  });

  it('db が null/undefined の場合は何もせず正常終了する（呼び出し元の処理を妨げない）', async () => {
    await expect(logAuditDenied(null, { actorUserId: null, action: 'view' })).resolves.toBeUndefined();
    await expect(logAuditDenied(undefined, { actorUserId: null, action: 'view' })).resolves.toBeUndefined();
  });

  it('DB書き込みが失敗しても例外を投げず、console.error にのみ記録する（ベストエフォート）', async () => {
    const insert = vi.fn(() => ({ values: vi.fn().mockRejectedValue(new Error('db down')) }));
    const db = { insert } as unknown as Parameters<typeof logAudit>[0];

    await expect(logAuditDenied(db, { actorUserId: 'u1', action: 'view' })).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

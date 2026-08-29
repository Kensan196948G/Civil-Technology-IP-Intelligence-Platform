import { neon } from '@neondatabase/serverless';

// drizzle-orm/neon-http は db.transaction() をサポートしない（HTTP経由のstatelessな
// リクエストのため）。複数の書き込みを原子的に行う必要がある箇所では、
// Neonクライアント自身が提供する非対話型トランザクション（sql.transaction([...])）を使う。
// 参考: https://neon.com/docs/serverless/serverless-driver#the-transaction-function
//
// 制約: これは「全部成功する／全部失敗する」の原子性のみを保証する。
// 行ロック（SELECT ... FOR UPDATE）による同時実行時の競合防止は含まれない。
// 真の同時実行安全性が必要になった場合は neon-serverless の WebSocket Pool へ
// 移行し、対話型トランザクション＋行ロックを使うこと（本番実装のバックログ）。

type Row = Record<string, unknown>;
type TaggedSql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;
export interface RawSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  transaction(callback: (txn: TaggedSql) => Array<Promise<unknown>>): Promise<unknown[]>;
}

export function getRawSql(databaseUrl: string): RawSql {
  const sql = neon(databaseUrl) as unknown as RawSql;
  // Neon の transaction() は配列を直接受け取る形式だが、
  // コールバック形式にも対応できるようラップする。
  const originalTransaction = (sql as any).transaction;
  if (typeof originalTransaction === 'function') {
    sql.transaction = (callback: (txn: TaggedSql) => Array<Promise<unknown>>) => {
      const taggedTx = ((strings: TemplateStringsArray, ...values: unknown[]) => {
        return originalTransaction.call(sql, [strings, ...values]);
      }) as TaggedSql;
      const queries = callback(taggedTx);
      return Promise.all(queries);
    };
  }
  return sql;
}

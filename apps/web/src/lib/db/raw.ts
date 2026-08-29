import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';

// drizzle-orm/neon-http は db.transaction() をサポートしない（HTTP経由のstatelessな
// リクエストのため）。複数の書き込みを原子的に行う必要がある箇所では、
// txn引数からクエリ配列を組み立てるコールバック形式の transaction() を使う
// (Neon: sql.transaction(txn => [txn`...`, txn`...`])、
//  ローカルPostgres: postgres.js の sql.begin() を同じ呼び出し形に合わせてラップ)。
//
// 制約: これは「全部成功する／全部失敗する」の原子性のみを保証する。
// 行ロック（SELECT ... FOR UPDATE）による同時実行時の競合防止は含まれない。

type Row = Record<string, unknown>;
type TaggedSql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;
export interface RawSql {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  transaction(callback: (txn: TaggedSql) => Array<Promise<unknown>>): Promise<unknown[]>;
}

const pgPools = new Map<string, ReturnType<typeof postgres>>();

function isLocalPgUrl(databaseUrl: string): boolean {
  return !/neon\.tech(:\d+)?$/.test(new URL(databaseUrl).host);
}

export function getRawSql(databaseUrl: string): RawSql {
  if (isLocalPgUrl(databaseUrl)) {
    let pg = pgPools.get(databaseUrl);
    if (!pg) {
      pg = postgres(databaseUrl, { max: 5 });
      pgPools.set(databaseUrl, pg);
    }
    const sql = pg as unknown as RawSql;
    sql.transaction = (callback) =>
      pg!.begin(async (tx) => {
        const taggedTx = tx as unknown as TaggedSql;
        const queries = callback(taggedTx);
        return Promise.all(queries);
      });
    return sql;
  }
  return neon(databaseUrl) as unknown as RawSql;
}

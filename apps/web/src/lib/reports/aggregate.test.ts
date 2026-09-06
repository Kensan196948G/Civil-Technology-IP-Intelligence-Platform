import { describe, it, expect, vi } from 'vitest';
import { buildReportData } from './aggregate';
import type { getDb } from '@/lib/db/client';

type Db = ReturnType<typeof getDb>;

// drizzle-orm の select().from().orderBy().limit() チェーンを模した、順序固定のスタブ。
// 各 db.select(...) 呼び出しごとに `responses` から1件ずつ結果を消費する
// （row-visibility.test.ts / log.test.ts と同じ方針: 実DBへは接続せず、呼び出し形と
// 戻り値の組み立てだけを検証する）。
function makeFakeDb(responses: unknown[][]): Db {
  let cursor = 0;
  function chain(): Record<string, unknown> {
    const c: Record<string, unknown> = {
      from: () => c,
      where: () => c,
      orderBy: () => c,
      limit: () => c,
      innerJoin: () => c,
      leftJoin: () => c,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(responses[cursor++]).then(resolve, reject)
    };
    return c;
  }
  const db = { select: vi.fn(() => chain()) };
  return db as unknown as Db;
}

describe('buildReportData', () => {
  it('executive（マッピング対象外）は主要テーブルの件数概要を1セクションで返す', async () => {
    const db = makeFakeDb([
      [{ n: 10 }], // patents
      [{ n: 4 }],  // technologies
      [{ n: 3 }],  // papers
      [{ n: 2 }]   // netis
    ]);

    const data = await buildReportData(db, 'executive', '経営サマリー2026年9月');

    expect(data.title).toBe('経営サマリー2026年9月');
    expect(data.kindLabel).toBe('経営サマリー');
    expect(data.sections).toHaveLength(1);
    expect(data.sections[0]!.heading).toBe('全体概要');
    expect(data.sections[0]!.table).toEqual({
      columns: ['対象', '件数'],
      rows: [
        ['特許', 10],
        ['技術（工法・材料・機械）', 4],
        ['論文', 3],
        ['NETIS登録技術', 2]
      ]
    });
  });

  it('competitor は競合企業の件数サマリと一覧テーブルを1セクションで返す', async () => {
    const db = makeFakeDb([
      [{ n: 2 }], // count
      [
        { name: 'A建設', category: '総合建設', createdAt: '2026-01-01T00:00:00.000Z' },
        { name: 'B工業', category: null, createdAt: '2026-02-01T00:00:00.000Z' }
      ]
    ]);

    const data = await buildReportData(db, 'competitor', '競合分析2026年9月');

    expect(data.sections).toHaveLength(1);
    const section = data.sections[0]!;
    expect(section.heading).toBe('競合企業一覧');
    expect(section.summary).toContain('2 件');
    expect(section.table!.columns).toEqual(['企業名', '分野', '登録日']);
    expect(section.table!.rows[0]![0]).toBe('A建設');
    // category が null のときは '—' で埋める
    expect(section.table!.rows[1]![1]).toBe('—');
  });

  it('マッピング未定義の種別は概要のみのフォールバックにならず、既定で overviewSection を使う', async () => {
    const db = makeFakeDb([
      [{ n: 0 }], [{ n: 0 }], [{ n: 0 }], [{ n: 0 }]
    ]);

    const data = await buildReportData(db, 'unknown-kind-xyz', 'タイトル');
    expect(data.sections).toHaveLength(1);
    expect(data.sections[0]!.heading).toBe('全体概要');
  });
});

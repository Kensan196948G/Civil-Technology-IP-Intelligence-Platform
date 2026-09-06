import { describe, it, expect } from 'vitest';
import { findPatentCandidatesForLabel } from './patent-match';
import type { getDb } from '@/lib/db/client';

function fakeDb(rows: Array<{ id: string; title: string; sim: number | string | null }>): ReturnType<typeof getDb> {
  return {
    execute: async () => ({ rows })
  } as unknown as ReturnType<typeof getDb>;
}

describe('findPatentCandidatesForLabel', () => {
  it('空文字列・空白のみのラベルはクエリを発行せず空配列を返す', async () => {
    const db = fakeDb([{ id: 'x', title: 'ダミー', sim: 1 }]);
    expect(await findPatentCandidatesForLabel(db, '')).toEqual([]);
    expect(await findPatentCandidatesForLabel(db, '   ')).toEqual([]);
  });

  it('sim（pg_trgm類似度）がある場合は0-100スケールに変換する', async () => {
    const db = fakeDb([{ id: 'p1', title: '特許A', sim: 0.8321 }]);
    const result = await findPatentCandidatesForLabel(db, 'ケーソン');
    expect(result).toEqual([{ id: 'p1', title: '特許A', score: 83.21 }]);
  });

  it('simがnull（ILIKEのみ一致）の場合は固定スコア40を使う', async () => {
    const db = fakeDb([{ id: 'p2', title: '特許B', sim: null }]);
    const result = await findPatentCandidatesForLabel(db, '基礎工事');
    expect(result).toEqual([{ id: 'p2', title: '特許B', score: 40 }]);
  });

  it('複数件を順序通りに返す', async () => {
    const db = fakeDb([
      { id: 'p1', title: '特許A', sim: 0.9 },
      { id: 'p2', title: '特許B', sim: 0.5 }
    ]);
    const result = await findPatentCandidatesForLabel(db, '工法');
    expect(result.map(r => r.id)).toEqual(['p1', 'p2']);
  });
});

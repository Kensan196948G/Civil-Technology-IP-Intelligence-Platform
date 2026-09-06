import { describe, it, expect } from 'vitest';
import { fuseRrf, normalizeText, RRF_K_DEFAULT, SEARCH_WEIGHTS, type RankedList } from './rrf';

// ADR-0003 / docs/30-design/06-search-and-rag-design.md §4.4 の RRF融合ロジックの単体テスト。
// DBアクセスを含まない純粋関数のため、SQL/実DB無しで検証できる。

describe('fuseRrf', () => {
  it('単一リストでは 1/(k+rank) の順にスコアが単調減少する', () => {
    const lists: RankedList[] = [
      { name: 'lexical', weight: 1, ids: ['a', 'b', 'c'] }
    ];
    const result = fuseRrf(lists);

    expect(result.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(result[0]!.score).toBeCloseTo(1 / (RRF_K_DEFAULT + 1));
    expect(result[1]!.score).toBeCloseTo(1 / (RRF_K_DEFAULT + 2));
    expect(result[2]!.score).toBeCloseTo(1 / (RRF_K_DEFAULT + 3));
  });

  it('複数リストに共通して現れるIDはスコアが加算され、上位に来る', () => {
    const lists: RankedList[] = [
      { name: 'lexical:patents', weight: 1, ids: ['p1', 'p2', 'p3'] },
      { name: 'lexical:tech', weight: 1, ids: ['t1', 'p2'] }
    ];
    const result = fuseRrf(lists);

    // p2 は両リストに1位/2位で登場するため、単独1位のp1・t1より高スコアになる
    const scoreOf = (id: string) => result.find(r => r.id === id)!.score;
    expect(scoreOf('p2')).toBeGreaterThan(scoreOf('p1'));
    expect(scoreOf('p2')).toBeGreaterThan(scoreOf('t1'));
    expect(result[0]!.id).toBe('p2');
  });

  it('重みが高いリストのIDが優先される（構造検索 > 字句検索 相当）', () => {
    const lists: RankedList[] = [
      { name: 'structured', weight: SEARCH_WEIGHTS.structured, ids: ['exact-match'] },
      { name: 'lexical', weight: SEARCH_WEIGHTS.lexical, ids: ['similar-1', 'similar-2'] }
    ];
    const result = fuseRrf(lists);

    expect(result[0]!.id).toBe('exact-match');
  });

  it('空リストの配列を渡すと空配列を返す', () => {
    expect(fuseRrf([])).toEqual([]);
  });

  it('同一リスト内の重複IDは最初（最も高い順位）のみを採用する', () => {
    const lists: RankedList[] = [
      { name: 'lexical', weight: 1, ids: ['a', 'b', 'a'] }
    ];
    const result = fuseRrf(lists);

    // 'a' が2回分加算されていれば b よりさらに大きく上回るはずだが、
    // 重複除去されていれば単に「1位のa」の寄与のみとなる。
    expect(result.find(r => r.id === 'a')!.score).toBeCloseTo(1 / (RRF_K_DEFAULT + 1));
    expect(result.find(r => r.id === 'b')!.score).toBeCloseTo(1 / (RRF_K_DEFAULT + 2));
  });

  it('k を大きくするほど順位間のスコア差が小さくなる（雑音への頑健性）', () => {
    const lists: RankedList[] = [{ name: 'lexical', weight: 1, ids: ['a', 'b'] }];
    const diffSmallK = (() => {
      const r = fuseRrf(lists, 1);
      return r[0]!.score - r[1]!.score;
    })();
    const diffLargeK = (() => {
      const r = fuseRrf(lists, 1000);
      return r[0]!.score - r[1]!.score;
    })();

    expect(diffSmallK).toBeGreaterThan(diffLargeK);
  });
});

describe('normalizeText', () => {
  it('全角英数字を半角へ変換する（NFKC）', () => {
    expect(normalizeText('Ａ１２３')).toBe('a123');
  });

  it('大文字小文字を統一する', () => {
    expect(normalizeText('AbC')).toBe('abc');
  });

  it('連続する空白（全角スペース含む）を1つに圧縮し前後を除去する', () => {
    expect(normalizeText('  ケーソン　　据付   自動化  ')).toBe('ケーソン 据付 自動化');
  });

  it('空文字はそのまま空文字を返す', () => {
    expect(normalizeText('')).toBe('');
  });
});

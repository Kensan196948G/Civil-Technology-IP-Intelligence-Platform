import { describe, it, expect } from 'vitest';
import { buildDrawingCompareText, jaccardSimilarity, cosineSimilarity, toSimilarityScore } from './drawing-similarity';

describe('buildDrawingCompareText', () => {
  it('captionとpartsを結合する', () => {
    const text = buildDrawingCompareText('据付装置の側面図', [
      { partNo: '1', description: 'ケーソン本体' },
      { partNo: '2', description: '油圧シリンダー' }
    ]);
    expect(text).toContain('据付装置の側面図');
    expect(text).toContain('1:ケーソン本体');
    expect(text).toContain('2:油圧シリンダー');
  });

  it('captionが無くてもpartsだけで組み立てる', () => {
    const text = buildDrawingCompareText(null, [{ partNo: '1', description: 'ブーム' }]);
    expect(text).toBe('1:ブーム');
  });
});

describe('jaccardSimilarity', () => {
  it('同一テキストは1になる', () => {
    expect(jaccardSimilarity('油圧シリンダー ケーソン', '油圧シリンダー ケーソン')).toBe(1);
  });

  it('共通語が無ければ0になる', () => {
    expect(jaccardSimilarity('油圧シリンダー', 'ブーム アーム')).toBe(0);
  });

  it('部分的に共通する語があれば0と1の間になる', () => {
    const score = jaccardSimilarity('油圧シリンダー ケーソン 据付', '油圧シリンダー アーム');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(1);
  });

  it('両方空文字なら0になる（0除算を起こさない）', () => {
    expect(jaccardSimilarity('', '')).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('同一ベクトルは1になる', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('直交ベクトルは0になる', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('次元数が一致しない場合は0を返す', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('ゼロベクトルとの比較は0を返す（0除算を起こさない）', () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe('toSimilarityScore', () => {
  it('0-1の比率を0-100へ変換する', () => {
    expect(toSimilarityScore(0.8765)).toBe(87.65);
  });

  it('範囲外の値は0-100にクランプする', () => {
    expect(toSimilarityScore(-0.5)).toBe(0);
    expect(toSimilarityScore(1.5)).toBe(100);
  });
});

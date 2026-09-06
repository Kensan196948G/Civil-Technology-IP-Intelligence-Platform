import { describe, it, expect } from 'vitest';
import { renderHtml } from './render-html';
import type { ReportData } from './types';

const sample: ReportData = {
  title: '特許調査報告書サンプル',
  kindLabel: '特許調査報告書',
  generatedAt: new Date('2026-09-06T00:00:00.000Z'),
  sections: [
    {
      heading: '対象特許一覧',
      summary: '対象特許 2 件のうち、直近登録された上位 2 件を表示する。',
      table: {
        columns: ['公開/公報番号', '発明の名称'],
        rows: [
          ['JP2020-1<script>', '構造物<設計>手法'],
          ['JP2021-2', '別の発明']
        ]
      }
    }
  ]
};

describe('renderHtml', () => {
  it('タイトル・種類・生成日時を含むHTML文字列を生成する', () => {
    const html = renderHtml(sample);
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('特許調査報告書サンプル');
    expect(html).toContain('種類: 特許調査報告書');
    expect(html).toContain('2026-09-06T00:00:00.000Z');
  });

  it('セクション見出し・summary・表（ヘッダ/行）を含む', () => {
    const html = renderHtml(sample);
    expect(html).toContain('対象特許一覧');
    expect(html).toContain('直近登録された上位 2 件');
    expect(html).toContain('<th>公開/公報番号</th>');
    expect(html).toContain('<th>発明の名称</th>');
    expect(html).toContain('JP2021-2');
  });

  it('セルの値をHTMLエスケープする（XSS対策）', () => {
    const html = renderHtml(sample);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('構造物&lt;設計&gt;手法');
  });

  it('table が無いセクションでも例外を投げない', () => {
    const data: ReportData = {
      title: '概要のみ',
      kindLabel: '経営サマリー',
      generatedAt: new Date(),
      sections: [{ heading: '全体概要', summary: '概要のみのセクション' }]
    };
    expect(() => renderHtml(data)).not.toThrow();
    expect(renderHtml(data)).toContain('全体概要');
  });
});

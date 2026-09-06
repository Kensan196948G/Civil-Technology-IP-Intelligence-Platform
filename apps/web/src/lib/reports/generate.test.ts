import { describe, it, expect } from 'vitest';
import { generateReportFile, REPORT_MIME_TYPES } from './generate';
import type { ReportData } from './types';

// README §16: 各出力形式（html/pdf/docx/xlsx）でファイルのバイト列が生成され、
// 先頭マジックバイト等が妥当であることを確認する。
const sample: ReportData = {
  title: 'テストレポート',
  kindLabel: '経営サマリー',
  generatedAt: new Date('2026-09-06T00:00:00.000Z'),
  sections: [
    {
      heading: '全体概要',
      summary: '主要テーブルの件数概要',
      table: {
        columns: ['対象', '件数'],
        rows: [
          ['特許', 12],
          ['技術', 5]
        ]
      }
    }
  ]
};

describe('generateReportFile', () => {
  it('不正な形式はエラーになる', async () => {
    await expect(generateReportFile('csv', sample)).rejects.toThrow('不正な出力形式です');
  });

  it('html: text/html のバイト列を生成する', async () => {
    const { content, mimeType } = await generateReportFile('html', sample);
    expect(mimeType).toBe(REPORT_MIME_TYPES.html);
    expect(content.toString('utf8')).toContain('<!doctype html>');
    expect(content.toString('utf8')).toContain('テストレポート');
  });

  it('pdf: %PDF- で始まるバイト列を生成する', async () => {
    const { content, mimeType } = await generateReportFile('pdf', sample);
    expect(mimeType).toBe(REPORT_MIME_TYPES.pdf);
    expect(content.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(content.length).toBeGreaterThan(100);
  });

  it('docx: ZIP(PK)シグネチャで始まるバイト列を生成する', async () => {
    const { content, mimeType } = await generateReportFile('docx', sample);
    expect(mimeType).toBe(REPORT_MIME_TYPES.docx);
    expect(content.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(content.length).toBeGreaterThan(100);
  });

  it('xlsx: ZIP(PK)シグネチャで始まるバイト列を生成する', async () => {
    const { content, mimeType } = await generateReportFile('xlsx', sample);
    expect(mimeType).toBe(REPORT_MIME_TYPES.xlsx);
    expect(content.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(content.length).toBeGreaterThan(100);
  });
});

// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
// 中間表現（ReportData）から、format（html/pdf/docx/xlsx）に応じた実ファイルのバイト列を生成する。
import type { ReportData } from './types';
import { renderHtml } from './render-html';
import { renderPdf } from './render-pdf';
import { renderDocx } from './render-docx';
import { renderXlsx } from './render-xlsx';

export const REPORT_MIME_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

export interface GeneratedReportFile {
  content: Buffer;
  mimeType: string;
}

export async function generateReportFile(format: string, data: ReportData): Promise<GeneratedReportFile> {
  const mimeType = REPORT_MIME_TYPES[format];
  if (!mimeType) throw new Error(`不正な出力形式です: ${format}`);

  switch (format) {
    case 'html':
      return { content: Buffer.from(renderHtml(data), 'utf8'), mimeType };
    case 'pdf':
      return { content: await renderPdf(data), mimeType };
    case 'docx':
      return { content: await renderDocx(data), mimeType };
    case 'xlsx':
      return { content: await renderXlsx(data), mimeType };
    default:
      throw new Error(`不正な出力形式です: ${format}`);
  }
}

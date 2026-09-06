// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
// exceljs でシート1枚にセクションごとの表を並べる。
import ExcelJS from 'exceljs';
import type { ReportData } from './types';

export async function renderXlsx(data: ReportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Civil-Technology-IP-Intelligence-Platform';
  workbook.created = data.generatedAt;

  const sheet = workbook.addWorksheet('レポート', { views: [{ state: 'frozen', ySplit: 0 }] });

  sheet.addRow([data.title]).font = { bold: true, size: 14 };
  sheet.addRow([`種類: ${data.kindLabel} ／ 生成日時: ${data.generatedAt.toISOString()}`]);
  sheet.addRow([]);

  for (const section of data.sections) {
    const headingRow = sheet.addRow([section.heading]);
    headingRow.font = { bold: true, size: 12 };
    if (section.summary) {
      sheet.addRow([section.summary]);
    }
    if (section.table) {
      const headerRow = sheet.addRow(section.table.columns);
      headerRow.font = { bold: true };
      for (const row of section.table.rows) {
        sheet.addRow(row);
      }
    }
    sheet.addRow([]);
  }

  sheet.columns.forEach(col => {
    col.width = 24;
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

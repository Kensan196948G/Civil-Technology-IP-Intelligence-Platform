// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
// docx で見出し・段落・表を生成する。
import {
  Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType
} from 'docx';
import type { ReportData } from './types';

function headerCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
    width: { size: 100, type: WidthType.AUTO }
  });
}

function bodyCell(text: string | number): TableCell {
  return new TableCell({
    children: [new Paragraph({ text: String(text) })],
    width: { size: 100, type: WidthType.AUTO }
  });
}

export async function renderDocx(data: ReportData): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({ text: data.title, heading: HeadingLevel.TITLE }),
    new Paragraph({
      children: [
        new TextRun({ text: `種類: ${data.kindLabel} ／ 生成日時: ${data.generatedAt.toISOString()}`, italics: true, size: 18 })
      ]
    })
  ];

  for (const section of data.sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_2 }));
    if (section.summary) {
      children.push(new Paragraph({ text: section.summary }));
    }
    if (section.table) {
      const { columns, rows } = section.table;
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: columns.map(headerCell) }),
          ...rows.map(row => new TableRow({ children: row.map(bodyCell) }))
        ]
      }));
    }
  }

  const doc = new Document({
    sections: [{ children }]
  });

  return Packer.toBuffer(doc);
}

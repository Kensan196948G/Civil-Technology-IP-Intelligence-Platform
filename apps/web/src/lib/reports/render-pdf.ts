// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
// pdf-lib でタイトル・セクション見出し・簡易テーブル（罫線なし・テキスト整列レベル）を描画する。
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { ReportData } from './types';
import { loadJapaneseFontBytes } from './font';

const PAGE_WIDTH = 595.28; // A4 (pt)
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const TITLE_SIZE = 16;
const META_SIZE = 9;
const HEADING_SIZE = 12;
const BODY_SIZE = 9;
const LINE_GAP = 5;

function truncateToWidth(text: string, maxWidth: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && font.widthOfTextAtSize(`${result}…`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}…`;
}

export async function renderPdf(data: ReportData): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(loadJapaneseFontBytes(), { subset: true });

  let page: PDFPage = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (height: number) => {
    if (y - height < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const drawLine = (text: string, size: number, color = rgb(0.1, 0.11, 0.13)) => {
    ensureSpace(size + LINE_GAP);
    page.drawText(text, { x: MARGIN, y, size, font, color });
    y -= size + LINE_GAP;
  };

  drawLine(data.title, TITLE_SIZE);
  drawLine(`種類: ${data.kindLabel} ／ 生成日時: ${data.generatedAt.toISOString()}`, META_SIZE, rgb(0.4, 0.42, 0.46));
  y -= 8;

  const usableWidth = PAGE_WIDTH - MARGIN * 2;

  for (const section of data.sections) {
    ensureSpace(HEADING_SIZE + 12);
    drawLine(section.heading, HEADING_SIZE);
    if (section.summary) {
      drawLine(section.summary, BODY_SIZE, rgb(0.25, 0.27, 0.3));
    }
    if (section.table) {
      const { columns, rows } = section.table;
      const colWidth = usableWidth / columns.length;

      ensureSpace(BODY_SIZE + LINE_GAP);
      columns.forEach((c, i) => {
        page.drawText(truncateToWidth(c, colWidth - 4, font, BODY_SIZE), {
          x: MARGIN + i * colWidth, y, size: BODY_SIZE, font, color: rgb(0.35, 0.3, 0.15)
        });
      });
      y -= BODY_SIZE + LINE_GAP;

      for (const row of rows) {
        ensureSpace(BODY_SIZE + LINE_GAP);
        row.forEach((cell, i) => {
          page.drawText(truncateToWidth(String(cell), colWidth - 4, font, BODY_SIZE), {
            x: MARGIN + i * colWidth, y, size: BODY_SIZE, font
          });
        });
        y -= BODY_SIZE + LINE_GAP;
      }
    }
    y -= 10;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
// html形式: 既存デザイントークン風の最低限のスタイルを持つ単純なテーブル付きHTML文字列を生成する。
import type { ReportData } from './types';

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderHtml(data: ReportData): string {
  const sectionsHtml = data.sections.map(section => {
    const tableHtml = section.table
      ? `<table>
        <thead><tr>${section.table.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>${section.table.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`
      : '';
    return `<section>
      <h2>${escapeHtml(section.heading)}</h2>
      ${section.summary ? `<p class="summary">${escapeHtml(section.summary)}</p>` : ''}
      ${tableHtml}
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${escapeHtml(data.title)}</title>
<style>
  body { font-family: -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif; color: #1b1f24; background: #fdfdfb; margin: 0; padding: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #5c6470; font-size: 12px; margin-bottom: 24px; }
  h2 { font-size: 15px; margin: 24px 0 8px; border-left: 3px solid #b08a3e; padding-left: 8px; }
  .summary { font-size: 13px; color: #3a4048; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #d8dbe0; padding: 6px 8px; text-align: left; }
  th { background: #f2f0ea; font-weight: 600; }
  .note { margin-top: 32px; font-size: 11px; color: #8a8f98; }
</style>
</head>
<body>
  <h1>${escapeHtml(data.title)}</h1>
  <div class="meta">種類: ${escapeHtml(data.kindLabel)} ／ 生成日時: ${escapeHtml(data.generatedAt.toISOString())}</div>
  ${sectionsHtml}
  <p class="note">AIの出力をそのまま社外向け資料に貼ることは禁止されています。社外に出す資料は必ず技術部門の確認を経てください。</p>
</body>
</html>`;
}

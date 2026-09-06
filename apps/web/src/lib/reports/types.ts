// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
//
// レポート種別（kind）ごとの集計結果を、出力形式（html/pdf/docx/xlsx）に依存しない
// 共通の中間表現として表す。各 render-*.ts はこの型だけを見てファイルを生成する。
export interface ReportTable {
  columns: string[];
  rows: (string | number)[][];
}

export interface ReportSection {
  heading: string;
  summary?: string;
  table?: ReportTable;
}

export interface ReportData {
  title: string;
  kindLabel: string;
  generatedAt: Date;
  sections: ReportSection[];
}

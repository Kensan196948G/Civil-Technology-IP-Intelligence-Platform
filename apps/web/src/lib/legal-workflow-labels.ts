// 「12. 法務・知財レビュー」セクションの各ページで共通利用する
// workflow_instances の表示ラベル定義。
export const WORKFLOW_STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  researching: '調査中',
  ai_reviewed: 'AIレビュー済み',
  technical_review: '技術レビュー中',
  ip_review: '知財レビュー中',
  legal_review: '法務レビュー中',
  approved: '承認済み',
  rejected: '差戻し',
  hold: '保留',
  archived: 'アーカイブ'
};

export const WORKFLOW_KIND_LABEL: Record<string, string> = {
  invention: '発明届',
  field_adoption: '現場導入',
  license_in: 'ライセンス導入'
};

export type AiRiskSummary = {
  novelty?: string;
  inventive?: string;
  description?: string;
  overlap?: string;
  note?: string;
};

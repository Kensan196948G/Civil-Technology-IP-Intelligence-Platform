// 画面をまたいで使う日本語ラベルと配色の対応。
// ワークフロー段階・機密区分・監査操作などは複数画面で同じ見た目にする必要があるため、
// ここに集約する。

import type { Tone } from '@/components/detail/types';

export const WORKFLOW_STATUS: Record<string, { label: string; tone: Tone }> = {
  draft: { label: '下書き', tone: 'gray' },
  researching: { label: '調査中', tone: 'purple' },
  ai_reviewed: { label: 'AIレビュー済', tone: 'purple' },
  technical_review: { label: '技術レビュー', tone: 'purple' },
  ip_review: { label: '知財レビュー', tone: 'blue' },
  legal_review: { label: '法務レビュー', tone: 'amber' },
  approved: { label: '承認済', tone: 'green' },
  rejected: { label: '差戻', tone: 'red' },
  hold: { label: '保留', tone: 'amber' },
  archived: { label: 'アーカイブ', tone: 'gray' }
};

export const WORKFLOW_KIND: Record<string, { label: string; tone: Tone }> = {
  invention: { label: '発明届', tone: 'purple' },
  field_adoption: { label: '技術導入', tone: 'blue' },
  license_in: { label: 'ライセンス', tone: 'amber' },
  license_out: { label: 'ライセンス', tone: 'amber' }
};

/** 機密区分。C3/C4は権限がなければ存在自体を見せない（404）運用のため、色を強くする。 */
export const CLASSIFICATION: Record<string, Tone> = {
  C1: 'gray', C2: 'blue', C3: 'amber', C4: 'red'
};

export const AUDIT_ACTION: Record<string, { label: string; tone: Tone }> = {
  login: { label: 'user_login', tone: 'green' },
  search: { label: 'search', tone: 'blue' },
  ai_run: { label: 'ai_run', tone: 'purple' },
  view: { label: 'view', tone: 'gray' },
  export: { label: 'export', tone: 'amber' },
  update: { label: 'update', tone: 'blue' },
  role_change: { label: 'role_change', tone: 'purple' },
  security_event: { label: 'security_event', tone: 'red' },
  seed: { label: 'seed', tone: 'gray' }
};

export const REPORT_KIND: Record<string, { label: string; tone: Tone }> = {
  investigation: { label: '調査レポート', tone: 'blue' },
  'tech-survey': { label: '技術調査報告書', tone: 'blue' },
  'patent-survey': { label: '特許調査報告書', tone: 'blue' },
  'prior-art': { label: '先行技術調査書', tone: 'blue' },
  'claim-compare': { label: 'Claim比較レポート', tone: 'purple' },
  novelty: { label: '新規性レビュー', tone: 'purple' },
  'inventive-step': { label: '進歩性レビュー', tone: 'purple' },
  'ai-examine': { label: 'AI模擬審査報告', tone: 'purple' },
  competitor: { label: '競合分析', tone: 'purple' },
  landscape: { label: 'Patent Landscape', tone: 'blue' },
  whitespace: { label: 'ホワイトスペース分析', tone: 'blue' },
  'field-application': { label: '現場適用性評価', tone: 'green' },
  rnd: { label: 'R&D提案', tone: 'green' },
  licensing: { label: 'ライセンス評価', tone: 'amber' },
  executive: { label: '経営サマリー', tone: 'amber' }
};

export const WATCH_KIND: Record<string, { label: string; tone: Tone }> = {
  patent: { label: '特許ウォッチ', tone: 'blue' },
  competitor: { label: '競合企業ウォッチ', tone: 'red' },
  technology: { label: '技術分野ウォッチ', tone: 'green' },
  ipc: { label: 'IPC / CPCウォッチ', tone: 'blue' },
  researcher: { label: '発明者ウォッチ', tone: 'purple' },
  paper: { label: '論文ウォッチ', tone: 'purple' },
  netis: { label: 'NETISウォッチ', tone: 'green' }
};

export const AI_RUN_KIND: Record<string, string> = {
  examine: 'AI模擬審査',
  claim_compare: 'Claim比較',
  field_score: '現場適用スコア',
  search: '横断検索',
  summarize: '要約'
};

export const SEARCH_TAB: Record<string, { label: string; tone: Tone }> = {
  patent: { label: '特許', tone: 'blue' },
  paper: { label: '論文', tone: 'purple' },
  netis: { label: 'NETIS', tone: 'green' },
  tech: { label: '自社技術', tone: 'blue' }
};

/**
 * sites.conditions（jsonb）のキーの日本語名と単位。
 * 現場条件は現場ごとにキーが増えうるため、未知のキーはそのまま出す。
 */
// ラベルは実測値の名前にしてある（「海象」「地盤」「作業ヤード」は評価軸の名前と
// 重なるため、現場条件側では具体的な計測値の名前を使う）。
const SITE_CONDITION: Record<string, { label: string; unit?: string }> = {
  marine_wave_m: { label: '有義波高', unit: 'm' },
  water_depth_m: { label: '水深', unit: 'm' },
  ground_n: { label: 'N値' },
  yard_m2: { label: 'ヤード面積', unit: 'm²' },
  slope_gradient: { label: '法面勾配' }
};

export function siteConditionLabel(key: string): string {
  return SITE_CONDITION[key]?.label ?? key;
}

export function siteConditionValue(key: string, value: unknown): string {
  const text = value !== null && typeof value === 'object' ? JSON.stringify(value) : String(value);
  const unit = SITE_CONDITION[key]?.unit;
  return unit ? `${text} ${unit}` : text;
}

// タイムスタンプの表示。
//
// 注意: drizzle の timestamp カラムは Date オブジェクトにマップされるため、
// String(value).slice(0, 10) では "Sun Aug 23" のような文字列になってしまう
// （db.execute の生SQLで ::text にキャストした場合だけ ISO 文字列になる）。
// Date と ISO文字列のどちらを渡されても同じ形式で出せるようにする。
// サーバ／クライアントで表示がずれないよう、常にUTCで整形する。
function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** YYYY-MM-DD */
export function ymd(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 10) : '—';
}

/** YYYY-MM-DD HH:mm */
export function stamp(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—';
}

/** YYYY-MM-DD HH:mm:ss（監査ログ・Provenance など、秒まで必要な箇所） */
export function stampSec(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString().slice(0, 19).replace('T', ' ') : '—';
}

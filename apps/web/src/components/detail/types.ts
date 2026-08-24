// 詳細ドロワーの仕様。Server Componentから渡すため、すべてシリアライズ可能な値に限る
// （関数を持たせない。画面遷移は href、閉じるだけのボタンは href なしで表現する）。

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray';

export type DetailMeta = { k: string; v: string };
export type DetailField = { label: string; placeholder?: string; textarea?: boolean };
export type DetailAction = {
  label: string;
  /** 指定するとその画面へ遷移する。未指定のボタンはドロワーを閉じるだけ（MVPのダミー操作）。 */
  href?: string;
  /** オレンジの主ボタンにする。 */
  primary?: boolean;
};

export type DetailSpec = {
  title: string;
  tag?: string;
  tone?: Tone;
  meta?: DetailMeta[];
  body?: string;
  form?: DetailField[];
  citations?: string[];
  /** 「AIは決めない」等の消せない注記。 */
  note?: string;
  actions?: DetailAction[];
};

export const TAG_CLASS: Record<Tone, string> = {
  blue: 'tag-blue', green: 'tag-green', amber: 'tag-amber',
  red: 'tag-red', purple: 'tag-purple', gray: 'tag-gray'
};

/** 原文（出どころ）チップを開いたときに出す詳細。設計案どおり、引用は機械的な抜粋である旨を明示する。 */
export function citationDetail(label: string): DetailSpec {
  return {
    title: label,
    tag: '原文',
    tone: 'gray',
    meta: [
      { k: '出典', v: label },
      { k: '取得', v: '自動取り込み（Provenance に記録）' }
    ],
    body: '原文の該当箇所を表示します。引用文は原文から機械的に切り出されます。AIが引用文を生成することはありません。',
    note: '原文の閲覧も監査ログに記録されます。'
  };
}

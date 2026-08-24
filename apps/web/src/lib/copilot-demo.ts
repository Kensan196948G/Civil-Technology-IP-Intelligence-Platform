// Copilotホーム（M14 AIアシスタント）のデモ会話。
//
// このデータだけはDBに対応するテーブルが無い。会話ログ（copilot_threads / copilot_messages）は
// 本番設計side（docs/30-design/02-database-design.md）にはあるが、MVPスキーマには含まれていないため、
// 会話の見え方を確認できるようデモ用の定数として持つ。他の画面の一覧・件数はすべて実DBから取得している。
//
// 会話の中身は「普通の日本語で聞ける」「答えには必ず出どころが付く」「AIは決めない」という
// 本システムの原則を画面上で確認するためのもので、実際の調査結果ではない。

import type { Tone } from '@/components/detail/types';

export type CopilotCandidate = {
  /** 適用スコア（100点満点）。競合クラスタの会話では件数を表す。 */
  score: number;
  scoreTone: 'green' | 'amber' | 'red' | 'gray';
  name: string;
  meta: string;
  tag: string;
  tone: Tone;
};

export type CopilotConversation = {
  /** サイドバー「最近の会話」に出す名前。null の会話は履歴に出さない（その場の質問）。 */
  label: string | null;
  q: string;
  agent: string;
  scope: string;
  evidence: number;
  answer: string;
  candidates: CopilotCandidate[];
  citations: string[];
};

export const CONVERSATIONS: CopilotConversation[] = [
  {
    label: null,
    q: '軟弱地盤で重機が沈下する。作業ヤードも狭い。使える工法はある？',
    agent: 'Civil Engineer Agent',
    scope: '特許 214件・NETIS 48件・自社技術 8件を照合',
    evidence: 12,
    answer: '軟弱地盤・狭隘ヤードの条件に合う候補を3件見つけました。いずれも地盤改良を先行せずに施工できる点が共通です。現場条件（地耐力・ヤード寸法）を登録すると、適用スコアの精度が上がります。',
    candidates: [
      { score: 82, scoreTone: 'green', name: '超軽量敷鉄板レス地盤支持マット工法', meta: 'NETIS登録・事後評価あり ／ 地耐力30kN/m²から適用', tag: 'NETIS', tone: 'green' },
      { score: 74, scoreTone: 'amber', name: '狭隘地対応ミニクローラクレーン工法', meta: '他社特許（実施許諾の可能性あり）／ ヤード幅6mから', tag: '他社特許', tone: 'amber' },
      { score: 68, scoreTone: 'amber', name: '自社開発・軽量盛土による仮設路盤', meta: '自社技術台帳 T-0038 ／ 東北支店で施工実績2件', tag: '自社技術', tone: 'blue' }
    ],
    citations: ['JP7234567 請求項1', 'NETIS KT-230045-VE 事後評価', '土木学会論文集 2025-B3-042 §4.2', '自社技術台帳 T-0038']
  },
  {
    label: 'ケーソン据付の自動化技術',
    q: '港湾のケーソン据付を自動化したい。使える技術をまとめて。',
    agent: '技術調査Agent',
    scope: '特許 214件・NETIS 48件・論文 96件を照合',
    evidence: 9,
    answer: '据付の「位置決め」「誘導」「姿勢制御」の3工程それぞれに候補が見つかりました。NETIS登録の誘導システムは事後評価で据付精度±5cmの実績があります。2件は他社特許のため、導入にはライセンス確認が必要です。',
    candidates: [
      { score: 85, scoreTone: 'green', name: 'ケーソン据付誘導システム（自動追尾TS併用）', meta: 'NETIS KT-230045-VE ／ 据付精度±5cm・省人化20%', tag: 'NETIS', tone: 'green' },
      { score: 76, scoreTone: 'amber', name: '水中構造物の据付誘導装置（音響測位併用）', meta: '他社特許 ／ 濁水中でも使用可能', tag: '他社特許', tone: 'amber' },
      { score: 71, scoreTone: 'amber', name: '函体姿勢制御用バラスト注水制御装置', meta: '他社特許 ／ 沈設中の姿勢を自動保持', tag: '他社特許', tone: 'amber' }
    ],
    citations: ['JP7234567 請求項1', 'JP7198221 請求項1・3', 'NETIS KT-230045-VE 事後評価', 'JP730198 明細書 §0021']
  },
  {
    label: '浚渫土の改良材、既存特許との違い',
    q: '発明届「浚渫土の高含水比改良材の配合」は、既存特許とどこが違う？',
    agent: 'Claim Agent',
    scope: '類似特許 6件と構成要件を突き合わせ',
    evidence: 7,
    answer: '最も近いJP6891234と構成要件5件を比較しました。「同じ」2件・「似ている」1件・「違う」2件です。違いは改良材の配合比の範囲と、混合撹拌の工程順にあります。この2点が新規性の主張候補です（判断は知財部門が行います）。',
    candidates: [
      { score: 72, scoreTone: 'amber', name: 'JP6891234「高含水比土の固化処理材」', meta: '構成要件5件中: 同じ2・似ている1・違う2 ／ 類似度は目印です', tag: '他社特許', tone: 'amber' },
      { score: 58, scoreTone: 'gray', name: 'JP7011876「浚渫土の再資源化処理方法」', meta: '構成要件5件中: 同じ1・似ている2・違う2', tag: '他社特許', tone: 'amber' },
      { score: 41, scoreTone: 'gray', name: 'JP6755432「泥土の脱水固化システム」', meta: '工程構成が異なる（脱水先行型）', tag: '参考', tone: 'gray' }
    ],
    citations: ['JP6891234 請求項1', 'JP7011876 請求項1・4', '発明届 構成要件表', 'Claim Chart CC-0112']
  },
  {
    label: '無人化法面吹付のNETIS事後評価',
    q: '無人化法面吹付工法のNETIS事後評価の内容を教えて。',
    agent: '技術調査Agent',
    scope: 'NETIS 48件・公開施工事例 32件を照合',
    evidence: 5,
    answer: 'NETIS KT-210033-VEの事後評価では、省人化30%・法面での墜落災害リスクの低減が確認されています。適用条件は法面勾配1:0.8まで。東北支店の導入審査（承認済）でもこの評価値が根拠に使われました。',
    candidates: [
      { score: 88, scoreTone: 'green', name: '無人化法面吹付工法（遠隔操作式）', meta: 'NETIS KT-210033-VE ／ 省人化30%・墜落リスク低減', tag: 'NETIS', tone: 'green' },
      { score: 69, scoreTone: 'amber', name: '法面吹付ノズルの角度自動調整機構', meta: '自社発明届（出願決定）／ 上記工法の改良発明', tag: '自社発明', tone: 'purple' }
    ],
    citations: ['NETIS KT-210033-VE 事後評価', '公開施工事例 CS-0271', '発明届 INV-19']
  },
  {
    label: '競合A社の直近1年の出願',
    q: '競合A社の直近1年の出願動向をまとめて。',
    agent: 'Competitor Agent',
    scope: '競合A社の公開特許 38件を分析',
    evidence: 15,
    answer: '直近1年の公開出願は38件で前年比+27%です。ケーソン据付関連（8件）と水中ドローン点検（6件）に集中しており、当社の調査案件「ケーソン据付自動化」と重なる領域が拡大しています。ウォッチの重要度「高」2件はこのクラスタです。',
    candidates: [
      { score: 8, scoreTone: 'red', name: 'ケーソン据付・函体沈設クラスタ', meta: '前年3件→8件に増加 ／ 当社調査案件と重複', tag: '要注視', tone: 'red' },
      { score: 6, scoreTone: 'amber', name: '水中ドローン・点検クラスタ', meta: '新規参入領域 ／ 大学との共同出願2件を含む', tag: '新興', tone: 'amber' },
      { score: 4, scoreTone: 'gray', name: 'ICT土工・転圧管理クラスタ', meta: '横ばい ／ 当社導入済み技術と競合', tag: '継続', tone: 'gray' }
    ],
    citations: ['出願人分析 A社 直近1年', '公開公報 全文', '共同出願分析 CF-0009']
  },
  {
    label: null,
    q: '狭隘部の配筋検査を省人化したい。',
    agent: '技術調査Agent',
    scope: '特許 156件・NETIS 48件・論文 74件を照合',
    evidence: 6,
    answer: '配筋検査の省人化には「画像認識」「写真測量」「ロボット搬送」の3系統があります。写真測量型はNETIS事後評価で検査時間40%短縮の実績があり、狭隘部に強いのは小型カメラの画像認識型です。',
    candidates: [
      { score: 81, scoreTone: 'green', name: '写真測量による配筋自動照合システム', meta: 'NETIS KT-220018-VE ／ 検査時間40%短縮', tag: 'NETIS', tone: 'green' },
      { score: 76, scoreTone: 'amber', name: '配筋検査AIカメラ（小型・狭隘部対応）', meta: '他社特許 ／ かぶり厚も同時計測', tag: '他社特許', tone: 'amber' },
      { score: 62, scoreTone: 'gray', name: 'ロボットアーム型検査装置', meta: '論文段階 ／ 実用化は2〜3年先の見込み', tag: '研究', tone: 'gray' }
    ],
    citations: ['NETIS KT-220018-VE 事後評価', 'JP7302211 請求項1', 'コンクリート工学年次論文 2025-V2-118']
  }
];

/** サイドバー「最近の会話」に出す会話（名前が付いているものだけ）。 */
export const RECENT_CONVERSATIONS = CONVERSATIONS
  .map((c, index) => ({ index, label: c.label }))
  .filter((c): c is { index: number; label: string } => c.label !== null);

/** Copilotホームの入力欄下に出す例示チップ。 */
export const PROMPT_CHIPS: Array<{ label: string; index: number }> = [
  { label: '狭隘部の配筋検査を省人化したい', index: 5 },
  { label: 'この発明届に似た特許はある？', index: 2 },
  { label: '競合A社の最近の出願動向は？', index: 4 }
];

export function getConversation(raw: string | undefined): { index: number; convo: CopilotConversation } {
  const parsed = Number(raw);
  const index = Number.isInteger(parsed) && parsed >= 0 && parsed < CONVERSATIONS.length ? parsed : 0;
  return { index, convo: CONVERSATIONS[index]! };
}

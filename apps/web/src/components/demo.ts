// デザインB（design-B-copilot.dc.html）のデモデータ。
// MVP環境の画面はこのデータで描画する（本番は各テーブルに置き換える）。
// 注記・原則（「AIは決めません」「必ず根拠が付く」等）はデザインの意図なので消さないこと。

export const CITE_BODY =
  '原文の該当箇所（ダミー抜粋）:「…水中における函体の位置決めにおいて、音響測位手段と衛星測位手段とを併用し、函体の姿勢情報をリアルタイムに算出する…」。引用文は原文から機械的に切り出されます。AIが引用文を生成することはありません。';

export type ConvoCandidate = {
  score: number; tone: string; name: string; meta: string;
  tag: string; tagFg: string; tagBg: string;
};

export type Convo = {
  label: string | null; q: string; agent: string; scope: string; evidence: number;
  answer: string; candidates: ConvoCandidate[]; citations: string[];
};

export const CONVOS: Convo[] = [
  {
    label: null,
    q: '軟弱地盤で重機が沈下する。作業ヤードも狭い。使える工法はある？',
    agent: 'Civil Engineer Agent', scope: '特許 214件・NETIS 48件・自社技術 8件を照合', evidence: 12,
    answer: '軟弱地盤・狭隘ヤードの条件に合う候補を3件見つけました。いずれも地盤改良を先行せずに施工できる点が共通です。現場条件（地耐力・ヤード寸法）を登録すると、適用スコアの精度が上がります。',
    candidates: [
      { score: 82, tone: '#1F8255', name: '超軽量敷鉄板レス地盤支持マット工法', meta: 'NETIS登録・事後評価あり ／ 地耐力30kN/m²から適用', tag: 'NETIS', tagFg: '#1F8255', tagBg: '#E4F3EC' },
      { score: 74, tone: '#B5701A', name: '狭隘地対応ミニクローラクレーン工法', meta: '他社特許（実施許諾の可能性あり） ／ ヤード幅6mから', tag: '他社特許', tagFg: '#B5701A', tagBg: '#FDEFE0' },
      { score: 68, tone: '#B5701A', name: '自社開発・軽量盛土による仮設路盤', meta: '自社技術台帳 T-0038 ／ 東北支店で施工実績2件', tag: '自社技術', tagFg: '#2E5AAC', tagBg: '#E9F0FB' }
    ],
    citations: ['JP7234567 請求項1', 'NETIS KT-230045-VE 事後評価', '土木学会論文集 2025-B3-042 §4.2', '自社技術台帳 T-0038']
  },
  {
    label: 'ケーソン据付の自動化技術',
    q: '港湾のケーソン据付を自動化したい。使える技術をまとめて。',
    agent: '技術調査Agent', scope: '特許 214件・NETIS 48件・論文 96件を照合', evidence: 9,
    answer: '据付の「位置決め」「誘導」「姿勢制御」の3工程それぞれに候補が見つかりました。NETIS登録の誘導システムは事後評価で据付精度±5cmの実績があります。2件は他社特許のため、導入にはライセンス確認が必要です。',
    candidates: [
      { score: 85, tone: '#1F8255', name: 'ケーソン据付誘導システム（自動追尾TS併用）', meta: 'NETIS KT-230045-VE ／ 据付精度±5cm・省人化20%', tag: 'NETIS', tagFg: '#1F8255', tagBg: '#E4F3EC' },
      { score: 76, tone: '#B5701A', name: '水中構造物の据付誘導装置（音響測位併用）', meta: '東亜建設工業の特許 ／ 濁水中でも使用可能', tag: '他社特許', tagFg: '#B5701A', tagBg: '#FDEFE0' },
      { score: 71, tone: '#B5701A', name: '函体姿勢制御用バラスト注水制御装置', meta: '五洋建設の特許 ／ 沈設中の姿勢を自動保持', tag: '他社特許', tagFg: '#B5701A', tagBg: '#FDEFE0' }
    ],
    citations: ['JP7234567 請求項1', 'JP7198221 請求項1・3', 'NETIS KT-230045-VE 事後評価', 'JP730198 明細書 §0021']
  },
  {
    label: '浚渫土の改良材、既存特許との違い',
    q: '発明届「浚渫土の高含水比改良材の配合」は、既存特許とどこが違う？',
    agent: 'Claim Agent', scope: '類似特許 6件と構成要件を突き合わせ', evidence: 7,
    answer: '最も近いJP6891234と構成要件5件を比較しました。「同じ」2件・「似ている」1件・「違う」2件です。違いは改良材の配合比の範囲と、混合撹拌の工程順にあります。この2点が新規性の主張候補です（判断は知財部門が行います）。',
    candidates: [
      { score: 72, tone: '#B5701A', name: 'JP6891234「高含水比土の固化処理材」', meta: '構成要件5件中: 同じ2・似ている1・違う2 ／ 類似度は目印です', tag: '他社特許', tagFg: '#B5701A', tagBg: '#FDEFE0' },
      { score: 58, tone: '#5A6678', name: 'JP7011876「浚渫土の再資源化処理方法」', meta: '構成要件5件中: 同じ1・似ている2・違う2', tag: '他社特許', tagFg: '#B5701A', tagBg: '#FDEFE0' },
      { score: 41, tone: '#5A6678', name: 'JP6755432「泥土の脱水固化システム」', meta: '工程構成が異なる（脱水先行型）', tag: '参考', tagFg: '#5A6678', tagBg: '#F2F4F8' }
    ],
    citations: ['JP6891234 請求項1', 'JP7011876 請求項1・4', '発明届 INV-24 構成要件表', 'Claim Chart CC-0112']
  },
  {
    label: '無人化法面吹付のNETIS事後評価',
    q: '無人化法面吹付工法のNETIS事後評価の内容を教えて。',
    agent: '技術調査Agent', scope: 'NETIS 48件・公開施工事例 32件を照合', evidence: 5,
    answer: 'NETIS KT-210033-VEの事後評価では、省人化30%・法面での墜落災害リスクの低減が確認されています。適用条件は法面勾配1:0.8まで。東北支店の導入審査（承認済）でもこの評価値が根拠に使われました。',
    candidates: [
      { score: 88, tone: '#1F8255', name: '無人化法面吹付工法（遠隔操作式）', meta: 'NETIS KT-210033-VE ／ 省人化30%・墜落リスク低減', tag: 'NETIS', tagFg: '#1F8255', tagBg: '#E4F3EC' },
      { score: 69, tone: '#B5701A', name: '法面吹付ノズルの角度自動調整機構', meta: '自社発明届（出願決定） ／ 上記工法の改良発明', tag: '自社発明', tagFg: '#6B45B0', tagBg: '#EDE7F6' }
    ],
    citations: ['NETIS KT-210033-VE 事後評価', '公開施工事例 CS-0271', '発明届 INV-19']
  },
  {
    label: '競合A社の直近1年の出願',
    q: '競合A社の直近1年の出願動向をまとめて。',
    agent: 'Competitor Agent', scope: '競合A社の公開特許 38件を分析', evidence: 15,
    answer: '直近1年の公開出願は38件で前年比+27%です。ケーソン据付関連（8件）と水中ドローン点検（6件）に集中しており、当社の調査案件「ケーソン据付自動化」と重なる領域が拡大しています。ウォッチの重要度「高」2件はこのクラスタです。',
    candidates: [
      { score: 8, tone: '#C5392F', name: 'ケーソン据付・函体沈設クラスタ', meta: '前年3件→8件に増加 ／ 当社調査案件と重複', tag: '要注視', tagFg: '#C5392F', tagBg: '#FCE9E7' },
      { score: 6, tone: '#B5701A', name: '水中ドローン・点検クラスタ', meta: '新規参入領域 ／ 大学との共同出願2件を含む', tag: '新興', tagFg: '#B5701A', tagBg: '#FDEFE0' },
      { score: 4, tone: '#5A6678', name: 'ICT土工・転圧管理クラスタ', meta: '横ばい ／ 当社導入済み技術と競合', tag: '継続', tagFg: '#5A6678', tagBg: '#F2F4F8' }
    ],
    citations: ['出願人分析 A社 2025-08〜2026-08', 'JP2026-101234 公開公報', '共同出願分析 CF-0009']
  },
  {
    label: null,
    q: '狭隘部の配筋検査を省人化したい。',
    agent: '技術調査Agent', scope: '特許 156件・NETIS 48件・論文 74件を照合', evidence: 6,
    answer: '配筋検査の省人化には「画像認識」「写真測量」「ロボット搬送」の3系統があります。写真測量型はNETIS事後評価で検査時間40%短縮の実績があり、狭隘部に強いのは小型カメラの画像認識型です。',
    candidates: [
      { score: 81, tone: '#1F8255', name: '写真測量による配筋自動照合システム', meta: 'NETIS KT-220018-VE ／ 検査時間40%短縮', tag: 'NETIS', tagFg: '#1F8255', tagBg: '#E4F3EC' },
      { score: 76, tone: '#B5701A', name: '配筋検査AIカメラ（小型・狭隘部対応）', meta: '他社特許 ／ かぶり厚も同時計測', tag: '他社特許', tagFg: '#B5701A', tagBg: '#FDEFE0' },
      { score: 62, tone: '#5A6678', name: 'ロボットアーム型検査装置', meta: '論文段階 ／ 実用化は2〜3年先の見込み', tag: '研究', tagFg: '#5A6678', tagBg: '#F2F4F8' }
    ],
    citations: ['NETIS KT-220018-VE 事後評価', 'JP7302211 請求項1', 'コンクリート工学年次論文 2025-V2-118']
  }
];

export type Agent = { label: string; state: string; dot: string; desc: string; href: string };

const AGENT_SLUG: Record<string, string> = {
  技術調査Agent: 'tech-research', 'Patent Search Agent': 'patent-search', 'Claim Agent': 'claim',
  'Examiner Agent': 'examiner', 'Civil Engineer Agent': 'civil-engineer', 'Competitor Agent': 'competitor',
  'Landscape Agent': 'landscape', 'R&D Agent': 'rnd', 'Licensing Agent': 'licensing',
  'Legal Agent': 'legal', 'Report Agent': 'report'
};

export const AGENTS: Agent[] = [
  { label: '技術調査Agent', state: '待機', dot: '#2E9E6B', desc: '自社技術・NETIS登録技術を横断調査', href: `/ai-assistant/agents/${AGENT_SLUG['技術調査Agent']}` },
  { label: 'Patent Search Agent', state: '実行中', dot: '#6B45B0', desc: '先行技術調査案件の検索式・状況', href: `/ai-assistant/agents/${AGENT_SLUG['Patent Search Agent']}` },
  { label: 'Claim Agent', state: '待機', dot: '#2E9E6B', desc: '他社特許 vs 自社案の構成要件比較', href: `/ai-assistant/agents/${AGENT_SLUG['Claim Agent']}` },
  { label: 'Examiner Agent', state: '待機', dot: '#2E9E6B', desc: 'AI模擬審査（新規性・進歩性リスク）', href: `/ai-assistant/agents/${AGENT_SLUG['Examiner Agent']}` },
  { label: 'Civil Engineer Agent', state: '実行中', dot: '#6B45B0', desc: '現場適用性スコアリング', href: `/ai-assistant/agents/${AGENT_SLUG['Civil Engineer Agent']}` },
  { label: 'Competitor Agent', state: '待機', dot: '#2E9E6B', desc: '競合企業の動向モニタリング', href: `/ai-assistant/agents/${AGENT_SLUG['Competitor Agent']}` },
  { label: 'Landscape Agent', state: '待機', dot: '#2E9E6B', desc: '特許ランドスケープ（国別・出願人別）', href: `/ai-assistant/agents/${AGENT_SLUG['Landscape Agent']}` },
  { label: 'R&D Agent', state: '待機', dot: '#2E9E6B', desc: '社内研究者・発明者の知見', href: `/ai-assistant/agents/${AGENT_SLUG['R&D Agent']}` },
  { label: 'Licensing Agent', state: '待機', dot: '#2E9E6B', desc: 'ライセンスIN/OUT案件の評価', href: `/ai-assistant/agents/${AGENT_SLUG['Licensing Agent']}` },
  { label: 'Legal Agent', state: '待機', dot: '#2E9E6B', desc: '人間確認必須案件の法務・コンプライアンス確認', href: `/ai-assistant/agents/${AGENT_SLUG['Legal Agent']}` },
  { label: 'Report Agent', state: '待機', dot: '#2E9E6B', desc: '各種レポートの出力履歴', href: `/ai-assistant/agents/${AGENT_SLUG['Report Agent']}` }
];

export type Axis = { axis: string; kind: string; val: number; weight: number; basis: string; cite: string };

export const AXES: Axis[] = [
  { axis: '工種適合性', kind: '規則', val: 0.85, weight: 20, basis: '港湾・防波堤の水中コンクリート工に工種一致（技術台帳の適用工種と現場工種の照合）', cite: '技術台帳 T-0102 適用工種表' },
  { axis: '地盤・地形', kind: '規則', val: 0.80, weight: 15, basis: '水深12m・砂質地盤は適用範囲内（適用条件: 水深20m以内）', cite: 'NETIS 登録情報 適用条件' },
  { axis: '気象・海象', kind: 'AI推定', val: 0.65, weight: 15, basis: '波高1.5m超の日が月間8日。類似現場の施工実績から中断リスクを推定', cite: '類似現場 施工報告 3件' },
  { axis: '安全性', kind: 'AI推定', val: 0.82, weight: 15, basis: '潜水士作業の削減効果あり。無人化施工の類似事例3件を参照', cite: '公開施工事例 CS-0271 ほか' },
  { axis: '品質', kind: '規則', val: 0.78, weight: 10, basis: '水中不分離性の品質規格（JSCE-D104）に適合', cite: 'JSCE-D104 適合試験成績書' },
  { axis: '環境・CO₂', kind: 'AI推定', val: 0.70, weight: 10, basis: '材料使用量の削減見込み。CO₂原単位は類似工法比で推定', cite: '環境評価シート（推定）' },
  { axis: '生産性・省人化', kind: '規則', val: 0.88, weight: 10, basis: 'NETIS事後評価で省人化30%の実績値', cite: 'NETIS KT-230045-VE 事後評価' },
  { axis: '導入難易度', kind: 'AI推定', val: 0.60, weight: 5, basis: '専用打設船の調達リードタイム3ヶ月が制約', cite: '調達部門ヒアリング記録' }
];

export type RowDetail = {
  title?: string;
  tag?: string; tagFg?: string; tagBg?: string;
  meta?: Array<[string, string]>; body?: string; citations?: string[];
  note?: string; actions?: Array<{ label: string; href?: string; primary?: boolean }>;
};

export type InvestRow = {
  f: string; st: string; stFg: string; stBg: string; title: string; meta: string;
  pct: number | null; ev: number; owner: string; note?: string; detail: RowDetail;
};

export const INVEST: InvestRow[] = [
  {
    f: 'active', st: '実行中', stFg: '#6B45B0', stBg: '#EDE7F6', title: 'ケーソン据付自動化の横断調査',
    meta: '対象: 特許・NETIS・論文 ・ 検索式 (ケーソン OR 函体) AND (据付 OR 沈設)…', pct: 64, ev: 38, owner: '担当 佐藤 ・ 8/23 更新',
    detail: {
      tag: '実行中', tagFg: '#6B45B0', tagBg: '#EDE7F6',
      meta: [['対象', '特許・NETIS・論文'], ['進捗', '64%（特許214件を精査中）'], ['根拠', '38件'], ['担当', '佐藤 健一'], ['開始', '8/21']],
      body: 'AIが検索式を組み立て、ヒットした文献を関連度順に精査しています。完了後は重要文献ランキングの人の確認ステップに進みます。',
      citations: ['検索式 Q-0118', '中間ランキング（暫定）'],
      actions: [{ label: '中間結果を見る', primary: true }, { label: '検索式を直す' }, { label: '調査を停止' }]
    }
  },
  {
    f: 'active', st: '人の確認待ち', stFg: '#B5701A', stBg: '#FDEFE0', title: '浚渫土改良材の先行技術調査',
    meta: '対象: 特許・論文 ・ 検索式 (浚渫土 OR 高含水比) AND (改良材 OR 固化材)…', pct: null, ev: 52, owner: '担当 田中 ・ 8/22 更新',
    note: 'AIの調査結果がそろいました。重要文献ランキングの確認をお願いします。',
    detail: {
      tag: '人の確認待ち', tagFg: '#B5701A', tagBg: '#FDEFE0',
      meta: [['対象', '特許・論文'], ['状態', 'AI調査完了・人の確認待ち'], ['根拠', '52件'], ['担当', '田中 美咲'], ['期限', '8/29']],
      body: '重要文献ランキング上位10件の妥当性確認が必要です。確認が完了すると先行技術調査書の下書きが生成されます（生成物にも根拠が付きます）。',
      citations: ['重要文献ランキング（52件）', '検索式 Q-0114'],
      actions: [{ label: 'ランキングを確認する', primary: true }, { label: '発明届 INV-24 を開く', href: '/inventions' }]
    }
  },
  {
    f: 'active', st: '実行中', stFg: '#6B45B0', stBg: '#EDE7F6', title: '狭隘ヤード向け仮設路盤技術の類似技術調査',
    meta: '対象: NETIS・自社技術 ・ 検索式 (敷鉄板 OR 仮設路盤) AND (軽量 OR 省人化)…', pct: 22, ev: 9, owner: '担当 佐藤 ・ 8/23 更新',
    detail: {
      tag: '実行中', tagFg: '#6B45B0', tagBg: '#EDE7F6',
      meta: [['対象', 'NETIS・自社技術'], ['進捗', '22%'], ['根拠', '9件'], ['担当', '佐藤 健一']],
      body: 'Copilotの会話「軟弱地盤で重機が沈下…」から保存された調査案件です。',
      citations: ['元の会話ログ', '検索式 Q-0121'],
      actions: [{ label: '元の会話を開く', href: '/ai-assistant', primary: true }, { label: '調査を停止' }]
    }
  },
  {
    f: 'done', st: '完了', stFg: '#1F8255', stBg: '#E4F3EC', title: '鋼矢板腐食モニタリング 開放特許の導入前調査',
    meta: '対象: 特許・NETIS ・ 報告書 先行技術調査書 R-0087', pct: null, ev: 21, owner: '担当 高橋 ・ 8/15 完了',
    detail: {
      tag: '完了', tagFg: '#1F8255', tagBg: '#E4F3EC',
      meta: [['対象', '特許・NETIS'], ['成果物', '先行技術調査書 R-0087（PDF）'], ['根拠', '21件'], ['担当', '高橋 直樹'], ['完了', '8/15']],
      body: '開放特許の導入評価に向けた先行技術調査です。調査書はライセンス審査案件の添付資料になっています。',
      citations: ['先行技術調査書 R-0087'],
      actions: [{ label: '調査書を開く', href: '/reports', primary: true }, { label: '審査案件を見る', href: '/approvals' }]
    }
  }
];

export type InventRow = {
  name: string; inventor: string; stage: string; stFg: string; stBg: string;
  cls: string; clsFg: string; clsBg: string; exam: string; updated: string; detail: RowDetail;
};

export const INVENT: InventRow[] = [
  {
    name: '浚渫土の高含水比改良材の配合', inventor: '田中 美咲', stage: '技術レビュー', stFg: '#6B45B0', stBg: '#EDE7F6',
    cls: 'C4', clsFg: '#C5392F', clsBg: '#FCE9E7', exam: '拒絶リスク 中 ・ 根拠8件', updated: '8/22',
    detail: {
      tag: 'C4 機密', tagFg: '#C5392F', tagBg: '#FCE9E7',
      meta: [['発明届', 'INV-24'], ['発明者', '田中 美咲（04 技術・研究開発）'], ['段階', '技術レビュー（期限 9/5）'], ['AI模擬審査', '拒絶リスク 中']],
      body: 'AI模擬審査では、最も近いJP6891234に対して構成要件2件が一致。配合比の範囲と工程順の2点が差別化候補です。想定拒絶理由は進歩性（29条2項）が中心と推定されています。',
      citations: ['JP6891234 請求項1', '模擬審査レポート run-0128', '構成要件表'],
      note: '出願するかを決めるのは技術部門・知財部門・経営です。AIは決めません。',
      actions: [{ label: '技術レビューを開く', href: '/approvals', primary: true }, { label: 'Claim比較を見る', href: '/ai-assistant' }]
    }
  },
  {
    name: 'ケーソン据付誘導AIカメラ', inventor: '伊藤 彩', stage: '法務レビュー', stFg: '#B5701A', stBg: '#FDEFE0',
    cls: 'C4', clsFg: '#C5392F', clsBg: '#FCE9E7', exam: '拒絶リスク 低 ・ 根拠12件', updated: '8/21',
    detail: {
      tag: 'C4 機密', tagFg: '#C5392F', tagBg: '#FCE9E7',
      meta: [['発明届', 'INV-27'], ['発明者', '伊藤 彩（08 船舶事業部）'], ['段階', '法務レビュー（期限 9/12）'], ['AI模擬審査', '拒絶リスク 低']],
      body: '競合A社の新規公開出願（水中カメラ校正方法）との比較が推奨されています。法務レビューはConstruction-LegalOps-DXで進行中です。',
      citations: ['模擬審査レポート', 'JP2026-101234 公開公報'],
      actions: [{ label: '法務レビューを開く', href: '/approvals', primary: true }, { label: '競合出願と比較', href: '/watch' }]
    }
  },
  {
    name: '無人化法面吹付ノズルの角度自動調整機構', inventor: '鈴木 大輔', stage: '出願決定', stFg: '#1F8255', stBg: '#E4F3EC',
    cls: 'C3', clsFg: '#B5701A', clsBg: '#FDEFE0', exam: '完了 ・ 根拠15件', updated: '8/18',
    detail: {
      tag: '出願決定', tagFg: '#1F8255', tagBg: '#E4F3EC',
      meta: [['発明届', 'INV-19'], ['発明者', '鈴木 大輔（03 施工・作業所）'], ['段階', '出願決定（8/18 経営決裁）'], ['状態', '知財部門で明細書作成中']],
      body: '現場の工夫として登録され、AI整理→先行技術調査→技術・知財レビュー→経営決裁の全工程を通過した1件目の発明です。',
      citations: ['決裁記録 8/18', '先行技術調査書'],
      actions: [{ label: '明細書の進捗を見る', primary: true }]
    }
  },
  {
    name: '船上クレーンの動揺補償装置', inventor: '高橋 直樹', stage: '下書き', stFg: '#5A6678', stBg: '#F2F4F8',
    cls: 'C4', clsFg: '#C5392F', clsBg: '#FCE9E7', exam: '未実行', updated: '8/23',
    detail: {
      tag: '下書き', tagFg: '#5A6678', tagBg: '#F2F4F8',
      meta: [['発明届', 'INV-29（下書き）'], ['発明者', '高橋 直樹（08 船舶事業部）'], ['更新', '8/23']],
      body: 'まだAI整理を実行していません。「AI整理を実行」すると、構成要件の分解と類似特許の確認が自動で行われます（結果には根拠が付きます）。',
      actions: [{ label: 'AI整理を実行', primary: true }, { label: '下書きを編集' }]
    }
  }
];

export type ApproveRow = {
  f: string; kind: string; kindFg: string; kindBg: string; title: string; sub: string;
  due: string; dueColor: string; detail: RowDetail;
};

export const APPROVE: ApproveRow[] = [
  {
    f: 'tech', kind: '発明届', kindFg: '#6B45B0', kindBg: '#EDE7F6', title: '「浚渫土の高含水比改良材の配合」発明届',
    sub: '起案 田中 美咲 ・ 段階 技術レビュー ・ AI模擬審査 根拠8件', due: '期限 9/05', dueColor: '#5A6678',
    detail: {
      tag: '技術レビュー', tagFg: '#6B45B0', tagBg: '#EDE7F6',
      meta: [['種別', '発明届（INV-24）'], ['起案', '田中 美咲'], ['期限', '9/05'], ['AI模擬審査', '拒絶リスク 中・根拠8件']],
      body: '技術的な新規性・実施可能性の観点でレビューしてください。AI模擬審査の結果は参考情報であり、判断はレビュー担当者が行います。',
      citations: ['発明届 INV-24', '模擬審査レポート'],
      actions: [{ label: '承認して次へ', primary: true }, { label: '差し戻す' }, { label: '保留' }]
    }
  },
  {
    f: 'ip', kind: '技術導入', kindFg: '#2E5AAC', kindBg: '#E9F0FB', title: 'ICT盛土転圧管理システムの現場導入',
    sub: '起案 鈴木 大輔 ・ 段階 知財レビュー ・ 現場スコア 82 / 100', due: '8/21 超過', dueColor: '#C5392F',
    detail: {
      tag: '知財レビュー', tagFg: '#2E5AAC', tagBg: '#E9F0FB',
      meta: [['種別', '技術導入'], ['起案', '鈴木 大輔'], ['期限', '8/21（超過）'], ['現場スコア', '82 / 100']],
      body: '他社特許のライセンス条件（利用分野・地域）の確認が残っています。期限を超過しているため、優先対応をお願いします。',
      citations: ['ライセンス条件表', '現場適用性評価'],
      note: '期限超過 2日目です。',
      actions: [{ label: '承認して次へ', primary: true }, { label: '差し戻す' }, { label: '現場スコアを見る', href: '/field' }]
    }
  },
  {
    f: 'mine', kind: 'ライセンス', kindFg: '#B5701A', kindBg: '#FDEFE0', title: '開放特許「鋼矢板腐食モニタリング」導入評価',
    sub: '起案 高橋 直樹 ・ 段階 起案確認 ・ 調査報告 R-0087', due: '期限 8/28', dueColor: '#5A6678',
    detail: {
      tag: '起案確認', tagFg: '#B5701A', tagBg: '#FDEFE0',
      meta: [['種別', 'ライセンス（導入）'], ['起案', '高橋 直樹'], ['期限', '8/28'], ['添付', '先行技術調査書 R-0087']],
      body: '開放特許の導入評価です。ロイヤルティ条件と利用分野の確認後、法務レビューに進みます。',
      citations: ['先行技術調査書 R-0087'],
      actions: [{ label: '承認して次へ', primary: true }, { label: '差し戻す' }, { label: '調査書を開く', href: '/reports' }]
    }
  },
  {
    f: 'legal', kind: '発明届', kindFg: '#6B45B0', kindBg: '#EDE7F6', title: '「ケーソン据付誘導AIカメラ」発明届',
    sub: '起案 伊藤 彩 ・ 段階 法務レビュー ・ Construction-LegalOps-DX で審査中', due: '期限 9/12', dueColor: '#5A6678',
    detail: {
      tag: '法務レビュー', tagFg: '#6B45B0', tagBg: '#EDE7F6',
      meta: [['種別', '発明届（INV-27）'], ['起案', '伊藤 彩'], ['期限', '9/12'], ['連携', 'Construction-LegalOps-DX']],
      body: '正式な法務審査は別システム（Construction-LegalOps-DX）で行われます。このシステムは審査状況の表示と、法務に渡す資料の準備までを受け持ちます。',
      actions: [{ label: 'LegalOps-DXで開く', primary: true }, { label: '資料を確認' }]
    }
  },
  {
    f: 'mine', kind: '安全・品質・環境', kindFg: '#C5392F', kindBg: '#FCE9E7', title: '無人化法面吹付工法の東北支店導入 最終確認',
    sub: '起案 佐藤 健一 ・ 段階 導入可否判断（止める権限を持つ審査）', due: '期限 9/02', dueColor: '#5A6678',
    detail: {
      tag: 'SQE審査', tagFg: '#C5392F', tagBg: '#FCE9E7',
      meta: [['種別', '技術導入（最終確認）'], ['起案', '佐藤 健一'], ['期限', '9/02'], ['審査部門', '05 安全・品質・環境']],
      body: '安全・品質・環境部門による導入可否の最終判断です。この部門は導入を止める権限を持ちます。AIのスコアは判断を代替しません。',
      citations: ['NETIS KT-210033-VE 事後評価', '現場適用性評価'],
      actions: [{ label: '導入を承認', primary: true }, { label: '導入を止める' }, { label: '条件付き承認' }]
    }
  },
  {
    f: 'done', kind: '承認済', kindFg: '#1F8255', kindBg: '#E4F3EC', title: '無人化法面吹付工法を東北支店で導入',
    sub: '起案 佐藤 健一 ・ 経営会議 8/18 決裁 ・ アーカイブ', due: '完了 8/18', dueColor: '#1F8255',
    detail: {
      tag: '承認済', tagFg: '#1F8255', tagBg: '#E4F3EC',
      meta: [['種別', '技術導入'], ['決裁', '経営会議 8/18'], ['状態', '導入準備中']],
      body: '全レビュー工程を通過し、経営会議で決裁されました。承認履歴は監査ログから追跡できます。',
      actions: [{ label: '承認履歴を見る', href: '/audit', primary: true }]
    }
  }
];

export type WatchRow = {
  type: string; typeFg: string; typeBg: string; sev: string; sevFg: string; sevBg: string;
  title: string; sub: string; date: string; detail: RowDetail;
};

export const WATCH: WatchRow[] = [
  {
    type: '新規出願', typeFg: '#C5392F', typeBg: '#FCE9E7', sev: '高', sevFg: '#C5392F', sevBg: '#FCE9E7',
    title: '競合A社「函体沈設の遠隔操作システム」出願公開',
    sub: 'ウォッチ: 特許ウォッチ IPC E02D23/00 ・ 自社の調査案件「ケーソン据付自動化」に関連', date: '8/22',
    detail: {
      tag: '重要度 高', tagFg: '#C5392F', tagBg: '#FCE9E7',
      meta: [['種別', '新規出願（公開）'], ['出願人', '競合A社'], ['公報', 'JP2026-101234'], ['AI重要度', '高（当社調査案件と重複）']],
      body: '当社の調査案件「ケーソン据付自動化」および発明届INV-27と技術領域が重なります。構成要件の比較を推奨します。',
      citations: ['JP2026-101234 公開公報'],
      actions: [{ label: 'Claim比較を開く', href: '/ai-assistant', primary: true }, { label: '調査案件に追加', href: '/investigations' }]
    }
  },
  {
    type: '新規出願', typeFg: '#C5392F', typeBg: '#FCE9E7', sev: '高', sevFg: '#C5392F', sevBg: '#FCE9E7',
    title: '競合A社「据付誘導用の水中カメラ校正方法」出願公開',
    sub: 'ウォッチ: 競合企業ウォッチ ・ 自社発明届「ケーソン据付誘導AIカメラ」と要比較', date: '8/22',
    detail: {
      tag: '重要度 高', tagFg: '#C5392F', tagBg: '#FCE9E7',
      meta: [['種別', '新規出願（公開）'], ['出願人', '競合A社'], ['AI重要度', '高（自社発明届INV-27と近接）']],
      body: '自社発明届INV-27（法務レビュー中）と構成が近い可能性があります。知財部門への共有と比較検討を推奨します。',
      actions: [{ label: '発明届と比較', href: '/inventions', primary: true }, { label: '知財部門に共有' }]
    }
  },
  {
    type: '権利変化', typeFg: '#2E5AAC', typeBg: '#E9F0FB', sev: '中', sevFg: '#B5701A', sevBg: '#FDEFE0',
    title: 'ウォッチ中の特許 JP7198221 が登録査定',
    sub: 'ウォッチ: 特許ウォッチ ・ ライセンス候補として評価中の技術', date: '8/20',
    detail: {
      tag: '重要度 中', tagFg: '#B5701A', tagBg: '#FDEFE0',
      meta: [['種別', '権利状態変更'], ['特許', 'JP7198221（東亜建設工業）'], ['変化', '審査中 → 登録査定']],
      body: 'ライセンス候補として評価中の据付誘導装置が登録査定になりました。権利範囲が確定するため、ライセンス条件の再確認を推奨します。',
      actions: [{ label: '特許詳細を見る', href: '/search', primary: true }, { label: 'ライセンス評価を開く' }]
    }
  },
  {
    type: 'NETIS', typeFg: '#1F8255', typeBg: '#E4F3EC', sev: '低', sevFg: '#5A6678', sevBg: '#F2F4F8',
    title: '法面吹付関連の新技術3件がNETIS登録',
    sub: 'ウォッチ: 技術分野ウォッチ「法面工」', date: '8/19',
    detail: {
      tag: '重要度 低', tagFg: '#5A6678', tagBg: '#F2F4F8',
      meta: [['種別', 'NETIS新規登録'], ['分野', '法面工'], ['件数', '3件']],
      body: '導入済みの無人化法面吹付工法の周辺技術です。次回の技術評価時に比較対象として参照できます。',
      actions: [{ label: 'NETIS検索で見る', href: '/search', primary: true }]
    }
  }
];

export type ReportRow = {
  f: string; name: string; kind: string; kindFg: string; kindBg: string; fmt: string;
  author: string; date: string; status: string; stFg: string; stBg: string; detail: RowDetail;
};

export const REPORT: ReportRow[] = [
  {
    f: 'prior', name: '先行技術調査書 R-0087（鋼矢板腐食モニタリング）', kind: '先行技術調査書', kindFg: '#2E5AAC', kindBg: '#E9F0FB',
    fmt: 'PDF', author: '高橋 直樹', date: '8/15', status: '確定', stFg: '#1F8255', stBg: '#E4F3EC',
    detail: {
      tag: '確定', tagFg: '#1F8255', tagBg: '#E4F3EC',
      meta: [['番号', 'R-0087'], ['種類', '先行技術調査書'], ['形式', 'PDF'], ['作成', '高橋 直樹（8/15）'], ['根拠', '21件']],
      body: '開放特許の導入評価に向けた先行技術調査書です。本文中のすべてのAI生成箇所に出典が付いています。',
      citations: ['調査案件 IV-0042'],
      note: '社外に出す場合は技術部門の確認が必要です。',
      actions: [{ label: 'PDFを開く（ダミー）', primary: true }, { label: '調査案件を見る', href: '/investigations' }]
    }
  },
  {
    f: 'comp', name: '競合A社 出願動向分析（2025下期〜2026上期）', kind: '競合分析', kindFg: '#6B45B0', kindBg: '#EDE7F6',
    fmt: 'DOCX', author: '佐藤 健一', date: '8/21', status: '下書き', stFg: '#5A6678', stBg: '#F2F4F8',
    detail: {
      tag: '下書き', tagFg: '#5A6678', tagBg: '#F2F4F8',
      meta: [['種類', '競合分析'], ['形式', 'DOCX'], ['作成', '佐藤 健一（8/21）'], ['元データ', 'Competitor Agent run-0127']],
      body: 'Copilotの会話「競合A社の直近1年の出願」から生成された下書きです。確定前に数値と出典の確認が必要です。',
      citations: ['run-0127（根拠15件）'],
      actions: [{ label: '下書きを編集', primary: true }, { label: '元の会話を開く', href: '/ai-assistant' }]
    }
  },
  {
    f: 'field', name: '現場適用性評価（新潟東港 防波堤改良）', kind: '現場適用性評価', kindFg: '#1F8255', kindBg: '#E4F3EC',
    fmt: 'PDF', author: '佐藤 健一', date: '8/20', status: '確定', stFg: '#1F8255', stBg: '#E4F3EC',
    detail: {
      tag: '確定', tagFg: '#1F8255', tagBg: '#E4F3EC',
      meta: [['種類', '現場適用性評価'], ['形式', 'PDF'], ['作成', '佐藤 健一（8/20）'], ['スコア', '78 / 100（8軸内訳付き）']],
      body: '水中不分離コンクリート自動打設工法の適用性評価レポートです。スコア単独ではなく必ず軸別内訳と注記が併記されます。',
      actions: [{ label: 'PDFを開く（ダミー）', primary: true }, { label: 'スコア画面を見る', href: '/field' }]
    }
  },
  {
    f: 'exec', name: '技術・知財 月次経営サマリー（2026年7月）', kind: '経営サマリー', kindFg: '#B5701A', kindBg: '#FDEFE0',
    fmt: 'PDF', author: '田中 美咲', date: '8/05', status: '確定', stFg: '#1F8255', stBg: '#E4F3EC',
    detail: {
      tag: '確定', tagFg: '#1F8255', tagBg: '#E4F3EC',
      meta: [['種類', '経営サマリー'], ['形式', 'PDF'], ['作成', '田中 美咲（8/05）'], ['宛先', '01 経営・統治・委員会']],
      body: '発明届の件数、調査案件の進捗、競合動向、ライセンス収支見込みをまとめた月次サマリーです。',
      actions: [{ label: 'PDFを開く（ダミー）', primary: true }]
    }
  }
];

export type AuditRow = {
  f: string; time: string; action: string; acFg: string; acBg: string; user: string;
  target: string; result: string; resFg: string; resBg: string; detail: RowDetail;
};

export const AUDIT: AuditRow[] = [
  {
    f: 'ai', time: '08-23 11:42', action: 'ai_run', acFg: '#6B45B0', acBg: '#EDE7F6', user: '佐藤 健一',
    target: 'Civil Engineer Agent（現場適用スコア）・根拠 12件', result: '成功', resFg: '#1F8255', resBg: '#E4F3EC',
    detail: {
      tag: 'ai_run', tagFg: '#6B45B0', tagBg: '#EDE7F6',
      meta: [['実行ID', 'run-0126'], ['ユーザー', '佐藤 健一'], ['モデル', 'Claude（推論）'], ['根拠', '12件（ai_citations）'], ['入力トークン', '48,211']],
      body: 'AI実行は必ずai_runsとai_citationsに記録されます。根拠が0件の成功実行は保存されません（invalid扱い）。',
      actions: [{ label: '実行結果を見る', href: '/field', primary: true }]
    }
  },
  {
    f: 'search', time: '08-23 11:38', action: 'search', acFg: '#2E5AAC', acBg: '#E9F0FB', user: '佐藤 健一',
    target: '横断検索「ケーソン 据付 自動化」', result: '成功', resFg: '#1F8255', resBg: '#E4F3EC',
    detail: {
      tag: 'search', tagFg: '#2E5AAC', tagBg: '#E9F0FB',
      meta: [['ユーザー', '佐藤 健一'], ['検索語', 'ケーソン 据付 自動化'], ['結果', '特許24・論文12・NETIS10・自社8']],
      body: '検索条件と結果件数が記録されます。権限条件はSQLのWHERE句で適用されるため、件数からも機密は漏れません。',
      actions: [{ label: '検索結果を見る', href: '/search', primary: true }]
    }
  },
  {
    f: 'all', time: '08-23 10:56', action: 'access_denied', acFg: '#C5392F', acBg: '#FCE9E7', user: '山田 太郎',
    target: '発明届 INV-24（C4・権限なし → 404）', result: '拒否', resFg: '#C5392F', resBg: '#FCE9E7',
    detail: {
      tag: 'access_denied', tagFg: '#C5392F', tagBg: '#FCE9E7',
      meta: [['ユーザー', '山田 太郎（07 支店）'], ['対象', '発明届 INV-24（C4）'], ['応答', '404 Not Found']],
      body: '行レベル権限がない場合は403ではなく404を返します。C3/C4のデータは「存在すること自体」を見せません。拒否操作も監査ログに記録されます。',
      actions: [{ label: '権限設定を見る', href: '/admin', primary: true }]
    }
  },
  {
    f: 'export', time: '08-23 10:12', action: 'export', acFg: '#B5701A', acBg: '#FDEFE0', user: '高橋 直樹',
    target: '先行技術調査書 R-0087（PDF）', result: '成功', resFg: '#1F8255', resBg: '#E4F3EC',
    detail: {
      tag: 'export', tagFg: '#B5701A', tagBg: '#FDEFE0',
      meta: [['ユーザー', '高橋 直樹'], ['対象', 'R-0087（PDF）'], ['機密区分', 'C2']],
      body: 'Export操作はすべて記録されます。C2以上の資料を社外に出す場合は技術部門の確認が必要です。',
      actions: [{ label: 'レポートを見る', href: '/reports', primary: true }]
    }
  },
  {
    f: 'login', time: '08-23 09:03', action: 'user_login', acFg: '#1F8255', acBg: '#E4F3EC', user: '佐藤 健一',
    target: 'SSO + MFA（Cloudflare Access）', result: '成功', resFg: '#1F8255', resBg: '#E4F3EC',
    detail: {
      tag: 'user_login', tagFg: '#1F8255', tagBg: '#E4F3EC',
      meta: [['ユーザー', '佐藤 健一'], ['方式', 'SSO + MFA'], ['IP', '203.0.113.24（社内）']],
      body: 'ログインはCloudflare Access（SSO+MFA）を経由します。MVP環境ではデモログインに置き換えられています。'
    }
  },
  {
    f: 'login', time: '08-23 08:47', action: 'user_login_failed', acFg: '#C5392F', acBg: '#FCE9E7', user: '不明（外部IP）',
    target: 'MFA失敗 3回 → ブロック', result: '拒否', resFg: '#C5392F', resBg: '#FCE9E7',
    detail: {
      tag: 'user_login_failed', tagFg: '#C5392F', tagBg: '#FCE9E7',
      meta: [['ユーザー', '不明'], ['IP', '198.51.100.7（外部）'], ['措置', '3回失敗で自動ブロック']],
      body: 'セキュリティイベントとして記録され、管理者に通知されています。',
      actions: [{ label: 'セキュリティイベント一覧', primary: true }]
    }
  }
];

export const ADMIN_USERS = [
  { name: '佐藤 健一', dept: '04 技術・研究開発', role: 'R&D', roleFg: '#E08A2B', roleBd: 'rgba(224,138,43,.4)' },
  { name: '田中 美咲', dept: '04 技術・研究開発', role: 'R&D', roleFg: '#E08A2B', roleBd: 'rgba(224,138,43,.4)' },
  { name: '鈴木 大輔', dept: '03 施工・調達・作業所', role: 'SITE', roleFg: '#2E5AAC', roleBd: '#C9D7EC' },
  { name: '伊藤 彩', dept: '05 安全・品質・環境', role: 'SQE（止める権限）', roleFg: '#C5392F', roleBd: '#F0C4C0' },
  { name: '高橋 直樹', dept: '06 管理本部・経営企画', role: 'ADMIN', roleFg: '#6B45B0', roleBd: '#D8CCEE' }
];

export const ADMIN_SYSTEM_STATUS = [
  { label: 'Web（Cloudflare Pages）', value: '正常', color: '#1F8255', dot: '#2E9E6B' },
  { label: 'データベース（Neon）', value: '正常', color: '#1F8255', dot: '#2E9E6B' },
  { label: 'AI実行（Claude API）', value: '正常', color: '#1F8255', dot: '#2E9E6B' },
  { label: 'DLQ（失敗ジョブ）', value: '1件 要調査', color: '#B5701A', dot: '#E08A2B', href: '/admin/status' }
];

export const ADMIN_RUNBOOK = [
  { label: '根拠なし成功実行', value: '0 件', color: '#1F8255' },
  { label: 'AIトークン消費（月次予算比）', value: '42%', color: '#5A6678' },
  { label: '最終バックアップ', value: '08-23 03:00', color: '#5A6678' }
];

export const ADMIN_SETTINGS = [
  { label: 'AIモデル設定', href: '/admin/settings?group=ai-model' },
  { label: 'Agent設定', href: '/admin/settings?group=agent' },
  { label: 'API設定', href: '/admin/settings?group=api' },
  { label: '外部データ連携', href: '/admin/settings?group=integration' },
  { label: '通知設定', href: '/admin/settings?group=notification' },
  { label: 'ワークフロー設定', href: '/admin/settings?group=workflow' },
  { label: 'マスタ設定', href: '/admin/settings?group=master' },
  { label: 'Feature Flags', href: '/admin/feature-flags' }
];

export const DASH_ROWS = [
  { kind: '発明届', kindFg: '#6B45B0', kindBg: '#EDE7F6', title: '「浚渫土の高含水比改良材の配合」発明届', stage: '技術レビュー', due: '9/05', dueColor: '#5A6678', href: '/approvals' },
  { kind: '技術導入', kindFg: '#2E5AAC', kindBg: '#E9F0FB', title: 'ICT盛土転圧管理システムの現場導入', stage: '知財レビュー', due: '8/21 超過', dueColor: '#C5392F', href: '/approvals' },
  { kind: 'ライセンス', kindFg: '#B5701A', kindBg: '#FDEFE0', title: '開放特許「鋼矢板腐食モニタリング」導入評価', stage: '起案確認', due: '8/28', dueColor: '#5A6678', href: '/approvals' },
  { kind: '安全・品質・環境', kindFg: '#C5392F', kindBg: '#FCE9E7', title: '無人化法面吹付工法の東北支店導入 最終確認', stage: '導入可否判断', due: '9/02', dueColor: '#5A6678', href: '/approvals' }
];

export const DASH_WATCH = [
  { tag: '新規出願', tagFg: '#C5392F', tagBg: '#FCE9E7', text: '競合A社がケーソン据付関連で2件出願', href: '/watch' },
  { tag: '権利変化', tagFg: '#2E5AAC', tagBg: '#E9F0FB', text: 'ウォッチ中の特許1件が登録査定', href: '/watch' },
  { tag: 'NETIS', tagFg: '#1F8255', tagBg: '#E4F3EC', text: '法面吹付関連の新技術3件が登録', href: '/watch' }
];

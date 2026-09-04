// サイドバー全項目の単一の真実（Sidebarのアコーディオン描画・検索フィルタ・
// ルート存在確認のいずれもこのファイルを参照する）。

export type NavLeaf = { label: string; href: string };
export type NavGroup = { label: string; children: NavLeaf[] };
export type NavItem = NavLeaf | NavGroup;
export type NavSection = { key: string; icon: string; label: string; items: NavItem[] };

// ---- デザインB（AI対話型）のサイドバー構造 ----
export type PrimaryNavItem = { icon: string; label: string; href: string };
export type TaskNavItem = { icon: string; label: string; href: string; count?: number };

/** 主要メニュー（サイドバー上部） */
export const PRIMARY_NAV: PrimaryNavItem[] = [
  { icon: '🧠', label: 'Copilot に聞く', href: '/ai-assistant' },
  { icon: '📊', label: 'ダッシュボード', href: '/dashboard' },
  { icon: '🔎', label: '横断検索', href: '/search' }
];

/** 会話から始まる仕事（タスクナビ） */
export const TASK_NAV: TaskNavItem[] = [
  { icon: '🏗️', label: '現場の困りごと', href: '/field', count: 4 },
  { icon: '🔬', label: '調査案件', href: '/investigations', count: 3 },
  { icon: '🚀', label: '発明・出願', href: '/inventions', count: 4 },
  { icon: '✅', label: '承認・レビュー', href: '/approvals', count: 5 },
  { icon: '👁️', label: 'ウォッチ・アラート', href: '/watch', count: 7 },
  { icon: '📊', label: 'レポート', href: '/reports' },
  { icon: '🛡️', label: 'セキュリティ・監査', href: '/audit' },
  { icon: '⚙️', label: 'システム管理', href: '/admin' }
];

/** 最近の会話（デモデータ。実装後は会話履歴テーブルに置き換える） */
export const RECENT_CONVOS: Array<{ label: string; href: string }> = [
  { label: 'ケーソン据付の自動化技術', href: '/ai-assistant' },
  { label: '浚渫土の改良材、既存特許との違い', href: '/ai-assistant' },
  { label: '無人化法面吹付のNETIS事後評価', href: '/ai-assistant' },
  { label: '競合A社の直近1年の出願', href: '/ai-assistant' }
];

/** ヘッダーのタイトル・サブタイトル（デザインBのTITLESに対応） */
export type RouteMeta = { title: string; subtitle: string };

const PRIMARY_ROUTE_META: Record<string, RouteMeta> = {
  '/ai-assistant': { title: 'Civil IP Copilot', subtitle: '普通の日本語で聞く。答えには必ず出どころが付く。決めるのは人。' },
  '/dashboard': { title: 'ダッシュボード', subtitle: '今日の動きと、あなたの対応が必要なこと' },
  '/search': { title: '横断検索', subtitle: '特許・論文・NETIS・自社技術をひとつの検索窓から' },
  '/field': { title: '現場適用性評価', subtitle: 'この現場で本当に使えるかを、点数と内訳で示します' },
  '/investigations': { title: '調査案件', subtitle: 'AIが調べ、人が確認する先行技術調査の一覧' },
  '/inventions': { title: '発明・出願', subtitle: '現場の工夫を発明として蓄え、出願は人が決める' },
  '/approvals': { title: '承認・レビュー', subtitle: 'あなたの対応が必要なワークフロー' },
  '/watch': { title: 'ウォッチ・アラート', subtitle: '競合・特許・NETISの動きを見張る' },
  '/reports': { title: 'レポート', subtitle: '調査・分析の出力履歴と新規作成' },
  '/audit': { title: 'セキュリティ・監査', subtitle: '誰が・いつ・何をしたかを追記専用ログで追跡する' },
  '/admin': { title: 'システム管理', subtitle: 'ユーザー・権限・稼働状態・設定の管理' },
  '/modules': { title: '全モジュール', subtitle: '構想中の20モジュール・全機能の一覧（青い項目は実装済み画面へ移動できます）' }
};

/** パス名からヘッダー表示用のタイトル/サブタイトルを解決する */
export function resolveRouteMeta(pathname: string): RouteMeta {
  const exact = PRIMARY_ROUTE_META[pathname];
  if (exact) return exact;

  // 主要ルートの配下（例 /approvals/[id]）は親のメタを継承
  const parents = Object.keys(PRIMARY_ROUTE_META)
    .filter(p => p !== '/admin' && pathname.startsWith(p + '/'))
    .sort((a, b) => b.length - a.length);
  const parent = parents[0];
  if (parent) {
    const meta = PRIMARY_ROUTE_META[parent];
    if (meta) return meta;
  }

  // 従来メニューの葉ラベルからタイトルを導出
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      const leaves = 'children' in item ? item.children : [item];
      for (const leaf of leaves) {
        const p = leaf.href.split('?')[0]!;
        if (p !== '/search' && p !== '/field' && p !== '/approvals' && p !== '/watch' && p !== '/reports' && p !== '/audit' && p !== '/admin' && p !== '/ai-assistant' && p !== '/dashboard' && p !== '/investigations' && p !== '/inventions' && (pathname === p || pathname.startsWith(p + '/'))) {
          return { title: leaf.label, subtitle: `${section.label} — 一覧・詳細` };
        }
      }
    }
  }
  return { title: pathname, subtitle: '' };
}

function isGroup(item: NavItem): item is NavGroup {
  return 'children' in item;
}

export function flattenLeaves(items: NavItem[]): NavLeaf[] {
  return items.flatMap(i => (isGroup(i) ? i.children : [i]));
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'search', icon: '🔎', label: '01. 統合検索',
    items: [
      { label: 'すべて検索', href: '/search' },
      { label: '特許検索', href: '/search?tab=patent' },
      { label: '技術検索', href: '/search?tab=tech' },
      { label: '論文・研究検索', href: '/search?tab=paper' },
      { label: 'NETIS検索', href: '/search?tab=netis' },
      { label: '出願人・企業検索', href: '/search/applicants' },
      { label: '発明者・研究者検索', href: '/search/researchers' },
      { label: 'IPC / CPC検索', href: '/search/ipc' },
      { label: 'Claim検索', href: '/search/claims' },
      { label: 'AI自然言語検索', href: '/search/nl' },
      { label: '類似技術検索', href: '/search/similar' },
      { label: '検索履歴・保存検索', href: '/search/history' }
    ]
  },
  {
    key: 'tech', icon: '💡', label: '02. 技術インテリジェンス',
    items: [
      { label: '技術一覧', href: '/tech' },
      { label: '工法一覧', href: '/tech/methods' },
      { label: '材料・製品', href: '/tech/materials' },
      { label: '建設機械・設備', href: '/tech/machinery' },
      { label: 'ICT施工', href: '/tech/ict' },
      { label: 'BIM / CIM', href: '/tech/bim-cim' },
      { label: 'AI・自動施工', href: '/tech/ai-construction' },
      { label: 'ロボティクス', href: '/tech/robotics' },
      { label: '技術比較', href: '/tech/compare' },
      { label: '類似技術', href: '/tech/similar' },
      { label: '技術評価', href: '/tech/evaluation' },
      { label: '技術関連マップ', href: '/tech/map' }
    ]
  },
  {
    key: 'patents', icon: '📜', label: '03. 特許インテリジェンス',
    items: [
      { label: '特許一覧', href: '/patents' },
      { label: '国内特許', href: '/patents/domestic' },
      { label: '海外特許', href: '/patents/foreign' },
      { label: '特許ファミリー', href: '/patents/families' },
      { label: '出願人分析', href: '/patents/applicants' },
      { label: '発明者分析', href: '/patents/inventors' },
      { label: 'IPC / CPC分析', href: '/patents/ipc' },
      { label: '引用・被引用', href: '/patents/citations' },
      { label: '権利状態', href: '/patents/status' },
      { label: '審査経過', href: '/patents/prosecution' },
      { label: '類似特許', href: '/patents/similar' },
      { label: 'お気に入り・ウォッチ', href: '/watch?kind=patent' }
    ]
  },
  {
    key: 'prior-art', icon: '🔬', label: '04. 先行技術調査',
    items: [
      { label: '新規調査', href: '/investigations/new' },
      { label: '調査案件一覧', href: '/investigations' },
      { label: '先行特許', href: '/investigations/prior-patents' },
      { label: '先行論文', href: '/investigations/prior-papers' },
      { label: 'NETIS・公開技術', href: '/netis' },
      { label: '類似技術調査', href: '/investigations/similar-tech' },
      { label: '構成要件別調査', href: '/investigations/by-element' },
      { label: 'FTO予備調査', href: '/fto' },
      { label: '引用文献分析', href: '/investigations/citation-analysis' },
      { label: '重要文献ランキング', href: '/investigations/ranking' },
      { label: '調査検索式', href: '/investigations/queries' },
      { label: '調査履歴', href: '/investigations/history' },
      { label: '調査レポート', href: '/reports?kind=investigation' }
    ]
  },
  {
    key: 'claims', icon: '🧩', label: '05. Claim解析',
    items: [
      { label: 'Claim解析', href: '/claims' },
      { label: '独立請求項', href: '/claims/independent' },
      { label: '従属請求項', href: '/claims/dependent' },
      { label: '構成要件分解', href: '/claims/elements' },
      { label: 'Claim Tree', href: '/claims/tree' },
      { label: 'Claim Chart', href: '/claims/chart' },
      { label: 'Claim Matrix', href: '/claims/matrix' },
      { label: '自社技術との比較', href: '/claims/vs-internal' },
      { label: '他社特許との比較', href: '/claims/vs-external' },
      { label: '複数特許比較', href: '/claims/multi-compare' },
      { label: '類似度分析', href: '/claims/similarity' },
      { label: '差分・特徴抽出', href: '/claims/diff' }
    ]
  },
  {
    key: 'examiner', icon: '🤖', label: '06. AI特許レビュー',
    items: [
      { label: 'AI Patent Examiner', href: '/examiner' },
      { label: '新規性レビュー', href: '/examiner/novelty' },
      { label: '進歩性レビュー', href: '/examiner/inventive-step' },
      { label: '記載要件レビュー', href: '/examiner/description' },
      { label: '明確性レビュー', href: '/examiner/clarity' },
      { label: '先行文献比較', href: '/examiner/prior-art-compare' },
      { label: '容易想到性分析', href: '/examiner/obviousness' },
      { label: '想定拒絶理由', href: '/examiner/rejection-grounds' },
      { label: '拒絶リスク評価', href: '/examiner/rejection-risk' },
      { label: '差別化ポイント', href: '/examiner/differentiation' },
      { label: '補正方向候補', href: '/examiner/amendment' },
      { label: '意見書論点候補', href: '/examiner/argument-points' },
      { label: 'AIレビュー履歴', href: '/ai-runs?kind=examine' }
    ]
  },
  {
    key: 'research', icon: '📚', label: '07. 論文・研究・NETIS',
    items: [
      { label: '論文', href: '/search?tab=paper' },
      { label: '学会資料', href: '/research/proceedings' },
      { label: '研究成果', href: '/research/results' },
      { label: '大学・研究機関', href: '/research/institutions' },
      { label: '研究者', href: '/research/researchers' },
      { label: 'NETIS', href: '/netis' },
      { label: '国交省技術資料', href: '/research/mlit' },
      { label: '公開施工事例', href: '/research/case-studies' },
      { label: '特許との関連', href: '/research/related-patents' },
      { label: '技術との関連', href: '/research/related-tech' },
      { label: '最新研究トレンド', href: '/research/trends' }
    ]
  },
  {
    key: 'field', icon: '🏗️', label: '08. 土木技術・現場適用',
    items: [
      { label: '土木技術分類', children: [
        { label: '港湾・海洋', href: '/tech/civil-category/port' },
        { label: '河川', href: '/tech/civil-category/river' },
        { label: '道路', href: '/tech/civil-category/road' },
        { label: '橋梁', href: '/tech/civil-category/bridge' },
        { label: 'トンネル', href: '/tech/civil-category/tunnel' },
        { label: '地盤・基礎', href: '/tech/civil-category/foundation' },
        { label: '土工', href: '/tech/civil-category/earthwork' },
        { label: '浚渫・埋立', href: '/tech/civil-category/dredging' },
        { label: 'コンクリート', href: '/tech/civil-category/concrete' },
        { label: '維持管理', href: '/tech/civil-category/maintenance' },
        { label: '補修・補強', href: '/tech/civil-category/repair' },
        { label: '防災', href: '/tech/civil-category/disaster-prevention' },
        { label: '環境', href: '/tech/civil-category/environment' }
      ]},
      { label: '現場条件入力', href: '/sites/new' },
      { label: '現場課題登録', href: '/sites' },
      { label: '適用技術検索', href: '/field' },
      { label: 'Field Applicability Score', href: '/field' },
      { label: '工種適合性', href: '/field/axis/work-type' },
      { label: '地盤・地形適合性', href: '/field/axis/ground' },
      { label: '気象・海象適合性', href: '/field/axis/weather' },
      { label: '安全性評価', href: '/field/axis/safety' },
      { label: '品質評価', href: '/field/axis/quality' },
      { label: 'CO₂・環境評価', href: '/field/axis/environment' },
      { label: '生産性・省人化評価', href: '/field/axis/productivity' },
      { label: '導入難易度評価', href: '/field/axis/difficulty' }
    ]
  },
  {
    key: 'landscape', icon: '🏢', label: '09. 競合・特許ランドスケープ',
    items: [
      { label: '競合企業', href: '/landscape/competitors' },
      { label: '企業別出願分析', href: '/landscape/by-company' },
      { label: '技術分野比較', href: '/landscape/by-field' },
      { label: '工種別比較', href: '/landscape/by-work-type' },
      { label: '出願推移', href: '/landscape/trend' },
      { label: '共同出願分析', href: '/landscape/co-filing' },
      { label: '大学連携分析', href: '/landscape/university-ties' },
      { label: '技術クラスタ', href: '/landscape/clusters' },
      { label: 'Patent Landscape', href: '/landscape' },
      { label: '技術マップ', href: '/landscape/map' },
      { label: '特許密度', href: '/landscape/density' },
      { label: '成長・衰退領域', href: '/landscape/growth' },
      { label: '新興技術', href: '/landscape/emerging' },
      { label: 'ホワイトスペース', href: '/landscape/whitespace' },
      { label: '自社ポジション', href: '/landscape/our-position' }
    ]
  },
  {
    key: 'rnd', icon: '🚀', label: '10. R&D・発明管理',
    items: [
      { label: 'R&Dダッシュボード', href: '/rnd' },
      { label: '研究テーマ', href: '/rnd/themes' },
      { label: '技術課題', href: '/rnd/challenges' },
      { label: '技術ニーズ', href: '/rnd/needs' },
      { label: 'PoC実験', href: '/rnd/poc' },
      { label: '発明アイデア', href: '/rnd/ideas' },
      { label: '発明届', href: '/inventions' },
      { label: '発明者', href: '/research/researchers' },
      { label: 'AI発明整理', href: '/rnd/ai-organize' },
      { label: 'Claim候補生成', href: '/rnd/claim-candidates' },
      { label: '先行技術調査', href: '/investigations' },
      { label: '発明評価', href: '/rnd/evaluation' },
      { label: 'ホワイトスペース候補', href: '/landscape/whitespace' },
      { label: '改良発明候補', href: '/rnd/improvement-candidates' },
      { label: '周辺発明候補', href: '/rnd/adjacent-candidates' },
      { label: '技術ロードマップ', href: '/rnd/roadmap' },
      { label: '出願候補', href: '/rnd/filing-candidates' }
    ]
  },
  {
    key: 'licensing', icon: '🤝', label: '11. ライセンス・知財ポートフォリオ',
    items: [
      { label: 'ライセンス候補', href: '/licensing/candidates' },
      { label: '開放特許', href: '/licensing/open-patents' },
      { label: '技術導入候補', href: '/licensing/inbound-candidates' },
      { label: '技術供与候補', href: '/licensing/outbound-candidates' },
      { label: 'ライセンサー', href: '/licensing/licensors' },
      { label: 'ライセンシー', href: '/licensing/licensees' },
      { label: '自社開発との比較', href: '/licensing/build-vs-buy' },
      { label: 'Buy / Build / Partner', href: '/licensing/strategy' },
      { label: 'ライセンス評価', href: '/licensing/evaluation' },
      { label: '自社特許一覧', href: '/licensing/portfolio' },
      { label: '審査中特許', href: '/licensing/portfolio/pending' },
      { label: '登録特許', href: '/licensing/portfolio/registered' },
      { label: '失効・放棄', href: '/licensing/portfolio/lapsed' },
      { label: '活用状況', href: '/licensing/portfolio/usage' },
      { label: '維持優先度', href: '/licensing/portfolio/priority' },
      { label: 'ライセンスアウト候補', href: '/licensing/outbound-candidates' }
    ]
  },
  {
    key: 'legal', icon: '⚖️', label: '12. 法務・知財レビュー',
    items: [
      { label: '法務審査依頼', href: '/legal/requests' },
      { label: '知財審査依頼', href: '/legal/ip-requests' },
      { label: '審査案件一覧', href: '/legal' },
      { label: 'NDA確認', href: '/legal/nda' },
      { label: '権利状態確認', href: '/patents/status' },
      { label: '独占 / 非独占', href: '/licensing/exclusivity' },
      { label: '利用分野', href: '/legal/field-of-use' },
      { label: '地域条件', href: '/legal/territory' },
      { label: '契約期間', href: '/legal/term' },
      { label: 'ロイヤルティ', href: '/legal/royalty' },
      { label: 'サブライセンス', href: '/legal/sublicense' },
      { label: '改良発明', href: '/rnd/improvement-candidates' },
      { label: '契約リスク', href: '/legal/risk' },
      { label: '法務確認事項', href: '/legal/checklist' },
      { label: 'Construction-LegalOps-DX連携', href: '/legal/legalops-link' }
    ]
  },
  {
    key: 'watch', icon: '👁️', label: '13. ウォッチ・モニタリング',
    items: [
      { label: 'マイウォッチ', href: '/watch' },
      { label: '特許ウォッチ', href: '/watch?kind=patent' },
      { label: '競合企業ウォッチ', href: '/watch?kind=competitor' },
      { label: '技術分野ウォッチ', href: '/watch?kind=technology' },
      { label: 'IPC / CPCウォッチ', href: '/watch?kind=ipc' },
      { label: '発明者ウォッチ', href: '/watch?kind=researcher' },
      { label: '論文ウォッチ', href: '/watch?kind=paper' },
      { label: 'NETISウォッチ', href: '/watch?kind=netis' },
      { label: '権利状態変更', href: '/watch/status-changes' },
      { label: '新規出願', href: '/watch/new-filings' },
      { label: '登録・拒絶・失効', href: '/watch/status-changes' },
      { label: 'AI重要度判定', href: '/watch/ai-priority' },
      { label: 'アラート一覧', href: '/watch/alerts' },
      { label: '週次AIダイジェスト', href: '/watch/digest' }
    ]
  },
  {
    key: 'ai', icon: '🧠', label: '14. AIアシスタント',
    items: [
      { label: 'Civil IP Copilot', href: '/ai-assistant' },
      { label: '技術調査Agent', href: '/ai-assistant/agents/tech-research' },
      { label: 'Patent Search Agent', href: '/ai-assistant/agents/patent-search' },
      { label: 'Research Agent', href: '/ai-assistant/agents/research' },
      { label: 'Claim Agent', href: '/ai-assistant/agents/claim' },
      { label: 'Examiner Agent', href: '/ai-assistant/agents/examiner' },
      { label: 'Competitor Agent', href: '/ai-assistant/agents/competitor' },
      { label: 'Landscape Agent', href: '/ai-assistant/agents/landscape' },
      { label: 'Civil Engineer Agent', href: '/ai-assistant/agents/civil-engineer' },
      { label: 'R&D Agent', href: '/ai-assistant/agents/rnd' },
      { label: 'Licensing Agent', href: '/ai-assistant/agents/licensing' },
      { label: 'Legal Agent', href: '/ai-assistant/agents/legal' },
      { label: 'Report Agent', href: '/ai-assistant/agents/report' },
      { label: 'Agent実行履歴', href: '/ai-runs' },
      { label: '自律調査ジョブ', href: '/ai-assistant/jobs' }
    ]
  },
  {
    key: 'knowledge', icon: '📖', label: '15. ナレッジ',
    items: [
      { label: '技術ナレッジ', href: '/knowledge?kind=tech' },
      { label: '特許ナレッジ', href: '/knowledge?kind=patent' },
      { label: '論文ナレッジ', href: '/knowledge?kind=paper' },
      { label: 'NETISナレッジ', href: '/knowledge?kind=netis' },
      { label: '過去調査', href: '/investigations' },
      { label: 'AIレビュー', href: '/ai-runs' },
      { label: '発明事例', href: '/inventions' },
      { label: 'ライセンス事例', href: '/licensing/candidates' },
      { label: '法務レビュー結果', href: '/legal' },
      { label: '施工事例', href: '/research/case-studies' },
      { label: 'FAQ', href: '/knowledge/faq' },
      { label: 'RAG検索', href: '/knowledge/rag' }
    ]
  },
  {
    key: 'reports', icon: '📊', label: '16. レポート',
    items: [
      { label: 'レポート作成', href: '/reports/new' },
      { label: '技術調査報告書', href: '/reports?kind=tech-survey' },
      { label: '特許調査報告書', href: '/reports?kind=patent-survey' },
      { label: '先行技術調査書', href: '/reports?kind=prior-art' },
      { label: 'Claim比較レポート', href: '/reports?kind=claim-compare' },
      { label: '新規性レビュー', href: '/reports?kind=novelty' },
      { label: '進歩性レビュー', href: '/reports?kind=inventive-step' },
      { label: 'AI模擬審査報告', href: '/reports?kind=ai-examine' },
      { label: '競合分析', href: '/reports?kind=competitor' },
      { label: 'Patent Landscape', href: '/reports?kind=landscape' },
      { label: 'ホワイトスペース分析', href: '/reports?kind=whitespace' },
      { label: '現場適用性評価', href: '/reports?kind=field-application' },
      { label: 'R&D提案', href: '/reports?kind=rnd' },
      { label: 'ライセンス評価', href: '/reports?kind=licensing' },
      { label: '経営サマリー', href: '/reports?kind=executive' },
      { label: '出力履歴', href: '/reports' }
    ]
  },
  {
    key: 'workflow', icon: '✅', label: '17. ワークフロー・承認',
    items: [
      { label: 'マイタスク', href: '/approvals?filter=mine' },
      { label: '承認待ち', href: '/approvals?filter=pending' },
      { label: '技術レビュー', href: '/approvals?filter=technical_review' },
      { label: '知財レビュー', href: '/approvals?filter=ip_review' },
      { label: '法務レビュー', href: '/approvals?filter=legal_review' },
      { label: '差戻案件', href: '/approvals?filter=rejected' },
      { label: '承認済', href: '/approvals?filter=approved' },
      { label: '保留', href: '/approvals?filter=hold' },
      { label: 'アーカイブ', href: '/approvals?filter=archived' },
      { label: 'コメント', href: '/workflow/comments' },
      { label: '承認履歴', href: '/workflow/history' }
    ]
  },
  {
    key: 'data', icon: '🗃️', label: '18. データ管理',
    items: [
      { label: 'データソース', href: '/data/sources' },
      { label: '特許データ', href: '/patents' },
      { label: '論文データ', href: '/search?tab=paper' },
      { label: 'NETISデータ', href: '/netis' },
      { label: '技術マスタ', href: '/data/masters/tech' },
      { label: 'IPC / CPCマスタ', href: '/data/masters/ipc' },
      { label: '土木工種マスタ', href: '/data/masters/work-type' },
      { label: '企業マスタ', href: '/data/masters/company' },
      { label: '発明者マスタ', href: '/data/masters/researcher' },
      { label: 'データクレンジング', href: '/data/cleansing' },
      { label: '名寄せ', href: '/data/dedup' },
      { label: '重複管理', href: '/data/duplicates' },
      { label: 'AI分類', href: '/data/ai-classification' },
      { label: 'データ品質', href: '/data/quality' },
      { label: 'Provenance / 出典', href: '/data/provenance' }
    ]
  },
  {
    key: 'admin', icon: '⚙️', label: '19. システム管理',
    items: [
      { label: 'ユーザー管理', href: '/admin/users' },
      { label: 'ロール・権限', href: '/admin/roles' },
      { label: '部門管理', href: '/admin/departments' },
      { label: 'プロジェクト権限', href: '/admin/project-permissions' },
      { label: 'AIモデル設定', href: '/admin/settings?group=ai-model' },
      { label: 'Agent設定', href: '/admin/settings?group=agent' },
      { label: 'API設定', href: '/admin/settings?group=api' },
      { label: '外部データ連携', href: '/admin/settings?group=integration' },
      { label: '通知設定', href: '/admin/settings?group=notification' },
      { label: 'ワークフロー設定', href: '/admin/settings?group=workflow' },
      { label: 'マスタ設定', href: '/admin/settings?group=master' },
      { label: 'バックアップ', href: '/admin/backup' },
      { label: 'システム状態', href: '/admin/status' },
      { label: 'Feature Flags', href: '/admin/feature-flags' }
    ]
  },
  {
    key: 'security', icon: '🛡️', label: '20. セキュリティ・監査',
    items: [
      { label: '監査ログ', href: '/audit' },
      { label: 'ログイン履歴', href: '/audit?action=login' },
      { label: 'AI利用履歴', href: '/audit?action=ai_run' },
      { label: '検索履歴', href: '/audit?action=search' },
      { label: 'データ閲覧履歴', href: '/audit?action=view' },
      { label: 'Export履歴', href: '/audit?action=export' },
      { label: '更新・削除履歴', href: '/audit?action=update' },
      { label: '承認履歴', href: '/workflow/history' },
      { label: '権限変更履歴', href: '/audit?action=role_change' },
      { label: 'セキュリティイベント', href: '/audit?action=security_event' },
      { label: 'データアクセス監査', href: '/audit?action=view' }
    ]
  }
];

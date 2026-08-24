// ヘッダーに出す画面名と一行説明。
//
// 作り込んだ12画面は設計案（design-B-copilot）の文言をそのまま使う。
// それ以外の約190ルートは nav.ts の項目名・セクション名から自動的に補う
// （nav.ts がサイドバー全項目の単一の真実なので、ここで別の一覧を持たない）。

import { NAV_SECTIONS, flattenLeaves } from './nav';

export type ScreenTitle = { title: string; subtitle: string };

const DESIGNED: Array<{ match: (path: string) => boolean; value: ScreenTitle }> = [
  {
    match: p => p === '/ai-assistant',
    value: { title: 'Civil IP Copilot', subtitle: '普通の日本語で聞く。答えには必ず出どころが付く。決めるのは人。' }
  },
  {
    match: p => p === '/dashboard',
    value: { title: 'ダッシュボード', subtitle: '今日の動きと、あなたの対応が必要なこと' }
  },
  {
    match: p => p === '/search',
    value: { title: '横断検索', subtitle: '特許・論文・NETIS・自社技術をひとつの検索窓から' }
  },
  {
    match: p => p === '/field' || p.startsWith('/field/'),
    value: { title: '現場適用性評価', subtitle: 'この現場で本当に使えるかを、点数と内訳で示します' }
  },
  {
    match: p => p === '/investigations',
    value: { title: '調査案件', subtitle: 'AIが調べ、人が確認する先行技術調査の一覧' }
  },
  {
    match: p => p === '/inventions',
    value: { title: '発明・出願', subtitle: '現場の工夫を発明として蓄え、出願は人が決める' }
  },
  {
    match: p => p === '/approvals',
    value: { title: '承認・レビュー', subtitle: 'あなたの対応が必要なワークフロー' }
  },
  {
    match: p => p === '/watch',
    value: { title: 'ウォッチ・アラート', subtitle: '競合・特許・NETISの動きを見張る' }
  },
  {
    match: p => p === '/reports',
    value: { title: 'レポート', subtitle: '調査・分析の出力履歴と新規作成' }
  },
  {
    match: p => p === '/audit',
    value: { title: 'セキュリティ・監査', subtitle: '誰が・いつ・何をしたかを追記専用ログで追跡する' }
  },
  {
    match: p => p === '/admin',
    value: { title: 'システム管理', subtitle: 'ユーザー・権限・稼働状態・設定の管理' }
  },
  {
    match: p => p === '/modules',
    value: { title: '全モジュール', subtitle: '構想している20モジュール・全機能の一覧' }
  }
];

type Resolved = { title: string; sectionLabel: string };

// nav.ts から「パス → 項目名・セクション名」を一度だけ組み立てる。
const FROM_NAV: Map<string, Resolved> = (() => {
  const map = new Map<string, Resolved>();
  for (const section of NAV_SECTIONS) {
    for (const leaf of flattenLeaves(section.items)) {
      const path = leaf.href.split('?')[0]!;
      // 同じパスが複数セクションから参照される場合は最初に出てきたものを採用する。
      if (!map.has(path)) map.set(path, { title: leaf.label, sectionLabel: section.label });
    }
  }
  return map;
})();

export function resolveScreenTitle(pathname: string): ScreenTitle {
  for (const d of DESIGNED) {
    if (d.match(pathname)) return d.value;
  }

  const exact = FROM_NAV.get(pathname);
  if (exact) return { title: exact.title, subtitle: exact.sectionLabel };

  // 詳細ページ（/patents/<id> など）は親のパスから引く。
  const parent = pathname.slice(0, pathname.lastIndexOf('/'));
  const fromParent = parent ? FROM_NAV.get(parent) : undefined;
  if (fromParent) return { title: fromParent.title, subtitle: `${fromParent.sectionLabel} ／ 詳細` };

  return { title: 'CTIIP', subtitle: '土木技術・知財インテリジェンス' };
}

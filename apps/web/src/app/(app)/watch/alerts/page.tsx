import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = {
  patent: '特許', competitor: '競合企業', technology: '技術分野',
  ipc: 'IPC/CPC', researcher: '発明者', paper: '論文', netis: 'NETIS'
};

// ウォッチ登録ラベルと候補データの名称が、互いの部分文字列として一致するかを判定する。
// 例：ウォッチラベル「北浜重工デモ株式会社の新規出願」と特許の出願人名「北浜重工デモ株式会社」
function isMatch(label: string, candidate: string): boolean {
  if (!label || !candidate) return false;
  return label.includes(candidate) || candidate.includes(label);
}

export default async function WatchAlertsPage() {
  const db = getDb(getDatabaseUrl());
  const watches = await db.select().from(s.watches).orderBy(desc(s.watches.createdAt));

  // 候補データを一括取得（N+1回避）。ウォッチ件数は小規模のためJS側で突き合わせる。
  const [patents, technologies, researchers, papers, netisTechnologies] = await Promise.all([
    db.select().from(s.patents),
    db.select().from(s.technologies),
    db.select().from(s.researchers),
    db.select().from(s.papers),
    db.select().from(s.netisTechnologies)
  ]);

  type Row = typeof s.watches.$inferSelect & { matches: string[] };

  const rows: Row[] = watches.map(w => {
    let matches: string[] = [];
    if (w.kind === 'patent' || w.kind === 'competitor') {
      matches = patents.filter(p => isMatch(w.label, p.applicantName) || isMatch(w.label, p.title)).map(p => p.title);
    } else if (w.kind === 'technology') {
      matches = technologies.filter(t => isMatch(w.label, t.name)).map(t => t.name);
    } else if (w.kind === 'ipc') {
      matches = patents.filter(p => p.ipcCodes.some(code => isMatch(w.label, code))).map(p => p.title);
    } else if (w.kind === 'researcher') {
      matches = researchers.filter(r => isMatch(w.label, r.name)).map(r => r.name);
    } else if (w.kind === 'paper') {
      matches = papers.filter(p => isMatch(w.label, p.title)).map(p => p.title);
    } else if (w.kind === 'netis') {
      matches = netisTechnologies.filter(n => isMatch(w.label, n.name) || (n.category && isMatch(w.label, n.category))).map(n => n.name);
    }
    return { ...w, matches };
  });

  return (
    <ListView
      title="ウォッチ条件との一致件数"
      moduleCode="S-19 / WATCH — ALERTS"
      description="登録済みウォッチ条件と現在のデータを突き合わせた一致件数です（MVPではラベルと名称の部分一致で判定）。前回確認時からの新着だけを区別する既読管理は未実装のため、一致するデータは毎回表示されます（本番設計ではイベント駆動の差分検知・既読カーソルを予定）。"
      badge="全件一致（既読管理なし）"
      rows={rows}
      emptyMessage="登録済みのウォッチはまだありません。"
      fields={[
        { key: 'label', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.label}</span> },
        { key: 'kind', mono: true, render: row => KIND_LABEL[row.kind] ?? row.kind },
        { key: 'alert', render: row => row.matches.length > 0
          ? <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>一致 {row.matches.length}件</span>
          : <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line)' }}>一致なし</span>
        },
        { key: 'detail', grow: true, render: row => (
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            {row.matches.length > 0 ? row.matches.slice(0, 2).join(' ／ ') + (row.matches.length > 2 ? ' 他' : '') : '—'}
          </span>
        ) }
      ]}
    />
  );
}

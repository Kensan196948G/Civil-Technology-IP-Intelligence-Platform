export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { InfoPage, type InfoBlock } from '@/components/InfoPage';


function renderCount(n: number) {
  return n > 0
    ? <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>{n} 件</span>
    : <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>0 件</span>;
}

export default async function DataDuplicatesPage() {
  const db = getDb(getDatabaseUrl());
  const [patentDup, paperDup, netisDup, techDup] = await Promise.all([
    db.execute(sql`select count(*)::int as n from (select lower(trim(title)) from patents group by lower(trim(title)) having count(*) > 1) t`),
    db.execute(sql`select count(*)::int as n from (select lower(trim(title)) from papers group by lower(trim(title)) having count(*) > 1) t`),
    db.execute(sql`select count(*)::int as n from (select lower(trim(name)) from netis_technologies group by lower(trim(name)) having count(*) > 1) t`),
    db.execute(sql`select count(*)::int as n from (select lower(trim(name)) from technologies group by lower(trim(name)) having count(*) > 1) t`)
  ]);
  const n = (r: typeof patentDup) => Number((r.rows[0] as { n: number } | undefined)?.n ?? 0);

  const blocks: InfoBlock[] = [
    { label: '特許（タイトル重複候補）', value: renderCount(n(patentDup)) },
    { label: '論文（タイトル重複候補）', value: renderCount(n(paperDup)) },
    { label: 'NETIS技術（名称重複候補）', value: renderCount(n(netisDup)) },
    { label: '技術マスタ（名称重複候補）', value: renderCount(n(techDup)) }
  ];

  return (
    <InfoPage
      title="重複管理"
      moduleCode="S-18i / DUPLICATE MANAGEMENT"
      description="タイトル・名称を正規化（前後空白除去＋大文字小文字無視）した上で完全一致するレコードを重複候補として検出します。複数ソースからの二重取り込みの監視に使用します。"
      badge="MVP"
      blocks={blocks}
      note="現時点のデモデータでは重複候補は0件です。本番運用では取り込みバッチ実行後に本画面で重複候補を確認し、必要に応じて統合・削除の判断を行う運用を想定しています（統合・削除操作自体はバックログ）。"
    />
  );
}

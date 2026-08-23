import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Notice, Tag } from '@/components/ui';
import { DetailChip, DetailTr } from '@/components/detail/DetailOpener';
import { REPORT_KIND, ymd } from '@/lib/labels';

export const runtime = 'edge';

// 設計案（design-B-copilot）の「レポート」。
// 種類の絞り込みチップ（nav.ts の ?kind= と同じ）＋出力履歴の表。行から詳細ドロワー。

export default async function ReportsPage({ searchParams }: { searchParams: { kind?: string } }) {
  const db = getDb(getDatabaseUrl());
  const kind = searchParams.kind;
  const all = await db.select().from(s.reports).orderBy(desc(s.reports.createdAt));
  const rows = kind ? all.filter(r => r.kind === kind) : all;

  const creatorIds = [...new Set(rows.map(r => r.createdBy))];
  const creators = creatorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, creatorIds)) : [];
  const creatorById = new Map(creators.map(u => [u.id, u]));

  // 実際に出力履歴のある種類だけをチップにする（空のチップを並べない）。
  const byKind = new Map<string, number>();
  for (const r of all) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/reports" className={`chip${kind ? '' : ' active'}`}>
          すべて<span className="chip-count">{all.length}</span>
        </Link>
        {[...byKind.entries()].map(([k, n]) => (
          <Link key={k} href={`/reports?kind=${k}`} className={`chip${kind === k ? ' active' : ''}`}>
            {REPORT_KIND[k]?.label ?? k}<span className="chip-count">{n}</span>
          </Link>
        ))}
        <span style={{ flex: 1 }} />
        <DetailChip
          className="btn btn-primary"
          detail={{
            title: 'レポート作成',
            tag: '新規',
            tone: 'amber',
            form: [
              { label: '種類', placeholder: '先行技術調査書 / 競合分析 / 現場適用性評価 / 経営サマリー' },
              { label: '元にするデータ', placeholder: '例: 調査案件、AI実行ID' }
            ],
            body: 'AIが下書きを生成します。生成物のすべての記述に出典が付き、確定は人が行います。',
            note: 'AIの出力をそのまま社外向け資料に貼ることは禁止されています。社外に出す資料は必ず技術部門の確認を経てください。',
            actions: [
              { label: 'レポート作成へ', href: '/reports/new', primary: true },
              { label: 'キャンセル' }
            ]
          }}
        >
          ＋ レポート作成
        </DetailChip>
      </div>

      <div className="panel" style={{ overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>
            {kind
              ? `該当種別（${REPORT_KIND[kind]?.label ?? kind}）のレポートはまだありません。「レポート作成」から作成できます。`
              : 'レポートはまだありません。「レポート作成」から作成できます。'}
          </div>
        ) : (
          <table className="plain">
            <thead>
              <tr><th>レポート名</th><th>種類</th><th>形式</th><th>作成者</th><th>作成日</th></tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const meta = REPORT_KIND[r.kind] ?? { label: r.kind, tone: 'gray' as const };
                const author = creatorById.get(r.createdBy)?.displayName ?? '—';
                return (
                  <DetailTr
                    key={r.id}
                    detail={{
                      title: r.title,
                      tag: meta.label,
                      tone: meta.tone,
                      meta: [
                        { k: '種類', v: meta.label },
                        { k: '形式', v: r.format.toUpperCase() },
                        { k: '作成', v: `${author}（${ymd(r.createdAt)}）` }
                      ],
                      body: '本文中のすべてのAI生成箇所に出典が付きます。確定は人が行います。',
                      note: 'AIの出力をそのまま社外向け資料に貼ることは禁止されています。社外に出す資料は必ず技術部門の確認を経てください。',
                      actions: [
                        { label: '出力履歴を見る', href: '/reports', primary: true },
                        { label: '元の調査案件を見る', href: '/investigations' }
                      ]
                    }}
                  >
                    <td style={{ fontWeight: 500 }}>{r.title}</td>
                    <td><Tag tone={meta.tone}>{meta.label}</Tag></td>
                    <td className="mono" style={{ fontSize: 11 }}>{r.format.toUpperCase()}</td>
                    <td style={{ color: 'var(--ink-2)' }}>{author}</td>
                    <td className="mono">{ymd(r.createdAt)}</td>
                  </DetailTr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Notice>
        AIの出力をそのまま社外向け資料に貼ることは禁止されています。社外に出す資料は必ず技術部門の確認を経てください。
      </Notice>
    </div>
  );
}

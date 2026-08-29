import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Panel, Tag } from '@/components/ui';
import { DetailRow } from '@/components/detail/DetailOpener';
import { WATCH_KIND, ymd } from '@/lib/labels';


// 設計案（design-B-copilot）の「ウォッチ・アラート」。
// 上に週次AIダイジェスト、下に種別つきのウォッチ一覧。行から詳細ドロワーを開く。

const KIND_ORDER = ['patent', 'competitor', 'technology', 'ipc', 'researcher', 'paper', 'netis'] as const;

export default async function WatchPage({ searchParams }: { searchParams: { kind?: string } }) {
  const db = getDb(getDatabaseUrl());
  const kind = searchParams.kind;
  const all = await db.select().from(s.watches).orderBy(desc(s.watches.createdAt));
  const rows = kind ? all.filter(w => w.kind === kind) : all;

  const ownerIds = [...new Set(rows.map(r => r.ownerId))];
  const owners = ownerIds.length ? await db.select().from(s.users).where(inArray(s.users.id, ownerIds)) : [];
  const ownerById = new Map(owners.map(o => [o.id, o]));

  const byKind = new Map<string, number>();
  for (const w of all) byKind.set(w.kind, (byKind.get(w.kind) ?? 0) + 1);
  const kindsPresent = KIND_ORDER.filter(k => byKind.has(k));

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 週次AIダイジェスト */}
      <div className="panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>週次AIダイジェスト</div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3 }}>
            ウォッチ {all.length} 件（{kindsPresent.map(k => `${WATCH_KIND[k]!.label} ${byKind.get(k)}`).join(' ・ ')}）。
            重要度はAIの目安で、ウォッチ条件はいつでも直せます。
          </div>
        </div>
        <Link href="/watch/digest" className="btn btn-secondary">ダイジェストを読む</Link>
      </div>

      {/* 種別の絞り込み。nav.ts の各ウォッチメニューと同じ ?kind= を使う。 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Link href="/watch" className={`chip${kind ? '' : ' active'}`}>
          マイウォッチ<span className="chip-count">{all.length}</span>
        </Link>
        {kindsPresent.map(k => (
          <Link key={k} href={`/watch?kind=${k}`} className={`chip${kind === k ? ' active' : ''}`}>
            {WATCH_KIND[k]!.label}<span className="chip-count">{byKind.get(k)}</span>
          </Link>
        ))}
      </div>

      <Panel title="アラート" note="重要度はAIの目安です。ウォッチ条件はいつでも直せます" bodyPadding={false}>
        <div className="row-list">
          {rows.length === 0 && (
            <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>該当するウォッチ登録はまだありません。</div>
          )}
          {rows.map(w => {
            const meta = WATCH_KIND[w.kind] ?? { label: w.kind, tone: 'gray' as const };
            const owner = ownerById.get(w.ownerId)?.displayName ?? '—';
            return (
              <DetailRow
                key={w.id}
                detail={{
                  title: w.label,
                  tag: meta.label,
                  tone: meta.tone,
                  meta: [
                    { k: '種別', v: meta.label },
                    { k: '登録者', v: owner },
                    { k: '登録日', v: ymd(w.createdAt) }
                  ],
                  body: '登録した条件に合致する新規出願・権利状態の変更・NETIS新規登録を検知して通知します。重要度の判定はAIの目安であり、対応要否は人が決めます。',
                  note: '重要度はAIの目安です。この判定だけで対応要否を決めないでください。',
                  actions: [
                    { label: '新規出願を見る', href: '/watch/new-filings', primary: true },
                    { label: '権利状態変更を見る', href: '/watch/status-changes' },
                    { label: 'AI重要度判定を見る', href: '/watch/ai-priority' }
                  ]
                }}
              >
                <Tag tone={meta.tone} style={{ flex: 'none' }}>{meta.label}</Tag>
                <div className="row-main">
                  <div className="row-title">{w.label}</div>
                  <div className="row-sub">登録者 {owner}</div>
                </div>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-3)', flex: 'none' }}>{ymd(w.createdAt)}</span>
              </DetailRow>
            );
          })}
        </div>
      </Panel>

      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        <Link href="/watch/new-filings" className="btn btn-ghost">新規出願</Link>
        <Link href="/watch/status-changes" className="btn btn-ghost">権利状態変更</Link>
        <Link href="/watch/ai-priority" className="btn btn-ghost">AI重要度判定</Link>
        <Link href="/watch/alerts" className="btn btn-ghost">アラート一覧</Link>
      </div>
    </div>
  );
}

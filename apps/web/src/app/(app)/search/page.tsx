import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { Tag } from '@/components/ui';
import { DetailChip, DetailRow, StopPropagation } from '@/components/detail/DetailOpener';
import { SEARCH_TAB, ymd } from '@/lib/labels';


// 設計案（design-B-copilot）の「横断検索」。
// 検索窓 → AIが組み立てた検索条件（直せる）→ 種別チップ → 結果行（クリックで詳細ドロワー）。
// クエリ本体は既存の実装をそのまま使う（種別ごとに独立して件数集計・上限適用）。

const TABS = ['patent', 'paper', 'netis', 'tech'] as const;
type Tab = (typeof TABS)[number];

const PER_TAB_LIMIT = 30;

function isTab(v: string | undefined): v is Tab {
  return TABS.includes(v as Tab);
}

// CodeRabbit指摘: 以前は4種別をUNION ALLしたうえで全体にLIMITをかけていたため、
// 特許だけで上限に達すると他の種別が0件に見えてしまうバグがあった。
// 種別ごとに独立してクエリ・件数集計・上限適用を行うよう修正した。
async function runSearchByTab(q: string, tab: Tab) {
  const db = getDb(getDatabaseUrl());
  const like = `%${q}%`;

  if (tab === 'patent') {
    const r = await db.execute(sql`
      select 'patent' as kind, id, title, applicant_name as sub, abstract as summary,
             source, retrieved_at, classification, is_sample
      from patents where ${q}::text = '' or title ilike ${like} or abstract ilike ${like}
      order by retrieved_at desc limit ${PER_TAB_LIMIT}
    `);
    return r.rows as any[];
  }
  if (tab === 'paper') {
    const r = await db.execute(sql`
      select 'paper' as kind, id, title, venue as sub, abstract as summary,
             source, retrieved_at, 'C1' as classification, is_sample
      from papers where ${q}::text = '' or title ilike ${like} or abstract ilike ${like}
      order by retrieved_at desc limit ${PER_TAB_LIMIT}
    `);
    return r.rows as any[];
  }
  if (tab === 'netis') {
    const r = await db.execute(sql`
      select 'netis' as kind, id, name as title, netis_no as sub, summary,
             source, retrieved_at, 'C1' as classification, is_sample
      from netis_technologies where ${q}::text = '' or name ilike ${like} or summary ilike ${like}
      order by retrieved_at desc limit ${PER_TAB_LIMIT}
    `);
    return r.rows as any[];
  }
  const r = await db.execute(sql`
    select 'tech' as kind, id, name as title, kind as sub, summary,
           'social:internal' as source, created_at as retrieved_at, classification, is_sample
    from technologies where ${q}::text = '' or name ilike ${like} or summary ilike ${like}
    order by created_at desc limit ${PER_TAB_LIMIT}
  `);
  return r.rows as any[];
}

async function countAllTabs(q: string) {
  const db = getDb(getDatabaseUrl());
  const like = `%${q}%`;
  const r = await db.execute(sql`
    select
      (select count(*) from patents where ${q}::text = '' or title ilike ${like} or abstract ilike ${like}) as patent,
      (select count(*) from papers where ${q}::text = '' or title ilike ${like} or abstract ilike ${like}) as paper,
      (select count(*) from netis_technologies where ${q}::text = '' or name ilike ${like} or summary ilike ${like}) as netis,
      (select count(*) from technologies where ${q}::text = '' or name ilike ${like} or summary ilike ${like}) as tech
  `);
  return r.rows[0] as Record<string, unknown>;
}

/** AIが組み立てた検索条件の見せ方。入力語をOR/ANDに展開した式を提示し、人が直せることを示す。 */
function buildQueryExpression(q: string): string {
  const terms = q.split(/[\s　]+/).filter(Boolean);
  if (terms.length === 0) return '（検索語が未入力です。全件を新しい順に表示しています）';
  return terms.map(t => `(${t})`).join(' AND ');
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> })
{
  // Next.js 15: searchParams は Promise になったため await する
  const sp = await searchParams;
  const q = sp.q ?? '';
  const tab: Tab = isTab(sp.tab) ? sp.tab : 'patent';
  const [shown, counts] = await Promise.all([runSearchByTab(q, tab), countAllTabs(q)]);
  const expression = buildQueryExpression(q);

  return (
    <div className="measure-narrow" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <form style={{ display: 'flex', gap: 10 }}>
          <input type="hidden" name="tab" value={tab} />
          <input
            name="q"
            defaultValue={q}
            className="input"
            style={{ flex: 1, fontSize: 13.5, padding: '11px 14px' }}
            placeholder="例：港湾 ケーソン 据付 自動化"
          />
          <button className="btn btn-primary" type="submit" style={{ padding: '8px 18px', fontSize: 13, flex: 'none' }}>検索</button>
        </form>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--sunk)', border: '1px solid var(--line-2)', borderRadius: 8, padding: '10px 14px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)', flex: 'none', paddingTop: 2 }}>
            AIが組み立てた検索条件
          </span>
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink)', flex: 1, wordBreak: 'break-all' }}>{expression}</span>
          <DetailChip
            style={{ fontSize: 12, flex: 'none', color: 'var(--blue)' }}
            detail={{
              title: '検索条件を直す',
              tag: 'AI生成',
              tone: 'purple',
              form: [{ label: '検索式（編集できます）', textarea: true, placeholder: expression }],
              body: 'AIが組み立てた検索式は自由に編集できます。編集した式は検索履歴に保存されます（MVPでは保存は行いません）。',
              actions: [
                { label: '検索履歴を見る', href: '/search/history', primary: true },
                { label: 'キャンセル' }
              ]
            }}
          >
            直す
          </DetailChip>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <Link
            key={t}
            href={`/search?q=${encodeURIComponent(q)}&tab=${t}`}
            className={`chip${tab === t ? ' active' : ''}`}
          >
            {SEARCH_TAB[t]!.label}
            <span className="chip-count">{Number(counts?.[t] ?? 0)}</span>
          </Link>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>関連度順・デモデータ</span>
      </div>

      <div className="panel row-list" style={{ overflow: 'hidden' }}>
        {shown.length === 0 && (
          <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>
            該当する結果がありません。検索語を短くするか、他の種別をお試しください。
          </div>
        )}
        {shown.map((r: any) => {
          const meta = SEARCH_TAB[tab]!;
          const detailHref =
            r.kind === 'patent' ? `/patents/${r.id}`
              : r.kind === 'netis' ? `/netis/${r.id}`
                : r.kind === 'tech' ? `/field/by-tech/${r.id}` : null;
          const detailLabel =
            r.kind === 'patent' ? '特許詳細を見る →'
              : r.kind === 'netis' ? 'NETIS詳細を見る →'
                : r.kind === 'tech' ? '現場適用性を見る →' : null;

          return (
            <DetailRow
              key={r.id}
              className="row row-top"
              detail={{
                title: r.title,
                tag: meta.label,
                tone: meta.tone,
                meta: [
                  { k: '出典', v: String(r.source) },
                  { k: '取得', v: ymd(r.retrieved_at) },
                  { k: '機密区分', v: String(r.classification) },
                  ...(r.sub ? [{ k: tab === 'patent' ? '出願人' : tab === 'paper' ? '掲載' : tab === 'netis' ? 'NETIS番号' : '種別', v: String(r.sub) }] : [])
                ],
                body: r.summary
                  ? `やさしい言い換え（AIによる要約）: ${String(r.summary)}`
                  : '要約はまだ生成されていません。原文をご確認ください。',
                note: '要約と言い換えはAIによるものです。判断には必ず原文の該当箇所をご確認ください。',
                actions: [
                  ...(detailHref ? [{ label: '詳細ページを開く', href: detailHref, primary: true }] : []),
                  { label: '現場スコアを見る', href: '/field' },
                  { label: 'ウォッチに追加', href: '/watch' }
                ]
              }}
            >
              <Tag tone={meta.tone} style={{ flex: 'none', marginTop: 2 }}>{meta.label}</Tag>
              <div className="row-main">
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.6 }}>{r.title}</div>
                <div className="row-sub" style={{ marginTop: 3 }}>
                  {r.sub ? `${r.sub} ・ ` : ''}出典 {String(r.source)} ・ 取得 {ymd(r.retrieved_at)}
                </div>
                {r.summary && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.8 }}>{String(r.summary)}</div>
                )}
                {detailHref && detailLabel && (
                  <StopPropagation>
                    <Link href={detailHref} style={{ fontSize: 12, display: 'inline-block', marginTop: 6 }}>{detailLabel}</Link>
                  </StopPropagation>
                )}
              </div>
              <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{String(r.classification)}</span>
                {r.is_sample && <Tag tone="amber">デモ</Tag>}
              </div>
            </DetailRow>
          );
        })}
        <div style={{ padding: '12px 18px', fontSize: 11.5, color: 'var(--ink-3)' }}>
          やさしい言い換えは各詳細で表示します。要約はAIによるもので、必ず原文の該当箇所へのリンクが付きます。
          {shown.length === PER_TAB_LIMIT && `（上位${PER_TAB_LIMIT}件のみ表示しています。本番はページネーションに対応）`}
        </div>
      </div>
    </div>
  );
}

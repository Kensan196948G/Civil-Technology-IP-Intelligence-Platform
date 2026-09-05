import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';

// M33 Technology Knowledge Graph — 特許・論文・NETIS・技術・会社・研究者・現場を
// 1つのグラフとして扱い、中心ノードから n-hop の関係を探索する（FR-M33-001/002/003）。
// エッジは kg_edges（ポリモーフィック）に保持し、ノード名の解決は画面側で行う。
// 原則: グラフは「関係の事実」を提示するものであり、重要度などの判断は行わない。

type Kind = 'patent' | 'paper' | 'netis' | 'technology' | 'company' | 'researcher' | 'site';

const KIND_META: Record<Kind, { label: string; icon: string; color: string }> = {
  patent: { label: '特許', icon: '📜', color: 'var(--blue)' },
  paper: { label: '論文', icon: '📄', color: '#7c5cbf' },
  netis: { label: 'NETIS', icon: '🏷️', color: '#1e7d46' },
  technology: { label: '技術', icon: '💡', color: 'var(--amber)' },
  company: { label: '会社', icon: '🏢', color: '#b7791f' },
  researcher: { label: '研究者', icon: '👤', color: '#1e7d46' },
  site: { label: '現場', icon: '🏗️', color: 'var(--brick)' }
};

const REL_LABEL: Record<string, string> = {
  related_to: '関連',
  cites: '引用',
  owns: '権利保有',
  registered_as: '登録対応',
  applied_at: '適用',
  studied_in: '研究対象',
  developed_by: '開発'
};

type Node = { kind: Kind; id: string; label: string; sub?: string };
type Key = string; // `${kind}:${id}`
type Edge = { from: Key; to: Key; rel: string; note: string | null };

const keyOf = (kind: Kind, id: string): Key => `${kind}:${id}`;

export default async function TechnologyGraphPage({
  searchParams
}: {
  searchParams: Promise<{ center?: string }>;
}) {
  // Next.js 15: searchParams は Promise になったため await する
  const sp = await searchParams;
  const db = getDb(getDatabaseUrl());
  const edgesRaw = await db.select().from(s.kgEdges);
  if (edgesRaw.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={{ fontSize: 22 }}>技術ナレッジグラフ</h1>
          <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M33 / KNOWLEDGE GRAPH</span>
        </div>
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          グラフのリンク（kg_edges）がまだ登録されていません。
        </div>
      </div>
    );
  }

  // エッジに登場するノードIDを種別ごとに集める
  const idsByKind = new Map<Kind, string[]>();
  const addId = (kind: Kind, id: string) => {
    const list = idsByKind.get(kind) ?? [];
    if (!list.includes(id)) list.push(id);
    idsByKind.set(kind, list);
  };
  for (const e of edgesRaw) {
    addId(e.sourceKind as Kind, e.sourceId);
    addId(e.targetKind as Kind, e.targetId);
  }

  // ノード名の解決（種別ごとに実テーブルから引く）
  const nodes = new Map<Key, Node>();
  const register = (kind: Kind, list: Array<{ id: string; label: string; sub?: string | null }>) => {
    for (const n of list) nodes.set(keyOf(kind, n.id), { kind, id: n.id, label: n.label, sub: n.sub ?? undefined });
  };
  const patentIds = idsByKind.get('patent') ?? [];
  if (patentIds.length) {
    const rows = await db.select({ id: s.patents.id, label: s.patents.title, sub: s.patents.publicationNo }).from(s.patents).where(inArray(s.patents.id, patentIds));
    register('patent', rows);
  }
  const paperIds = idsByKind.get('paper') ?? [];
  if (paperIds.length) {
    const rows = await db.select({ id: s.papers.id, label: s.papers.title }).from(s.papers).where(inArray(s.papers.id, paperIds));
    register('paper', rows);
  }
  const netisIds = idsByKind.get('netis') ?? [];
  if (netisIds.length) {
    const rows = await db.select({ id: s.netisTechnologies.id, label: s.netisTechnologies.name, sub: s.netisTechnologies.netisNo }).from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisIds));
    register('netis', rows);
  }
  const technologyIds = idsByKind.get('technology') ?? [];
  if (technologyIds.length) {
    const rows = await db.select({ id: s.technologies.id, label: s.technologies.name, sub: s.technologies.kind }).from(s.technologies).where(inArray(s.technologies.id, technologyIds));
    register('technology', rows);
  }
  const companyIds = idsByKind.get('company') ?? [];
  if (companyIds.length) {
    const rows = await db.select({ id: s.ipEntities.id, label: s.ipEntities.canonicalName, sub: s.ipEntities.country }).from(s.ipEntities).where(inArray(s.ipEntities.id, companyIds));
    register('company', rows);
  }
  const researcherIds = idsByKind.get('researcher') ?? [];
  if (researcherIds.length) {
    const rows = await db.select({ id: s.researchers.id, label: s.researchers.name, sub: s.researchers.affiliation }).from(s.researchers).where(inArray(s.researchers.id, researcherIds));
    register('researcher', rows);
  }
  const siteIds = idsByKind.get('site') ?? [];
  if (siteIds.length) {
    const rows = await db.select({ id: s.sites.id, label: s.sites.name, sub: s.sites.code }).from(s.sites).where(inArray(s.sites.id, siteIds));
    register('site', rows);
  }

  // 無向グラフとして隣接リストを構築（方向は「関係の向き」として表示のみに使う）
  const adj = new Map<Key, Array<{ to: Key; rel: string }>>();
  const edges: Edge[] = edgesRaw.map(e => ({
    from: keyOf(e.sourceKind as Kind, e.sourceId),
    to: keyOf(e.targetKind as Kind, e.targetId),
    rel: e.relation,
    note: e.note
  }));
  for (const e of edges) {
    const a = adj.get(e.from) ?? [];
    a.push({ to: e.to, rel: e.rel });
    adj.set(e.from, a);
    const b = adj.get(e.to) ?? [];
    b.push({ to: e.from, rel: e.rel });
    adj.set(e.to, b);
  }

  // 中心ノード（?center=kind:id で指定。未指定なら最初の技術ノード、無ければ最初のノード）
  const centerKey = sp.center && nodes.has(sp.center)
    ? sp.center
    : [...nodes.keys()].find(k => k.startsWith('technology:')) ?? [...nodes.keys()][0]!;
  const centerNode = nodes.get(centerKey);

  // BFS（深さ2まで）。各到達ノードに「中心からの経路」を持たせる
  type Path = { key: Key; depth: number; rels: string[]; via: string[] };
  const visited = new Map<Key, Path>();
  const queue: Path[] = [{ key: centerKey, depth: 0, rels: [], via: [] }];
  visited.set(centerKey, { key: centerKey, depth: 0, rels: [], via: [] });
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.depth >= 2) continue;
    for (const nb of adj.get(cur.key) ?? []) {
      if (visited.has(nb.to)) continue;
      const path = { key: nb.to, depth: cur.depth + 1, rels: [...cur.rels, nb.rel], via: [...cur.via, cur.key] };
      visited.set(nb.to, path);
      queue.push(path);
    }
  }

  const hops = [...visited.values()].filter(p => p.depth > 0).sort((a, b) => a.depth - b.depth || a.key.localeCompare(b.key));

  const hrefOf = (n: Node | undefined): string | null => {
    if (!n) return null;
    if (n.kind === 'patent') return `/patents/${n.id}`;
    if (n.kind === 'netis') return `/netis/${n.id}`;
    if (n.kind === 'site') return `/sites/${n.id}`;
    if (n.kind === 'technology') return `/field/by-tech/${n.id}`;
    if (n.kind === 'company') return '/entities';
    if (n.kind === 'researcher') return '/search/researchers';
    return null;
  };

  const centerHref = hrefOf(centerNode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>技術ナレッジグラフ</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M33 / KNOWLEDGE GRAPH</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        特許・論文・NETIS・技術・会社・研究者・現場を1つのグラフとして扱い、中心ノードから2ホップ以内の関係を探索します。
        「この工法に関係する特許・論文・NETIS・会社・研究者・実証現場を全部見せて」という問いを支える探索レイヤー（FR-M33-001/002）。
        エッジはデモデータ（kg_edges）。実データ化は特許引用（M26）・Claim比較（M06）等の自動導出で行う（FR-M33-004）。
      </p>

      {/* 中心ノード */}
      <div className="card" style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>中心ノード（クリックで探索中心を変更）</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 20 }}>{centerNode ? KIND_META[centerNode.kind].icon : '❓'}</span>
          <span style={{ fontWeight: 700 }}>{centerNode?.label ?? '不明'}</span>
          {centerNode && <span style={{ fontSize: 11, color: KIND_META[centerNode.kind].color }}>{KIND_META[centerNode.kind].label}</span>}
          {centerNode?.sub && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{centerNode.sub}</span>}
          {centerHref && <Link href={centerHref} style={{ fontSize: 11.5, color: 'var(--blue)' }}>詳細を見る →</Link>}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {[...nodes.entries()].slice(0, 40).map(([key, n]) => (
            <Link
              key={key}
              href={`/technology-graph?center=${encodeURIComponent(key)}`}
              className="chip"
              style={key === centerKey ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
            >
              {KIND_META[n.kind].icon} {n.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ホップ別の探索結果 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{edges.length}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>グラフのリンク</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{nodes.size}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>接続ノード</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{hops.filter(h => h.depth === 1).length}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>1ホップ先</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{hops.filter(h => h.depth === 2).length}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>2ホップ先</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {hops.length === 0 && (
          <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
            この中心ノードに接続するリンクはまだありません。
          </div>
        )}
        {hops.map(p => {
          const n = nodes.get(p.key);
          const relLabel = (i: number) => REL_LABEL[p.rels[i]!] ?? p.rels[i];
          const pathText = p.depth === 1
            ? `中心から「${relLabel(0)}」で接続`
            : `中心から「${relLabel(0)}」→ ${p.via.map(v => nodes.get(v)?.label ?? v).join('')} →「${relLabel(1)}」`;
          const href = hrefOf(n);
          return (
            <div key={p.key} className="card" style={{ padding: '11px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', width: 52, flexShrink: 0 }}>{p.depth} hop</span>
              <span style={{ fontSize: 17 }}>{n ? KIND_META[n.kind].icon : '❓'}</span>
              <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{n?.label ?? '不明'}</span>
                  {n && <span style={{ fontSize: 10.5, fontWeight: 700, color: KIND_META[n.kind].color }}>{KIND_META[n.kind].label}</span>}
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pathText}{n?.sub ? `（${n.sub}）` : ''}</span>
              </div>
              <Link
                href={`/technology-graph?center=${encodeURIComponent(p.key)}`}
                style={{ fontSize: 11.5, color: 'var(--amber)', flexShrink: 0 }}
              >
                中心にする →
              </Link>
              {href && <Link href={href} style={{ fontSize: 11.5, color: 'var(--blue)', flexShrink: 0 }}>詳細 →</Link>}
            </div>
          );
        })}
      </div>

      {/* 全リンク一覧（事実の出典） */}
      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4 }}>
        — 全リンク（{edges.length}件）—
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {edges.map((e, i) => {
          const from = nodes.get(e.from);
          const to = nodes.get(e.to);
          return (
            <div key={i} style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span>{from ? `${KIND_META[from.kind].icon} ${from.label}` : e.from}</span>
              <span className="mono" style={{ color: 'var(--blue)', fontSize: 10.5 }}>{REL_LABEL[e.rel] ?? e.rel}</span>
              <span>{to ? `${KIND_META[to.kind].icon} ${to.label}` : e.to}</span>
              {e.note && <span style={{ color: 'var(--ink-3)' }}>※{e.note}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';

// M50 Technology Ontology / Taxonomy Management — 工種・工法・構造物・材料・機械・
// IPC/CPC・NETIS分類を1つの階層ツリーで管理する。検索精度・AI分類の基盤。
// 正本: docs/90-project/05-module-expansion-m26-m50.md（M50）

const KIND_META: Record<string, { label: string; icon: string; color: string }> = {
  work_type: { label: '工種', icon: '🏗️', color: 'var(--blue)' },
  work_method: { label: '工法', icon: '🔧', color: 'var(--green)' },
  structure: { label: '構造物', icon: '🏛️', color: '#7c5cbf' },
  material: { label: '材料', icon: '🧱', color: 'var(--amber)' },
  machine: { label: '機械', icon: '🚜', color: '#b7791f' },
  ipc: { label: 'IPC/CPC', icon: '📜', color: 'var(--brick)' },
  netis_category: { label: 'NETIS分類', icon: '🏷️', color: '#1e7d46' }
};

type Node = {
  id: string; kind: string; code: string | null; name: string;
  depth: number; note: string | null; children: Node[];
};

export default async function OntologyPage() {
  const db = getDb(getDatabaseUrl());
  const terms = await db.select().from(s.ontologyTerms).orderBy(s.ontologyTerms.depth, s.ontologyTerms.name);

  // ツリー構築
  const byId = new Map<string, Node>();
  const roots: Node[] = [];
  for (const t of terms) {
    byId.set(t.id, { id: t.id, kind: t.kind, code: t.code, name: t.name, depth: t.depth, note: t.note, children: [] });
  }
  for (const t of terms) {
    const node = byId.get(t.id)!;
    if (t.parentId && byId.has(t.parentId)) byId.get(t.parentId)!.children.push(node);
    else roots.push(node);
  }

  const countByKind: Record<string, number> = {};
  for (const t of terms) countByKind[t.kind] = (countByKind[t.kind] ?? 0) + 1;

  const renderNode = (n: Node): React.ReactNode => {
    const meta = KIND_META[n.kind] ?? { label: n.kind, icon: '•', color: 'var(--ink-2)' };
    return (
      <div key={n.id} style={{ paddingLeft: n.depth * 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: n.depth === 0 ? 15 : 13, fontWeight: n.depth === 0 ? 700 : 600 }}>
            {meta.icon} {n.name}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: meta.color }}>{meta.label}</span>
          {n.code && <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{n.code}</span>}
          {n.children.length > 0 && <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>({n.children.length})</span>}
        </div>
        {n.note && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', paddingLeft: 4 }}>{n.note}</div>}
        {n.children.map(renderNode)}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>技術オントロジー（分類体系）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M50 / ONTOLOGY</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        工種・工法・構造物・材料・機械・IPC/CPC・NETIS分類を1つの階層ツリーで管理します。
        この体系を土台に、横断検索・AI分類・KB検索の精度を底上げします（正本 §5 M50）。
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {Object.entries(KIND_META).map(([k, meta]) => (
          <div key={k} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ fontSize: 13 }}>{meta.icon}</span>
            <span className="mono" style={{ fontSize: 18, color: meta.color }}>{countByKind[k] ?? 0}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{meta.label}</span>
          </div>
        ))}
      </div>

      {terms.length === 0 ? (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          オントロジー用語がまだ登録されていません。
        </div>
      ) : (
        <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {roots.map(renderNode)}
        </div>
      )}
    </div>
  );
}

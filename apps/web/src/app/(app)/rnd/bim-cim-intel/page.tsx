import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// M40 BIM/CIM Technology Intelligence — IFC/BIM/CIM オブジェクトと技術・特許・NETIS・
// 現場の関連付けを管理する。施工計画・4Dシミュレーションでの技術適用を支援。

const SUBJECT_META: Record<string, { label: string; href: (id: string) => string | null }> = {
  technology: { label: '技術', href: id => `/field/by-tech/${id}` },
  patent: { label: '特許', href: id => `/patents/${id}` },
  netis: { label: 'NETIS', href: id => `/netis/${id}` },
  site: { label: '現場', href: id => `/sites/${id}` }
};

const SUBJECT_LABELS: Record<string, string> = {
  technology: '技術台帳', patent: '特許', netis: 'NETIS技術', site: '現場'
};

// ポリモーフィック対象の表示名を取得するための参照テーブル
async function loadSubjects(db: ReturnType<typeof getDb>) {
  const links = await db.select().from(s.bimCimLinks).orderBy(desc(s.bimCimLinks.createdAt));
  const idsByType: Record<string, string[]> = {};
  for (const l of links) {
    idsByType[l.subjectType] = [...(idsByType[l.subjectType] ?? []), l.subjectId];
  }

  const techRows = idsByType.technology?.length
    ? await db.select().from(s.technologies)
    : [];
  const patentRows = idsByType.patent?.length
    ? await db.select().from(s.patents)
    : [];
  const netisRows = idsByType.netis?.length
    ? await db.select().from(s.netisTechnologies)
    : [];
  const siteRows = idsByType.site?.length
    ? await db.select().from(s.sites)
    : [];

  const labels = new Map<string, { label: string; href: string | null }>();
  for (const t of techRows) labels.set(`technology:${t.id}`, { label: t.name, href: `/field/by-tech/${t.id}` });
  for (const p of patentRows) labels.set(`patent:${p.id}`, { label: p.title, href: `/patents/${p.id}` });
  for (const n of netisRows) labels.set(`netis:${n.id}`, { label: n.name, href: `/netis/${n.id}` });
  for (const st of siteRows) labels.set(`site:${st.id}`, { label: st.name, href: `/sites/${st.id}` });

  return { links, labels };
}

export default async function BimCimIntelPage() {
  const db = getDb(getDatabaseUrl());
  const { links, labels } = await loadSubjects(db);

  const stats = {
    total: links.length,
    ifc: new Set(links.map(l => l.ifcEntity)).size,
    models: new Set(links.map(l => l.modelName).filter(Boolean)).size
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>BIM/CIM 技術関連付け</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M40 / BIM-CIM INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        IFC/BIM/CIM モデルのオブジェクトと技術・特許・NETIS・現場の関連付けを管理し、
        施工計画・4Dシミュレーションでの技術適用を支援します。
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{stats.total}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>関連リンク</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{stats.ifc}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>IFC エンティティ種別</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{stats.models}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>モデル</span>
        </div>
      </div>

      {links.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          BIM/CIM の関連リンクがまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {links.map(l => {
          const subject = labels.get(`${l.subjectType}:${l.subjectId}`);
          const sMeta = SUBJECT_META[l.subjectType] ?? { label: l.subjectType, href: () => null };
          const href = subject?.href ?? null;
          return (
            <div key={l.id} className="card" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge" style={{ color: 'var(--purple)', border: '1px solid var(--purple)', fontSize: 10 }}>{l.ifcEntity}</span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{l.elementName ?? '—'}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{l.modelName ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
                <span style={{ color: 'var(--ink-2)' }}>
                  {SUBJECT_LABELS[l.subjectType] ?? l.subjectType}: {subject?.label ?? '—'}
                </span>
                {href && <a href={href} style={{ color: 'var(--blue)', fontSize: 11 }}>開く →</a>}
                {l.note && <span style={{ color: 'var(--ink-3)' }}>※{l.note}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

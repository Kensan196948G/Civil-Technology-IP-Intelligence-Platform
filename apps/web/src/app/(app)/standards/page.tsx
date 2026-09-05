import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import Link from 'next/link';

// M34 Standards & Specification Intelligence — JIS・ISO・国交省要領・設計/施工基準・発注仕様・安全基準の台帳。
// 技術⇔規格の関連と適用可否メモを併記する。FR-M34-001/003/004。
// 注: 規格の適用可否（=この技術が基準に適合するか）は技術者の判断メモであり、最終判断は人。

const KIND_META: Record<string, { label: string; color: string; icon: string }> = {
  jis: { label: 'JIS', color: 'var(--blue)', icon: '📐' },
  iso: { label: 'ISO', color: 'var(--purple)', icon: '🌐' },
  mlit_manual: { label: '国交省基準', color: 'var(--green)', icon: '🏛️' },
  spec: { label: '発注仕様', color: 'var(--amber)', icon: '📋' },
  safety: { label: '安全基準', color: 'var(--brick)', icon: '🦺' }
};

const APPLICABILITY_META: Record<string, { label: string; color: string }> = {
  applicable: { label: '適用可', color: 'var(--green)' },
  conditional: { label: '条件付き', color: 'var(--amber)' },
  not_applicable: { label: '不適用', color: 'var(--brick)' },
  under_review: { label: '確認中', color: 'var(--ink-2)' }
};

export default async function StandardsPage() {
  const db = getDb(getDatabaseUrl());
  const standards = await db.select().from(s.standards).orderBy(asc(s.standards.kind), asc(s.standards.code));
  const links = await db.select().from(s.technologyStandards);

  const stdIds = standards.map(x => x.id);
  const stdById = new Map(standards.map(x => [x.id, x]));
  const techIds = [...new Set(links.map(l => l.technologyId))];
  const techs = techIds.length
    ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techIds))
    : [];
  const techById = new Map(techs.map(t => [t.id, t]));

  const linksByStd = new Map<string, typeof links>();
  for (const l of links) {
    const arr = linksByStd.get(l.standardId) ?? [];
    arr.push(l);
    linksByStd.set(l.standardId, arr);
  }

  const groups = Object.entries(KIND_META).map(([kind, meta]) => ({
    kind,
    meta,
    items: standards.filter(x => x.kind === kind)
  }));

  const totalStandards = standards.length;
  const totalLinks = links.length;
  const applicableCount = links.filter(l => l.applicability === 'applicable').length;
  const conditionalCount = links.filter(l => l.applicability === 'conditional').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>規格・基準インテリジェンス</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M34 / STANDARDS</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        JIS・ISO・国交省要領・設計/施工基準・発注仕様・安全基準の台帳です（版・収集元を保持＝トレーサビリティ）。
        自社技術との関連（適用可否メモ）を併記し、特許・NETIS・論文と並ぶ導入判断材料にします（FR-M34-001〜004）。
        技術⇔規格の適用可否は技術者の判断メモであり、最終判断は技術・品質担当者が行います。
      </p>

      {/* サマリ */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{totalStandards}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>規格台帳</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{totalLinks}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>技術⇔規格の関連</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--green)' }}>{applicableCount}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>適用可</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--amber)' }}>{conditionalCount}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>条件付き</span>
        </div>
      </div>

      {standards.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          規格台帳がまだ登録されていません。
        </div>
      )}

      {/* 種別ごとのグループ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {groups.map(({ kind, meta, items }) => items.length === 0 ? null : (
          <div key={kind} className="card" style={{ padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 15 }}>{meta.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 14, color: meta.color }}>{meta.label}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{items.length}件</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {items.map(st => {
                const linksFor = linksByStd.get(st.id) ?? [];
                return (
                  <div key={st.id} style={{ borderTop: '1px solid var(--line-2)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600 }}>{st.code}</span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{st.title}</span>
                      {st.version && <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>版 {st.version}</span>}
                      {st.issuedOn && <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{st.issuedOn}</span>}
                    </div>
                    {st.summary && <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{st.summary}</div>}
                    <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                      収集元: {st.source}（収集日 <span className="mono">{st.retrievedAt.toISOString().slice(0, 10)}</span>）
                      {st.sourceUrl && <> ｜ <Link href={st.sourceUrl} target="_blank" style={{ color: 'var(--blue)' }}>出典</Link></>}
                    </div>
                    {linksFor.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 8, borderLeft: '2px solid var(--line)' }}>
                        {linksFor.map(l => {
                          const app = APPLICABILITY_META[l.applicability] ?? { label: l.applicability, color: 'var(--ink-2)' };
                          const tech = techById.get(l.technologyId);
                          return (
                            <div key={l.id} style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span className="badge" style={{ color: app.color, border: `1px solid ${app.color}`, fontSize: 10 }}>{app.label}</span>
                              <span style={{ fontWeight: 600 }}>{tech?.name ?? '技術（削除済み）'}</span>
                              {l.memo && <span style={{ color: 'var(--ink-3)' }}>— {l.memo}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

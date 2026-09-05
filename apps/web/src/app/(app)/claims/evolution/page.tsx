import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

// M30 Claim Evolution Intelligence — Claim の版（出願時→補正後→登録時）を構造化して保持し、
// 審査で追加・限定された要素を差分表示する。FR-M30-001〜005。
// 原則: 差分・限定要素の提示は「事実＋技術的示唆」であり、補正経緯の法的評価は行わない
// （最終判断は法務・弁理士＝LegalOps 側。注記は除去できない）。

const VERSION_META: Record<string, { label: string; color: string; order: number }> = {
  as_filed: { label: '出願時', color: 'var(--ink-2)', order: 1 },
  after_amendment: { label: '補正後', color: 'var(--amber)', order: 2 },
  as_registered: { label: '登録時', color: 'var(--green)', order: 3 }
};

export default async function ClaimEvolutionPage() {
  const db = getDb(getDatabaseUrl());
  const patents = await db.select().from(s.patents).orderBy(asc(s.patents.title));
  const versions = await db.select().from(s.claimVersions).orderBy(
    asc(s.claimVersions.patentId), asc(s.claimVersions.claimNo)
  );

  const patentById = new Map(patents.map(p => [p.id, p]));
  const versionByPatent = new Map<string, typeof versions>();
  for (const v of versions) {
    const list = versionByPatent.get(v.patentId) ?? [];
    list.push(v);
    versionByPatent.set(v.patentId, list);
  }

  // claim_versions が1件も無い特許を除外（進化を語れないため）
  const targetPatents = patents.filter(p => (versionByPatent.get(p.id) ?? []).length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Claim進化（審査版比較）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M30 / CLAIM EVOLUTION</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
      </div>
      <div className="notice notice-amber" style={{ fontSize: 12 }}>
        ここに表示するのは「補正前後の Claim の差分と、審査で追加・限定された技術要素の候補」です。法的評価（進歩性の有無・侵害判断など）は行いません。権利解釈は法務・弁理士へ（FR-M30-005・M27 と同境界）。ファミリー内・国別の Claim 差は /patents/families/tree で確認できます（FR-M30-004・M31 連携）。
      </div>

      {targetPatents.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          Claim版データ（claim_versions）がまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {targetPatents.map(p => {
          const list = (versionByPatent.get(p.id) ?? [])
            .slice()
            .sort((a, b) => a.claimNo - b.claimNo);
          const claimNos = [...new Set(list.map(v => v.claimNo))].sort((a, b) => a - b);
          return (
            <div key={p.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{p.title}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{p.publicationNo ?? ''}</span>
                </div>
                <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{p.applicantName} ｜ {p.country}</span>
              </div>

              {claimNos.map(claimNo => {
                const vs = list.filter(v => v.claimNo === claimNo)
                  .slice()
                  .sort((a, b) => (VERSION_META[a.versionKind]?.order ?? 9) - (VERSION_META[b.versionKind]?.order ?? 9));
                return (
                  <div key={claimNo} style={{ borderTop: '1px solid var(--line-2)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>請求項 {claimNo}</span>
                    {vs.map(v => {
                      const meta = VERSION_META[v.versionKind] ?? { label: v.versionKind, color: 'var(--ink-2)' };
                      return (
                        <div key={v.id} style={{ display: 'flex', gap: 10 }}>
                          <span style={{ width: 64, flexShrink: 0, fontSize: 11, fontWeight: 700, color: meta.color, paddingTop: 1 }}>
                            {meta.label}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{v.text}</div>
                            {(v.changedElements as string[]).length > 0 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>＋追加・限定:</span>
                                {(v.changedElements as string[]).map((el, i) => (
                                  <span key={i} style={{ fontSize: 10.5, background: 'color-mix(in srgb, var(--green) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--green) 45%, transparent)', color: 'var(--green)', borderRadius: 4, padding: '1px 7px' }}>
                                    {el}
                                  </span>
                                ))}
                              </div>
                            )}
                            {v.note && <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{v.note}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

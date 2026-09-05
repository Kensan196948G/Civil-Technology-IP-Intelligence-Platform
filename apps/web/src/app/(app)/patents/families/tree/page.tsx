import Link from 'next/link';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

// M31 Advanced Patent Family Intelligence — 同一発明の多国出願（優先権→PCT→各国移行）を
// ファミリーとして構造化し、ツリー表示・国別の権利状態と残存期間の比較を行う。
// 要件: docs/90-project/06-first-wave-fr-drafts.md（FR-M31-001〜004）
// データ源: patent_families / patent_family_members（M31 スライスで新設。既存の
// 「タイトル一致の簡易集計」(/patents/families) は正式な書誌ファミリーではないため別画面に残す）

const MEMBER_KIND_META: Record<string, { label: string; icon: string; color: string; order: number }> = {
  priority: { label: '優先権出願', icon: '📌', color: 'var(--brick)', order: 1 },
  pct: { label: 'PCT国際出願', icon: '🌐', color: 'var(--blue)', order: 2 },
  national_phase: { label: '各国移行', icon: '🏳️', color: 'var(--green)', order: 3 },
  divisional: { label: '分割出願', icon: '✂️', color: 'var(--amber)', order: 4 },
  continuation: { label: '継続出願', icon: '🔁', color: '#7c5cbf', order: 5 }
};

// 特許の法的状態は prosecution_events から導出する簡易版（登録イベントの有無）。
// 本番では LegalOps（I-04）と同期した権利状態マスタを使う（FR-M31-002 の拡張点）。
async function loadFamilyViews() {
  const db = getDb(getDatabaseUrl());
  const families = await db.select().from(s.patentFamilies).orderBy(asc(s.patentFamilies.name));
  const memberRows = await db.select().from(s.patentFamilyMembers);

  const patentIds = [...new Set(memberRows.map(m => m.patentId))];
  const patents = patentIds.length
    ? await db.select().from(s.patents)
    : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  // 特許ごとの審査経過（登録イベントの有無で法的状態を簡易判定）
  const registrationRows = patentIds.length
    ? await db.select().from(s.prosecutionEvents)
    : [];
  const registeredPatentIds = new Set(
    registrationRows.filter(e => e.kind === 'registration').map(e => e.patentId)
  );

  const memberByFamily = new Map<string, typeof memberRows>();
  for (const m of memberRows) {
    const list = memberByFamily.get(m.familyId) ?? [];
    list.push(m);
    memberByFamily.set(m.familyId, list);
  }

  // 残存期間（出願日から20年）を簡易計算
  const today = new Date();
  const calcExpiry = (patent: { applicationDate: string | Date | null } | undefined) => {
    if (!patent?.applicationDate) return null;
    const d = new Date(String(patent.applicationDate));
    if (Number.isNaN(d.getTime())) return null;
    const expiry = new Date(d);
    expiry.setFullYear(expiry.getFullYear() + 20);
    const remainYears = (expiry.getTime() - today.getTime()) / (365.25 * 24 * 3600 * 1000);
    return {
      expiry: expiry.toISOString().slice(0, 10),
      remainYears: Math.max(0, remainYears)
    };
  };

  return families.map(f => {
    const members = (memberByFamily.get(f.id) ?? [])
      .slice()
      .sort((a, b) => (MEMBER_KIND_META[a.memberKind]?.order ?? 9) - (MEMBER_KIND_META[b.memberKind]?.order ?? 9));
    return {
      family: f,
      members: members.map(m => {
        const p = patentById.get(m.patentId);
        const expiry = calcExpiry(p);
        return {
          member: m,
          patent: p,
          expiry,
          registered: p ? registeredPatentIds.has(p.id) : false
        };
      })
    };
  });
}

export default async function FamilyTreePage() {
  const views = await loadFamilyViews();

  const statChips = [
    { label: 'ファミリー数', n: views.length },
    { label: 'メンバー特許総数', n: views.reduce((sum, v) => sum + v.members.length, 0) },
    { label: 'PCT経由ファミリー', n: views.filter(v => v.members.some(m => m.member.memberKind === 'pct')).length },
    { label: '登録済みメンバー', n: views.reduce((sum, v) => sum + v.members.filter(m => m.registered).length, 0) }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>特許ファミリーツリー</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M31 / FAMILY INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第一拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        同一発明の多国出願（優先権出願 → PCT → 各国移行・分割・継続）をファミリーとして構造化し、国別の権利状態と残存期間を比較します（FR-M31-001/002）。
        ここで示す権利状態はデモデータ（審査経過イベント）からの簡易判定です。正式な権利状態は LegalOps との同期で更新します（本番設計・FR-M31-004 拡張点）。
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {statChips.map(chip => (
          <div key={chip.label} className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{chip.n}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>{chip.label}</span>
          </div>
        ))}
      </div>

      {views.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          特許ファミリーがまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {views.map(({ family, members }) => (
          <div key={family.id} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{family.name}</span>
                {family.note && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{family.note}</span>}
              </div>
            </div>

            {/* ツリー: 優先権 → PCT → 各国移行 を時系列で表示 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
              {members.map(({ member, patent, expiry, registered }, i) => {
                const meta = MEMBER_KIND_META[member.memberKind] ?? { label: member.memberKind, icon: '•', color: 'var(--ink-3)' };
                const isLast = i === members.length - 1;
                return (
                  <div key={member.id} style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
                    {/* 縦線＋分岐マーク */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 16, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, lineHeight: '18px', color: meta.color }}>{meta.icon}</span>
                      {!isLast && <span style={{ flex: 1, width: 2, background: 'var(--line-2)', minHeight: 14 }} />}
                    </div>
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: isLast ? 0 : 10, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, width: 86, flexShrink: 0 }}>{meta.label}</span>
                        {patent && (
                          <>
                            <Link href={`/patents/${patent.id}`} style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>
                              {patent.country === 'WO' ? `WO ${patent.publicationNo ?? ''}` : patent.title}
                            </Link>
                            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{patent.country} ｜ {patent.publicationNo ?? '—'}</span>
                            <span className="badge" style={{
                              color: registered ? 'var(--green)' : 'var(--amber)',
                              border: `1px solid ${registered ? 'var(--green)' : 'var(--amber)'}`
                            }}>
                              {registered ? '登録' : '出願・審査中'}
                            </span>
                          </>
                        )}
                      </div>
                      {patent && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', paddingLeft: 96 }}>
                          {patent.applicantName}
                          {expiry && (
                            <span className="mono" style={{ marginLeft: 8, color: expiry.remainYears < 5 ? 'var(--brick)' : 'var(--ink-3)' }}>
                              残存 約{expiry.remainYears.toFixed(1)}年（満了 {expiry.expiry}）
                            </span>
                          )}
                          {member.note && <span style={{ marginLeft: 8, color: 'var(--ink-3)' }}>※{member.note}</span>}
                        </div>
                      )}
                    </div>
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

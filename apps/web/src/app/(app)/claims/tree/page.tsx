export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, asc, inArray } from 'drizzle-orm';
import Link from 'next/link';


export default async function ClaimTreePage() {
  const db = getDb(getDatabaseUrl());
  const claims = await db.select().from(s.patentClaims).orderBy(asc(s.patentClaims.claimNo));

  const patentIds = [...new Set(claims.map(c => c.patentId))];
  const patents = patentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)).orderBy(desc(s.patents.retrievedAt))
    : [];

  const claimsByPatent = new Map<string, typeof claims>();
  for (const c of claims) {
    const arr = claimsByPatent.get(c.patentId) ?? [];
    arr.push(c);
    claimsByPatent.set(c.patentId, arr);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Claim Tree</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-13 / CLAIM INTELLIGENCE</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        特許ごとに、独立請求項を起点として従属請求項をツリー表示します（本データは「独立/従属」フラグのみを保持しており、
        従属先の請求項番号までは未収録のため、便宜上すべての従属請求項を直前の独立請求項の下に表示しています）。
      </p>

      {patents.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>請求項データがまだありません。</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {patents.map(p => {
          const pClaims = claimsByPatent.get(p.id) ?? [];
          return (
            <div key={p.id} className="card" style={{ padding: 0 }}>
              <Link href={`/patents/${p.id}`} className="card" style={{ display: 'block', padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                {p.title}（{p.applicantName}）
              </Link>
              <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pClaims.map(c => (
                  <div key={c.id} style={{ paddingLeft: c.isIndependent ? 0 : 20, borderLeft: c.isIndependent ? 'none' : '2px solid var(--line)', marginLeft: c.isIndependent ? 0 : 4 }}>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: c.isIndependent ? 700 : 400 }}>
                      {c.isIndependent ? '● ' : '└ '}請求項{c.claimNo}
                    </span>
                    {c.isIndependent && <span className="badge" style={{ marginLeft: 8, color: 'var(--blue)', border: '1px solid var(--blue)' }}>独立項</span>}
                    <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{c.text.length > 110 ? c.text.slice(0, 110) + '…' : c.text}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

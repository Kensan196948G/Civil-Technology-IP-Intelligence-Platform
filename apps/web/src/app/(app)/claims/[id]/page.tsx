import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { updateRowKind } from '../actions';


const KIND_LABEL: Record<string, string> = { match: '一致', similar: '類似', differ: '相違' };
const KIND_COLOR: Record<string, string> = { match: 'var(--green)', similar: 'var(--amber)', differ: 'var(--brick)' };

export default async function ClaimChartPage({ params }: { params: { id: string } }) {
  const db = getDb(getDatabaseUrl());
  const [analysis] = await db.select().from(s.claimAnalyses).where(eq(s.claimAnalyses.id, params.id)).limit(1);
  if (!analysis) notFound();
  const [patent] = await db.select().from(s.patents).where(eq(s.patents.id, analysis.patentId)).limit(1);
  const [tech] = await db.select().from(s.technologies).where(eq(s.technologies.id, analysis.technologyId)).limit(1);
  const rows = await db.execute(sql`
    select r.*, e.label as element_label, e.text as element_text
    from claim_chart_rows r join claim_elements e on e.id = r.element_id
    where r.analysis_id = ${params.id} order by r.seq
  `);
  const rowList = rows.rows as any[];
  const matchN = rowList.filter(r => r.kind === 'match').length;
  const simPct = rowList.length ? Math.round((matchN / rowList.length) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Claim Chart</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-13 / CLAIM INTELLIGENCE</span>
      </div>

      <div className="notice notice-brick">
        <strong>類似度は権利侵害の判断ではありません。</strong>
        AI が算出した一致率は、専門家が確認すべき箇所を絞るための目印です。本表を侵害可能性の結論として社外へ提示しないでください。
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{patent?.title}（{patent?.applicantName}） vs. {tech?.name}</div>
        </div>
        <div style={{ flexGrow: 1 }} />
        <div className="card" style={{ padding: '10px 16px' }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.16em', color: 'var(--ink-2)' }}>CLAIM SIMILARITY</div>
          <div className="mono" style={{ fontSize: 28, color: 'var(--ink)' }}>{simPct}<span style={{ fontSize: 13 }}>%</span></div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>= 一致 {matchN} / 全 {rowList.length} 要件</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="plain">
          <thead><tr><th style={{ width: 44 }}>要件</th><th>他社特許の構成</th><th>自社案</th><th style={{ width: 220 }}>判定</th></tr></thead>
          <tbody>
            {rowList.map((r: any) => (
              <tr key={r.id}>
                <td className="mono" style={{ fontSize: 14 }}>{r.element_label}</td>
                <td style={{ maxWidth: 340 }}>{r.element_text}</td>
                <td style={{ maxWidth: 340, color: r.kind === 'differ' ? 'var(--brick)' : 'var(--ink)' }}>{r.our_text}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['match', 'similar', 'differ'] as const).map(k => (
                      <form key={k} action={updateRowKind}>
                        <input type="hidden" name="rowId" value={r.id} />
                        <input type="hidden" name="analysisId" value={params.id} />
                        <input type="hidden" name="kind" value={k} />
                        <button type="submit" className="badge" style={{
                          border: `1px solid ${r.kind === k ? KIND_COLOR[k] : 'var(--line)'}`,
                          color: r.kind === k ? KIND_COLOR[k] : 'var(--ink-2)',
                          background: r.kind === k ? 'var(--surface)' : 'transparent',
                          fontWeight: r.kind === k ? 700 : 400, padding: '4px 8px'
                        }}>{KIND_LABEL[k]}</button>
                      </form>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--ink-2)', marginTop: 4 }}>{r.rationale}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>判定ボタンを押すと即座に反映され、監査ログに記録されます（実データベース連動）。</div>
    </div>
  );
}

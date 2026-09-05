import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Meter, Notice, Panel, Tag } from '@/components/ui';
import { DetailChip } from '@/components/detail/DetailOpener';
import { siteConditionLabel, siteConditionValue } from '@/lib/labels';


// 設計案（design-B-copilot）の「現場適用性評価」。
// 左にリング表示のスコアと現場条件、右に8軸の内訳。各軸から評価根拠（原文）を開ける。
// スコアを単独で見せないこと、注記を消せないことがこの画面の要件。

type Axis = { axis: string; value: number; weight: number; basis: string; is_estimated: boolean };

function scoreColor(score: number) {
  if (score >= 80) return 'var(--green-dot)';
  if (score >= 60) return 'var(--accent)';
  return 'var(--brick-dot)';
}

export default async function FieldScorePage({ params }: { params: Promise<{ id: string }> })
{
  // Next.js 15: params は Promise になったため await する
  const p = await params;
  const db = getDb(getDatabaseUrl());
  const [fa] = await db.select().from(s.fieldApplications).where(eq(s.fieldApplications.id, p.id)).limit(1);
  if (!fa) notFound();
  const [issue] = await db.select().from(s.siteIssues).where(eq(s.siteIssues.id, fa.siteIssueId)).limit(1);
  const [site] = issue ? await db.select().from(s.sites).where(eq(s.sites.id, issue.siteId)).limit(1) : [null];
  // CodeRabbit指摘: candidateType を無視して常に technologies を参照していたため、
  // NETIS由来の候補（candidateType='netis'）では候補技術名が空欄になっていた。
  const isNetis = fa.candidateType === 'netis';
  const candidate = isNetis
    ? (await db.select().from(s.netisTechnologies).where(eq(s.netisTechnologies.id, fa.candidateId)).limit(1))[0]
    : (await db.select().from(s.technologies).where(eq(s.technologies.id, fa.candidateId)).limit(1))[0];
  const candidateName = candidate?.name ?? '候補技術不明';

  const axes = (fa.axes as unknown as Axis[]) ?? [];
  const score = Number(fa.score);
  const ruleCount = axes.filter(a => !a.is_estimated).length;
  const estimatedCount = axes.length - ruleCount;
  const blockers = (fa.blockers as unknown as string[] | null) ?? [];

  // 現場条件（sites.conditions）は jsonb。キーをそのまま並べる。
  const conditions = Object.entries((site?.conditions as Record<string, unknown> | undefined) ?? {});

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{site?.name ?? '—'}</span>
        <span style={{ color: '#C8D0DB' }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>候補技術：{candidateName}</span>
        <DetailChip
          className={`badge ${isNetis ? 'tag-green' : 'tag-blue'}`}
          detail={{
            title: candidateName,
            tag: isNetis ? 'NETIS' : '自社技術',
            tone: isNetis ? 'green' : 'blue',
            meta: [
              ...(isNetis && 'netisNo' in (candidate ?? {})
                ? [{ k: 'NETIS番号', v: String((candidate as { netisNo?: string }).netisNo ?? '—') }]
                : []),
              { k: '概要', v: String((candidate as { summary?: string | null })?.summary ?? '—') }
            ],
            body: isNetis
              ? 'NETIS登録技術です。事後評価の実績値が現場適用スコアの根拠になります。'
              : '自社技術台帳の登録技術です。施工実績と適用条件がスコアの根拠になります。',
            actions: [{ label: '検索結果で見る', href: `/search?tab=${isNetis ? 'netis' : 'tech'}`, primary: true }]
          }}
        >
          {isNetis ? 'NETIS' : '自社技術'}
        </DetailChip>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span className="mono" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '.4px' }}>
              FIELD APPLICABILITY SCORE
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                role="img"
                aria-label={`適用スコア ${score.toFixed(0)} / 100`}
                style={{
                  width: 96, height: 96, borderRadius: '50%', flexShrink: 0,
                  background: `conic-gradient(${scoreColor(score)} 0 ${score}%, var(--line-2) ${score}% 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <div
                  style={{
                    width: 70, height: 70, borderRadius: '50%', background: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600, fontVariantNumeric: 'tabular-nums'
                  }}
                >
                  {score.toFixed(0)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>100点満点・{axes.length}軸の重み付き合成</span>
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>規則ベース{ruleCount}軸 ＋ AI推定{estimatedCount}軸</span>
              </div>
            </div>

            <Notice>
              <strong>このスコアは導入可否の判断を代替しません。</strong>安全・品質・環境部門の承認を経てはじめて導入できます。
            </Notice>

            <Link href="/approvals" className="btn btn-primary" style={{ justifyContent: 'center' }}>
              導入検討を起票する →
            </Link>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>起票であって決定ではありません</div>
          </div>

          <Panel
            title="現場条件"
            action={
              <DetailChip
                style={{ fontSize: 12, color: 'var(--blue)' }}
                detail={{
                  title: '現場条件を直す',
                  tag: '現場',
                  tone: 'blue',
                  form: [
                    { label: '現場名', placeholder: site?.name ?? '例: 新潟東港 防波堤改良工事' },
                    { label: '工種', placeholder: (site?.workTypes ?? []).join('・') || '例: 港湾・防波堤' },
                    { label: '困りごと（普通の文章でOK）', textarea: true, placeholder: issue?.body ?? '' }
                  ],
                  body: '条件を直すとスコアが再計算されます（再計算もAI実行として記録され、根拠が付きます）。',
                  actions: [
                    { label: '現場を開く', href: `/sites/${site?.id ?? ''}`, primary: true },
                    { label: 'キャンセル' }
                  ]
                }}
              >
                直す
              </DetailChip>
            }
          >
            <dl className="kv">
              <dt>現場</dt><dd>{site?.name ?? '—'}</dd>
              <dt>工種</dt><dd>{(site?.workTypes ?? []).join('・') || '—'}</dd>
              {conditions.map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{siteConditionLabel(k)}</dt><dd>{siteConditionValue(k, v)}</dd>
                </div>
              ))}
              <dt>困りごと</dt><dd>{issue?.body ?? '—'}</dd>
            </dl>
          </Panel>

          {blockers.length > 0 && (
            <Panel title="導入の制約">
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.9 }}>
                {blockers.map((b, i) => <li key={i}>{typeof b === 'object' ? JSON.stringify(b) : String(b)}</li>)}
              </ul>
            </Panel>
          )}
        </div>

        <Panel
          title="軸別の内訳"
          note="スコア単独では表示しません。各軸の根拠から原文を開けます"
          bodyPadding={false}
        >
          <div className="row-list">
            {axes.length === 0 && (
              <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>軸別の内訳がありません。</div>
            )}
            {axes.map((a, i) => {
              const estimated = !!a.is_estimated;
              const barColor = estimated ? 'var(--accent)' : 'var(--blue-bar)';
              return (
                <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 120, fontSize: 12.5, fontWeight: 600, flex: 'none' }}>{a.axis}</span>
                    <Tag tone={estimated ? 'amber' : 'blue'} style={{ flex: 'none' }}>{estimated ? 'AI推定' : '規則'}</Tag>
                    <span style={{ flex: 1 }}>
                      <Meter value={a.value * 100} color={barColor} />
                    </span>
                    <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, width: 38, textAlign: 'right', flex: 'none' }}>
                      {a.value.toFixed(2)}
                    </span>
                    <span style={{ width: 52, textAlign: 'right', fontSize: 11, color: 'var(--ink-3)', flex: 'none' }}>
                      重み {a.weight}
                    </span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', paddingLeft: 132, lineHeight: 1.7 }}>
                    {a.basis}{' '}
                    <DetailChip
                      style={{ fontSize: 11, color: 'var(--blue)' }}
                      detail={{
                        title: `${a.axis} の評価根拠`,
                        tag: estimated ? 'AI推定' : '規則',
                        tone: estimated ? 'amber' : 'blue',
                        meta: [
                          { k: '評価値', v: `${a.value.toFixed(2)}（重み ${a.weight}）` },
                          { k: '算出方法', v: estimated ? 'AIによる推定（類似事例参照）' : '規則ベース（条件照合）' },
                          { k: '対象', v: `${candidateName} × ${site?.name ?? '—'}` }
                        ],
                        body: `${a.basis}。${estimated
                          ? 'AI推定の軸は、参照した類似事例が根拠として記録されます。'
                          : '規則ベースの軸は、照合した条件表が根拠として記録されます。'}`,
                        citations: [a.basis],
                        note: 'この軸の値だけで判断せず、必ず内訳全体と原文をご確認ください。',
                        actions: [{ label: 'AI実行と根拠を見る', href: '/ai-runs', primary: true }]
                      }}
                    >
                      原文を開く
                    </DetailChip>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

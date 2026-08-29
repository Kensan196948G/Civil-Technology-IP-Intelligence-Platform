import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { sql, count } from 'drizzle-orm';
import Link from 'next/link';
import { InfoPage } from '@/components/InfoPage';


const SUB_PAGES = [
  { label: '競合企業', href: '/landscape/competitors' },
  { label: '企業別出願分析', href: '/landscape/by-company' },
  { label: '技術分野比較', href: '/landscape/by-field' },
  { label: '工種別比較', href: '/landscape/by-work-type' },
  { label: '出願推移', href: '/landscape/trend' },
  { label: '共同出願分析', href: '/landscape/co-filing' },
  { label: '大学連携分析', href: '/landscape/university-ties' },
  { label: '技術クラスタ', href: '/landscape/clusters' },
  { label: '技術マップ', href: '/landscape/map' },
  { label: '特許密度', href: '/landscape/density' },
  { label: '成長・衰退領域', href: '/landscape/growth' },
  { label: '新興技術', href: '/landscape/emerging' },
  { label: 'ホワイトスペース候補', href: '/landscape/whitespace' },
  { label: '自社ポジション', href: '/landscape/our-position' }
];

type CountRow = { n: number };
type WorkTypeRow = { work_type: string; n: number };
type ClusterRow = { cluster: string; n: number };

export default async function LandscapePage() {
  const db = getDb(getDatabaseUrl());
  const [patents] = await db.select({ n: count() }).from(s.patents);
  const [competitors] = await db.select({ n: count() }).from(s.competitors);
  const [technologies] = await db.select({ n: count() }).from(s.technologies);
  const [netis] = await db.select({ n: count() }).from(s.netisTechnologies);

  const applicantsRes = await db.execute(sql`select count(distinct applicant_name)::int as n from patents`);
  const countriesRes = await db.execute(sql`select count(distinct country)::int as n from patents`);
  const topWorkTypeRes = await db.execute(sql`
    select wt as work_type, count(*)::int as n
    from patents, unnest(work_types) as wt
    group by wt order by n desc, wt asc limit 1
  `);
  const topClusterRes = await db.execute(sql`
    select left(ipc, 3) as cluster, count(*)::int as n
    from patents, unnest(ipc_codes) as ipc
    group by cluster order by n desc, cluster asc limit 1
  `);

  const applicants = ((applicantsRes.rows as unknown as CountRow[])[0])?.n ?? 0;
  const countries = ((countriesRes.rows as unknown as CountRow[])[0])?.n ?? 0;
  const topWorkType = (topWorkTypeRes.rows as unknown as WorkTypeRow[])[0];
  const topCluster = (topClusterRes.rows as unknown as ClusterRow[])[0];

  return (
    <InfoPage
      title="Patent Landscape"
      moduleCode="S-09 / PATENT LANDSCAPE"
      description="競合企業・出願動向・技術分野の分布を横断的に俯瞰します。数値はすべて現在DBに取り込まれているデモデータからの実集計です。"
      blocks={[
        { label: '取り込み済み特許件数', value: `${patents?.n ?? 0} 件` },
        { label: 'ユニーク出願人数', value: `${applicants} 社` },
        { label: '出願国・地域数', value: `${countries}` },
        { label: '登録競合企業数', value: `${competitors?.n ?? 0} 社` },
        { label: '自社技術台帳件数', value: `${technologies?.n ?? 0} 件` },
        { label: 'NETIS登録技術件数', value: `${netis?.n ?? 0} 件` },
        { label: '最多出願工種', value: topWorkType ? <span className="mono">{topWorkType.work_type}（{topWorkType.n}件）</span> : '—' },
        { label: '最多出願IPCクラスタ', value: topCluster ? <span className="mono">{topCluster.cluster}（{topCluster.n}件）</span> : '—' }
      ]}
      note="各分析（企業別・工種別・技術クラスタ等）の詳細は、下の分析メニューまたはサイドバー配下の各画面で確認できます。"
    >
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          分析メニュー
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1, background: 'var(--line)' }}>
          {SUB_PAGES.map(p => (
            <Link key={p.href} href={p.href} className="card" style={{ borderRadius: 0, padding: '11px 14px', fontSize: 12.5, color: 'var(--ink)', background: 'var(--surface)' }}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>
    </InfoPage>
  );
}

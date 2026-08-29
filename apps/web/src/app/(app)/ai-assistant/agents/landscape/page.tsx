import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { InfoPage } from '@/components/InfoPage';


type CountRow = { key: string; n: number };

export default async function LandscapeAgentPage() {
  const db = getDb(getDatabaseUrl());
  const [byCountry, byApplicant, byIpc] = await Promise.all([
    db.execute(sql`select country as key, count(*)::int as n from patents group by country order by n desc`),
    db.execute(sql`select applicant_name as key, count(*)::int as n from patents group by applicant_name order by n desc limit 10`),
    db.execute(sql`select unnest(ipc_codes) as key, count(*)::int as n from patents group by 1 order by n desc limit 10`)
  ]);
  const country = byCountry.rows as CountRow[];
  const applicant = byApplicant.rows as CountRow[];
  const ipc = byIpc.rows as CountRow[];
  const total = country.reduce((sum, r) => sum + r.n, 0);

  const Table = ({ title, rows }: { title: string; rows: CountRow[] }) => (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 12.5 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ padding: '12px 14px', fontSize: 12.5, color: 'var(--ink-2)' }}>データがありません。</div>
      ) : (
        <table className="plain" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(r => (
              <tr key={r.key}>
                <td style={{ fontSize: 12.5 }}>{r.key}</td>
                <td className="mono" style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'right' }}>{r.n} 件</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <InfoPage
      title="Landscape Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="特許（patents）を国・出願人・IPC分類で集計し、俯瞰的な出願動向（Patent Landscape）を提示するAgentです。"
      blocks={[
        { label: '対象特許件数', value: `${total} 件` },
        { label: '国・地域数', value: `${country.length} か国／地域` }
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <Table title="国・地域別 出願件数" rows={country} />
        <Table title="出願人別 出願件数（上位10）" rows={applicant} />
        <Table title="IPC分類別 出願件数（上位10）" rows={ipc} />
      </div>
    </InfoPage>
  );
}

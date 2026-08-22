import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { InfoPage, type InfoBlock } from '@/components/InfoPage';

export const runtime = 'edge';

function pct(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '—';
}

function rate(part: number, total: number) {
  const color = total === 0 ? 'var(--ink-2)' : part === 0 ? 'var(--green)' : 'var(--amber)';
  return <span style={{ color }}>{part} / {total} 件（{pct(part, total)}）</span>;
}

export default async function DataQualityPage() {
  const db = getDb(getDatabaseUrl());
  const [patentStats, paperStats, netisStats, techStats, sampleStats] = await Promise.all([
    db.execute(sql`select count(*)::int as total, count(*) filter (where abstract is null or abstract = '')::int as missing_abstract, count(*) filter (where application_date is null)::int as missing_date from patents`),
    db.execute(sql`select count(*)::int as total, count(*) filter (where abstract is null or abstract = '')::int as missing_abstract from papers`),
    db.execute(sql`select count(*)::int as total, count(*) filter (where summary is null or summary = '')::int as missing_summary from netis_technologies`),
    db.execute(sql`select count(*)::int as total, count(*) filter (where summary is null or summary = '')::int as missing_summary from technologies`),
    db.execute(sql`
      select
        (select count(*) from patents) + (select count(*) from papers) + (select count(*) from netis_technologies) + (select count(*) from technologies) as total,
        (select count(*) filter (where is_sample) from patents) + (select count(*) filter (where is_sample) from papers)
          + (select count(*) filter (where is_sample) from netis_technologies) + (select count(*) filter (where is_sample) from technologies) as sample_total
    `)
  ]);
  type Row = Record<string, number>;
  const p = (patentStats.rows[0] ?? {}) as Row;
  const pa = (paperStats.rows[0] ?? {}) as Row;
  const ne = (netisStats.rows[0] ?? {}) as Row;
  const te = (techStats.rows[0] ?? {}) as Row;
  const sa = (sampleStats.rows[0] ?? {}) as Row;

  const blocks: InfoBlock[] = [
    { label: '特許：要約欠落率', value: rate(Number(p.missing_abstract ?? 0), Number(p.total ?? 0)) },
    { label: '特許：出願日欠落率', value: rate(Number(p.missing_date ?? 0), Number(p.total ?? 0)) },
    { label: '論文：要約欠落率', value: rate(Number(pa.missing_abstract ?? 0), Number(pa.total ?? 0)) },
    { label: 'NETIS技術：概要欠落率', value: rate(Number(ne.missing_summary ?? 0), Number(ne.total ?? 0)) },
    { label: '技術マスタ：概要欠落率', value: rate(Number(te.missing_summary ?? 0), Number(te.total ?? 0)) },
    { label: 'デモデータ比率（is_sample）', value: `${Number(sa.sample_total ?? 0)} / ${Number(sa.total ?? 0)} 件（${pct(Number(sa.sample_total ?? 0), Number(sa.total ?? 0))}）` }
  ];

  return (
    <InfoPage
      title="データ品質"
      moduleCode="S-18k / DATA QUALITY"
      description="特許・論文・NETIS技術・技術マスタの主要項目について、欠落率を横断集計した品質ダッシュボードです。"
      badge="MVP"
      blocks={blocks}
      note="本画面はMVPの簡易品質指標です。本番設計フェーズでは、項目別スコアリング・しきい値アラート・改善履歴のトラッキングを備えたデータ品質エンジンとして拡張予定です（バックログ）。"
    />
  );
}

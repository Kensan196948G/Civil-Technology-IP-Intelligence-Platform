// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
//
// レポート種別（kind。actions.ts の ALLOWED_KINDS）ごとに、関連する主要テーブルから
// 「件数サマリ＋上位N件の一覧テーブル」を集計し、出力形式に依存しない中間表現
// （ReportData）へ組み立てる。MVPスコープにつき、全14種別で個別に凝った文面は作らず、
// 既存スキーマから妥当な主テーブルへ汎用的にマッピングする（マッピングしきれない
// 種別は概要のみのレポートとする）。
import { desc, sql } from 'drizzle-orm';
import type { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { REPORT_KIND, ymd } from '@/lib/labels';
import type { ReportData, ReportSection, ReportTable } from './types';

type DbLike = ReturnType<typeof getDb>;

/** 一覧テーブルに含める上位N件（README §16 指示のとおり20件）。 */
const TOP_N = 20;

function toRows(records: Record<string, unknown>[], columns: { key: string; label: string; format?: (v: unknown) => string | number }[]): ReportTable {
  return {
    columns: columns.map(c => c.label),
    rows: records.map(r => columns.map(c => {
      const v = r[c.key];
      if (c.format) return c.format(v);
      if (v === null || v === undefined) return '—';
      if (Array.isArray(v)) return v.join(', ') || '—';
      if (typeof v === 'string' || typeof v === 'number') return v;
      return String(v);
    }))
  };
}

/** patents テーブルの上位N件（発明の名称・出願人・国・公開日）。 */
async function patentsSection(db: DbLike, heading: string): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.patents))[0]?.n ?? 0;
  const rows = await db.select({
    publicationNo: s.patents.publicationNo,
    title: s.patents.title,
    applicantName: s.patents.applicantName,
    country: s.patents.country,
    publicationDate: s.patents.publicationDate
  }).from(s.patents).orderBy(desc(s.patents.createdAt)).limit(TOP_N);

  return {
    heading,
    summary: `対象特許 ${n} 件のうち、直近登録された上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'publicationNo', label: '公開/公報番号' },
      { key: 'title', label: '発明の名称' },
      { key: 'applicantName', label: '出願人' },
      { key: 'country', label: '国' },
      { key: 'publicationDate', label: '公開日', format: v => v ? ymd(v) : '—' }
    ])
  };
}

/** technologies テーブルの上位N件。 */
async function technologiesSection(db: DbLike): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.technologies))[0]?.n ?? 0;
  const rows = await db.select({
    name: s.technologies.name,
    kind: s.technologies.kind,
    maturity: s.technologies.maturity,
    workTypes: s.technologies.workTypes
  }).from(s.technologies).orderBy(desc(s.technologies.createdAt)).limit(TOP_N);

  return {
    heading: '対象技術一覧',
    summary: `登録技術 ${n} 件のうち、直近登録された上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'name', label: '技術名' },
      { key: 'kind', label: '種別' },
      { key: 'maturity', label: '成熟度' },
      { key: 'workTypes', label: '工種' }
    ])
  };
}

/** competitors テーブルの一覧。 */
async function competitorsSection(db: DbLike): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.competitors))[0]?.n ?? 0;
  const rows = await db.select({
    name: s.competitors.name,
    category: s.competitors.category,
    createdAt: s.competitors.createdAt
  }).from(s.competitors).orderBy(desc(s.competitors.createdAt)).limit(TOP_N);

  return {
    heading: '競合企業一覧',
    summary: `登録競合企業 ${n} 件のうち、上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'name', label: '企業名' },
      { key: 'category', label: '分野' },
      { key: 'createdAt', label: '登録日', format: v => ymd(v) }
    ])
  };
}

/** claim_analyses（他社特許 vs 自社案の比較）に、特許タイトル・技術名を添えた一覧。 */
async function claimAnalysesSection(db: DbLike, heading: string): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.claimAnalyses))[0]?.n ?? 0;
  const rows = await db.select({
    patentTitle: s.patents.title,
    applicantName: s.patents.applicantName,
    technologyName: s.technologies.name,
    createdAt: s.claimAnalyses.createdAt
  })
    .from(s.claimAnalyses)
    .innerJoin(s.patents, sql`${s.claimAnalyses.patentId} = ${s.patents.id}`)
    .innerJoin(s.technologies, sql`${s.claimAnalyses.technologyId} = ${s.technologies.id}`)
    .orderBy(desc(s.claimAnalyses.createdAt))
    .limit(TOP_N);

  return {
    heading,
    summary: `Claim比較 ${n} 件のうち、直近実施された上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'patentTitle', label: '対比した他社特許' },
      { key: 'applicantName', label: '出願人' },
      { key: 'technologyName', label: '自社技術/工法' },
      { key: 'createdAt', label: '実施日', format: v => ymd(v) }
    ])
  };
}

/** field_applications（現場適用性評価）の一覧。 */
async function fieldApplicationsSection(db: DbLike): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.fieldApplications))[0]?.n ?? 0;
  const rows = await db.select({
    candidateType: s.fieldApplications.candidateType,
    candidateId: s.fieldApplications.candidateId,
    score: s.fieldApplications.score,
    createdAt: s.fieldApplications.createdAt
  }).from(s.fieldApplications).orderBy(desc(s.fieldApplications.createdAt)).limit(TOP_N);

  return {
    heading: '現場適用性評価一覧',
    summary: `評価済み ${n} 件のうち、直近実施された上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'candidateType', label: '候補種別' },
      { key: 'candidateId', label: '候補ID' },
      { key: 'score', label: 'スコア' },
      { key: 'createdAt', label: '評価日', format: v => ymd(v) }
    ])
  };
}

/** poc_experiments（R&D PoC）の一覧。 */
async function pocExperimentsSection(db: DbLike): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.pocExperiments))[0]?.n ?? 0;
  const rows = await db.select({
    title: s.pocExperiments.title,
    result: s.pocExperiments.result,
    costYen: s.pocExperiments.costYen,
    createdAt: s.pocExperiments.createdAt
  }).from(s.pocExperiments).orderBy(desc(s.pocExperiments.createdAt)).limit(TOP_N);

  return {
    heading: 'R&D PoC実証一覧',
    summary: `PoC実証 ${n} 件のうち、直近実施された上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'title', label: 'テーマ' },
      { key: 'result', label: '結果' },
      { key: 'costYen', label: '実証費（円）' },
      { key: 'createdAt', label: '登録日', format: v => ymd(v) }
    ])
  };
}

/** licenses（ライセンス評価）の一覧。 */
async function licensesSection(db: DbLike): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.licenses))[0]?.n ?? 0;
  const rows = await db.select({
    kind: s.licenses.kind,
    counterpartName: s.licenses.counterpartName,
    subjectType: s.licenses.subjectType,
    status: s.licenses.status,
    createdAt: s.licenses.createdAt
  }).from(s.licenses).orderBy(desc(s.licenses.createdAt)).limit(TOP_N);

  return {
    heading: 'ライセンス評価一覧',
    summary: `ライセンス案件 ${n} 件のうち、直近登録された上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'kind', label: '種別（In/Out）' },
      { key: 'counterpartName', label: '相手方' },
      { key: 'subjectType', label: '対象' },
      { key: 'status', label: '状況' },
      { key: 'createdAt', label: '登録日', format: v => ymd(v) }
    ])
  };
}

/** innovation_opportunities（ホワイトスペース分析）の一覧。 */
async function innovationOpportunitiesSection(db: DbLike): Promise<ReportSection> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.innovationOpportunities))[0]?.n ?? 0;
  const rows = await db.select({
    title: s.innovationOpportunities.title,
    opportunityScore: s.innovationOpportunities.opportunityScore,
    status: s.innovationOpportunities.status,
    createdAt: s.innovationOpportunities.createdAt
  }).from(s.innovationOpportunities).orderBy(desc(s.innovationOpportunities.opportunityScore)).limit(TOP_N);

  return {
    heading: 'ホワイトスペース候補一覧',
    summary: `候補テーマ ${n} 件のうち、機会スコア上位 ${Math.min(TOP_N, n)} 件を表示する。`,
    table: toRows(rows, [
      { key: 'title', label: '研究テーマ候補' },
      { key: 'opportunityScore', label: '機会スコア' },
      { key: 'status', label: '状況' },
      { key: 'createdAt', label: '登録日', format: v => ymd(v) }
    ])
  };
}

/** landscape（Patent Landscape）: IPCコード別・出願人別の件数集計。 */
async function landscapeSection(db: DbLike): Promise<ReportSection[]> {
  const n = (await db.select({ n: sql<number>`count(*)::int` }).from(s.patents))[0]?.n ?? 0;

  const byIpc = await db.execute(sql`
    select left(ipc, 3) as ipc_cluster, count(*)::int as n
    from patents, unnest(ipc_codes) as ipc
    group by left(ipc, 3)
    order by n desc, ipc_cluster asc
    limit ${TOP_N}
  `);
  const byApplicant = await db.execute(sql`
    select applicant_name, count(*)::int as n, count(distinct country)::int as countries
    from patents
    group by applicant_name
    order by n desc, applicant_name asc
    limit ${TOP_N}
  `);

  return [
    {
      heading: 'IPCクラスタ別 件数',
      summary: `対象特許 ${n} 件を IPC分類（上3桁）で集計した。`,
      table: toRows(byIpc.rows as Record<string, unknown>[], [
        { key: 'ipc_cluster', label: 'IPCクラスタ' },
        { key: 'n', label: '件数' }
      ])
    },
    {
      heading: '出願人別 件数',
      summary: `対象特許 ${n} 件を出願人で集計し、件数上位 ${TOP_N} 社を表示する。`,
      table: toRows(byApplicant.rows as Record<string, unknown>[], [
        { key: 'applicant_name', label: '出願人' },
        { key: 'n', label: '件数' },
        { key: 'countries', label: '出願国数' }
      ])
    }
  ];
}

/** マッピング対象外の種別向け: 主要テーブルの件数のみを示す概要レポート。 */
async function overviewSection(db: DbLike): Promise<ReportSection> {
  const [patentsRows, technologiesRows, papersRows, netisRows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(s.patents),
    db.select({ n: sql<number>`count(*)::int` }).from(s.technologies),
    db.select({ n: sql<number>`count(*)::int` }).from(s.papers),
    db.select({ n: sql<number>`count(*)::int` }).from(s.netisTechnologies)
  ]);
  const patentsN = patentsRows[0]?.n ?? 0;
  const technologiesN = technologiesRows[0]?.n ?? 0;
  const papersN = papersRows[0]?.n ?? 0;
  const netisN = netisRows[0]?.n ?? 0;

  return {
    heading: '全体概要',
    summary: '本種別は個別集計ロジック未定義のため、主要テーブルの件数概要のみを表示する。',
    table: {
      columns: ['対象', '件数'],
      rows: [
        ['特許', patentsN],
        ['技術（工法・材料・機械）', technologiesN],
        ['論文', papersN],
        ['NETIS登録技術', netisN]
      ]
    }
  };
}

/**
 * レポート種別（kind）に応じてセクション群を組み立てる。
 * README §16 の指示どおり、全14種別を個別に凝ったロジックにはせず、既存スキーマから
 * 妥当な主テーブルへ汎用的にマッピングする。マッピングしきれない種別は概要のみとする。
 */
async function buildSections(db: DbLike, kind: string): Promise<ReportSection[]> {
  switch (kind) {
    case 'patent-survey':
      return [await patentsSection(db, '対象特許一覧')];
    case 'prior-art':
      return [await patentsSection(db, '先行技術（特許）候補一覧')];
    case 'tech-survey':
      return [await technologiesSection(db)];
    case 'claim-compare':
      return [await claimAnalysesSection(db, 'Claim比較結果一覧')];
    case 'novelty':
      return [await claimAnalysesSection(db, '新規性レビュー対象一覧')];
    case 'inventive-step':
      return [await claimAnalysesSection(db, '進歩性レビュー対象一覧')];
    case 'ai-examine':
      return [await claimAnalysesSection(db, 'AI模擬審査 対象一覧')];
    case 'competitor':
      return [await competitorsSection(db)];
    case 'landscape':
      return await landscapeSection(db);
    case 'whitespace':
      return [await innovationOpportunitiesSection(db)];
    case 'field-application':
      return [await fieldApplicationsSection(db)];
    case 'rnd':
      return [await pocExperimentsSection(db)];
    case 'licensing':
      return [await licensesSection(db)];
    case 'executive':
    default:
      return [await overviewSection(db)];
  }
}

export async function buildReportData(db: DbLike, kind: string, title: string): Promise<ReportData> {
  const sections = await buildSections(db, kind);
  return {
    title,
    kindLabel: REPORT_KIND[kind]?.label ?? kind,
    generatedAt: new Date(),
    sections
  };
}

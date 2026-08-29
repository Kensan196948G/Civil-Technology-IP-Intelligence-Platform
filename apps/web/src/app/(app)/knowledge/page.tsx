export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const KIND_LABEL: Record<string, string> = { tech: '技術ナレッジ', patent: '特許ナレッジ', paper: '論文ナレッジ', netis: 'NETISナレッジ' };

export default async function KnowledgePage({ searchParams }: { searchParams: { kind?: string } }) {
  const db = getDb(getDatabaseUrl());
  const kind = searchParams.kind ?? 'tech';

  type Row = { id: string; title: string; sub: string; href: string };
  const rows: Row[] = kind === 'patent'
    ? (await db.select().from(s.patents).orderBy(desc(s.patents.retrievedAt))).map(p => ({ id: p.id, title: p.title, sub: p.applicantName, href: `/patents/${p.id}` }))
    : kind === 'paper'
    ? (await db.select().from(s.papers)).map(p => ({ id: p.id, title: p.title, sub: p.venue ?? '—', href: '' }))
    : kind === 'netis'
    ? (await db.select().from(s.netisTechnologies)).map(n => ({ id: n.id, title: n.name, sub: n.category ?? '—', href: `/netis/${n.id}` }))
    : (await db.select().from(s.technologies).orderBy(desc(s.technologies.createdAt))).map(t => ({ id: t.id, title: t.name, sub: t.kind, href: '' }));

  return (
    <ListView
      title={`ナレッジ — ${KIND_LABEL[kind] ?? kind}`}
      moduleCode="S-21 / KNOWLEDGE"
      description="蓄積された技術・特許・論文・NETIS情報を企業ナレッジとして横断参照します。"
      rows={rows}
      emptyMessage="該当するナレッジはまだありません。"
      rowHref={row => row.href}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'sub', render: row => row.sub }
      ]}
    />
  );
}

import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

// M29 IP Entity Intelligence — 出願人・権利者・機関の名寄せと企業グループ。
// 要件: docs/90-project/06-first-wave-fr-drafts.md（FR-M29-001〜005）
// 原則: 名寄せは自動確定しない（低確信は人間確認候補へ。FR-M29-003）。

const KIND_META: Record<string, { label: string; color: string }> = {
  company: { label: '企業', color: 'var(--blue)' },
  institution: { label: '機関', color: '#7c5cbf' },
  person: { label: '個人', color: '#1e7d46' },
  group: { label: 'グループ', color: '#b7791f' }
};

export default async function EntitiesPage() {
  const db = getDb(getDatabaseUrl());
  const entities = await db.select().from(s.ipEntities).orderBy(asc(s.ipEntities.canonicalName));
  const aliases = await db.select().from(s.entityAliases);
  const patents = await db.select({ id: s.patents.id, applicant: s.patents.applicantName }).from(s.patents);

  const aliasByEntity = new Map<string, string[]>();
  for (const a of aliases) {
    const list = aliasByEntity.get(a.entityId) ?? [];
    list.push(a.alias);
    aliasByEntity.set(a.entityId, list);
  }
  const entityById = new Map(entities.map(e => [e.id, e]));

  // 出願人名（表記ゆれ含む）→ 正規エンティティの逆引き
  const applicantToEntity = new Map<string, string>();
  for (const e of entities) {
    applicantToEntity.set(e.canonicalName, e.id);
    for (const alias of aliasByEntity.get(e.id) ?? []) applicantToEntity.set(alias, e.id);
  }
  const countByEntity = new Map<string, number>();
  for (const p of patents) {
    const eid = applicantToEntity.get(p.applicant);
    if (eid) countByEntity.set(eid, (countByEntity.get(eid) ?? 0) + 1);
  }

  const rows = entities.map(e => {
    const parent = e.parentEntityId ? entityById.get(e.parentEntityId) : undefined;
    return {
      id: e.id,
      canonicalName: e.canonicalName,
      kind: e.kind,
      country: e.country ?? '—',
      parent: parent?.canonicalName ?? '—',
      aliases: aliasByEntity.get(e.id) ?? [],
      applicantCount: countByEntity.get(e.id) ?? 0
    };
  });

  return (
    <ListView
      title="出願人・権利者 名寄せ（Entity）"
      moduleCode="M29 / IP ENTITY"
      description="表記ゆれ（株式会社ABC／ABC CONSTRUCTION CO.,LTD. 等）を正規エンティティに束ね、企業グループ（親子）を管理します。特許の出願人名がエイリアスに一致した件数を表示（名寄せの事故＝「競合A社は20件→グループ計120件」の防止が狙い）。"
      badge="第一拡張群"
      rows={rows}
      emptyMessage="IPエンティティの登録がまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => (
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 700 }}>{row.canonicalName}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>
              {row.aliases.length > 0 ? `別名: ${row.aliases.slice(0, 2).join(' / ')}${row.aliases.length > 2 ? ` ほか${row.aliases.length - 2}` : ''}` : '別名なし'}
            </span>
          </span>
        ) },
        { key: 'kind', render: row => {
          const meta = KIND_META[row.kind] ?? { label: row.kind, color: 'var(--ink-3)' };
          return <span style={{ fontSize: 11, fontWeight: 700, color: meta.color }}>{meta.label}</span>;
        } },
        { key: 'parent', render: row => row.parent === '—'
          ? <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>—</span>
          : <span style={{ fontSize: 11.5 }}>👥 {row.parent}</span> },
        { key: 'country', render: row => <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{row.country}</span> },
        { key: 'patents', mono: true, render: row => row.applicantCount > 0
          ? <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{row.applicantCount} 件</span>
          : <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>0 件</span> }
      ]}
    />
  );
}

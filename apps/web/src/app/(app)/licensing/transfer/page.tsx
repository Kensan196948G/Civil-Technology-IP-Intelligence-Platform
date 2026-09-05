import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

// M44 Technology Transfer Pipeline — 技術獲得・供与の案件を
// Buy/Build/Partner/License/Joint-R&D モードで管理する。

const MODE_META: Record<string, { label: string; icon: string }> = {
  buy: { label: 'Buy（購入）', icon: '💵' },
  build: { label: 'Build（自社開発）', icon: '🔨' },
  partner: { label: 'Partner（提携）', icon: '🤝' },
  license: { label: 'License（ライセンス）', icon: '🔓' },
  joint_rd: { label: 'Joint R&D（共同研究）', icon: '🔬' }
};

const DIRECTION_META: Record<string, { label: string; color: string }> = {
  inbound: { label: '技術導入', color: 'var(--blue)' },
  outbound: { label: '技術供与', color: 'var(--green)' }
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  scouting: { label: '調査中', color: 'var(--ink-2)' },
  evaluating: { label: '評価中', color: 'var(--blue)' },
  negotiating: { label: '交渉中', color: 'var(--amber)' },
  agreed: { label: '合意', color: 'var(--green)' },
  abandoned: { label: '中止', color: 'var(--brick)' }
};

export default async function TransferPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.transferCases).orderBy(desc(s.transferCases.createdAt));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>技術トランスファー パイプライン</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M44 / TRANSFER PIPELINE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        技術獲得・供与の案件を Buy／Build／Partner／License／Joint-R&amp;D のモードで管理し、
        パイプライン全体を俯瞰します。最終判断は技術・知財・経営の共同判断です。
      </p>

      <ListView
        title="技術トランスファー パイプライン"
        moduleCode="M44 / TRANSFER PIPELINE"
        rows={rows}
        emptyMessage="技術トランスファーの案件はまだありません。"
        fields={[
          { key: 'direction', render: row => {
            const d = DIRECTION_META[row.direction] ?? { label: row.direction, color: 'var(--ink-2)' };
            return <span className="badge" style={{ color: d.color, border: `1px solid ${d.color}` }}>{d.label}</span>;
          } },
          { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
          { key: 'mode', render: row => {
            const m = MODE_META[row.mode] ?? { label: row.mode, icon: '•' };
            return <span style={{ fontSize: 12 }}>{m.icon} {m.label}</span>;
          } },
          { key: 'counterpart', render: row => <span style={{ fontSize: 12 }}>{row.counterpartName}</span> },
          { key: 'status', render: row => {
            const st = STATUS_META[row.status] ?? { label: row.status, color: 'var(--ink-2)' };
            return <span className="badge" style={{ color: st.color, border: `1px solid ${st.color}` }}>{st.label}</span>;
          } }
        ]}
      />
    </div>
  );
}

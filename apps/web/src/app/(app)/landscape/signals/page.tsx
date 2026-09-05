import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

// M43 Competitive Signal Intelligence — 特許以外の競合兆候（論文・ニュース・採用情報等）を
// 時系列で検知する。M10 Competitor Intelligence / M19 Watch を強化する。

const KIND_META: Record<string, { label: string; icon: string; color: string }> = {
  paper: { label: '論文発表', icon: '📄', color: '#7c5cbf' },
  news: { label: 'ニュース', icon: '📰', color: 'var(--blue)' },
  hiring: { label: '採用', icon: '👥', color: '#b7791f' },
  joint_research: { label: '共同研究', icon: '🤝', color: 'var(--green)' },
  product_launch: { label: '製品発表', icon: '🚀', color: 'var(--brick)' },
  award: { label: '受賞', icon: '🏆', color: 'var(--amber)' },
  funding: { label: '資金調達', icon: '💰', color: 'var(--purple)' }
};

const STRENGTH_META: Record<string, { label: string; color: string }> = {
  high: { label: '高', color: 'var(--brick)' },
  medium: { label: '中', color: 'var(--amber)' },
  low: { label: '低', color: 'var(--ink-2)' }
};

export default async function SignalsPage() {
  const db = getDb(getDatabaseUrl());
  const signals = await db.select().from(s.competitiveSignals).orderBy(desc(s.competitiveSignals.detectedOn));

  const byStrength = {
    high: signals.filter(s => s.strength === 'high').length,
    medium: signals.filter(s => s.strength === 'medium').length,
    low: signals.filter(s => s.strength === 'low').length
  };
  const kinds = [...new Set(signals.map(s => s.kind))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>競合シグナル（特許以外の兆候）</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M43 / COMPETITIVE SIGNAL</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        競合企業の技術動向を、特許以外の兆候（論文発表・共同研究・製品発表・採用・資金調達等）から時系列で検知します。
        M10 Competitor Intelligence・M19 Watch を強化する「Technology Early Signal」レイヤーです。
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--brick)' }}>{byStrength.high}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>強度: 高</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--amber)' }}>{byStrength.medium}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>強度: 中</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--ink-2)' }}>{byStrength.low}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>強度: 低</span>
        </div>
        <div className="card" style={{ padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span className="mono" style={{ fontSize: 20, color: 'var(--blue)' }}>{kinds.length}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>兆候種別</span>
        </div>
      </div>

      {signals.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          競合シグナルがまだ登録されていません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {signals.map(s => {
          const kind = KIND_META[s.kind] ?? { label: s.kind, icon: '•', color: 'var(--ink-2)' };
          const strength = STRENGTH_META[s.strength] ?? { label: s.strength, color: 'var(--ink-2)' };
          return (
            <div key={s.id} className="card" style={{ padding: '11px 15px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14 }}>{kind.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: kind.color }}>{kind.label}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{s.competitorName}</span>
                <span className="badge" style={{ color: strength.color, border: `1px solid ${strength.color}`, fontSize: 10, marginLeft: 'auto' }}>
                  強度 {strength.label}
                </span>
              </div>
              <div style={{ fontSize: 13 }}>{s.title}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
                <span className="mono">{s.detectedOn}</span> ｜ 出典: {s.source}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

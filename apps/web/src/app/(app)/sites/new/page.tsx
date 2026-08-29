import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';
import { createSite } from './actions';


// /tech/civil-category/* と同じ工種区分コード・ラベルを使う（現場のタグ付けと技術検索の
// 工種区分を揃えることで、後の現場適用性評価の候補技術検索と整合させるため）。
const WORK_TYPE_OPTIONS = [
  { code: 'port', label: '港湾・海洋' }, { code: 'river', label: '河川' },
  { code: 'road', label: '道路' }, { code: 'bridge', label: '橋梁' },
  { code: 'tunnel', label: 'トンネル' }, { code: 'foundation', label: '地盤・基礎' },
  { code: 'earthwork', label: '土工' }, { code: 'dredging', label: '浚渫・埋立' },
  { code: 'concrete', label: 'コンクリート' }, { code: 'maintenance', label: '維持管理' },
  { code: 'repair', label: '補修・補強' }, { code: 'disaster-prevention', label: '防災' },
  { code: 'environment', label: '環境' }
] as const;

export default async function SiteConditionInputPage() {
  const db = getDb(getDatabaseUrl());
  const sites = await db.select().from(s.sites).orderBy(desc(s.sites.createdAt));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>現場条件入力</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-17 / SITE CONDITIONS</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        新しい現場の工種区分・地盤や海象などの条件を登録します。ここで登録した条件は、現場適用性評価（工種・地盤・気象・海象などの軸別スコア）の判定材料として使われます。
      </p>

      <form action={createSite} className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '2 1 260px' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>現場名<span style={{ color: 'var(--brick)' }}> *</span></span>
            <input name="name" required placeholder="例：◯◯港 岸壁改良工事"
              style={{ height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13.5 }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px' }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>現場コード（任意）</span>
            <input name="code" placeholder="例：SITE-002"
              style={{ height: 36, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13.5 }} className="mono" />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>工種区分（複数選択可）</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {WORK_TYPE_OPTIONS.map(opt => (
              <label key={opt.code} style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5,
                border: '1px solid var(--line)', borderRadius: 3, padding: '4px 9px'
              }}>
                <input type="checkbox" name="workTypes" value={opt.code} />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>現場条件（任意・分かる範囲でご記入ください）</span>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>有義波高（m）／海象条件</span>
              <input name="marineWaveM" type="number" step="0.1" min="0" placeholder="例：2.0"
                style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13.5 }} className="mono" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>地盤 N値</span>
              <input name="groundN" type="number" step="1" min="0" placeholder="例：14"
                style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13.5 }} className="mono" />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>作業ヤード面積（m²）</span>
              <input name="yardM2" type="number" step="1" min="0" placeholder="例：640"
                style={{ height: 34, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 13.5 }} className="mono" />
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', height: 38 }}>
          この内容で現場を登録する
        </button>
        <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>
          登録後、この現場の「困りごと」登録画面に移動します。登録した条件は現場適用性評価のAI判定根拠として使われます（監査ログに記録されます）。
        </div>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>登録済みの現場（{sites.length}件）</div>
        {sites.length === 0 && (
          <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
            現場データがまだありません。上のフォームから最初の現場を登録してください。
          </div>
        )}
        {sites.map(site => (
          <Link key={site.id} href={`/sites/${site.id}/issue`} className="card" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)' }}>
            <span style={{ fontWeight: 700 }}>{site.name}</span>
            {site.code && <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{site.code}</span>}
            {site.workTypes.length > 0 && (
              <span style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {site.workTypes.map(wt => (
                  <span key={wt} className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 6px' }}>
                    {WORK_TYPE_OPTIONS.find(o => o.code === wt)?.label ?? wt}
                  </span>
                ))}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

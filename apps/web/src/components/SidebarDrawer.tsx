'use client';
import Link from 'next/link';
import { ModulesGrid } from './ModulesGrid';
import { Tag, Note } from './ui';
import type { Convo } from './demo';

/** サイドバーから開く右側ドロワー（全モジュール / 最近の会話）。 */

export function SidebarDrawer({
  kind, convo, onClose
}: { kind: 'convo' | 'modules'; convo?: Convo; onClose: () => void }) {
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <div className="drawer" role="dialog" aria-label={kind === 'convo' ? '最近の会話' : '全モジュール'}>
        <div className="drawer-head">
          <div className="drawer-title" style={{ fontSize: 14 }}>
            {kind === 'convo' ? convo?.label ?? '最近の会話' : '全モジュール（20分類）'}
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <div className="drawer-body">
          {kind === 'modules' ? (
            <ModulesGrid compact />
          ) : convo ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: '#E08A2B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600, flex: 'none' }}>AI</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{convo.agent}</span>
                <span style={{ flex: 1 }} />
                <span className="mono" style={{ fontSize: 11, color: '#1F8255', background: '#E4F3EC', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>根拠 {convo.evidence}件</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{convo.scope}</div>

              <div style={{ background: '#E9F0FB', borderRadius: 10, padding: '11px 14px', fontSize: 13, lineHeight: 1.8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#5A6678', marginBottom: 4 }}>質問</div>
                {convo.q}
              </div>

              <div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#5A6678', marginBottom: 4 }}>回答（ダミー）</div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.9 }}>{convo.answer}</p>
              </div>

              {convo.candidates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: '#5A6678' }}>候補</div>
                  {convo.candidates.map(c => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 8, padding: '10px 12px' }}>
                      <span className="mono" style={{ fontSize: 15, fontWeight: 600, color: c.tone, flex: 'none', width: 30, textAlign: 'right' }}>{c.score}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600 }}>{c.name}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--ink-3)' }}>{c.meta}</span>
                      </span>
                      <Tag fg={c.tagFg} bg={c.tagBg}>{c.tag}</Tag>
                    </div>
                  ))}
                </div>
              )}

              {convo.citations.length > 0 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>出どころ</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {convo.citations.map(cit => (
                      <span key={cit} className="mono" style={{ background: 'var(--sunk)', color: 'var(--ink-2)', borderRadius: 5, padding: '3px 8px', fontSize: 11 }}>{cit}</span>
                    ))}
                  </div>
                </div>
              )}

              <Note>
                スコア・類似度は<strong>専門家が見る場所を絞るための目印</strong>です。権利侵害や導入可否の判断ではありません（この注記は消せません）。
              </Note>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>会話データがありません。</div>
          )}
        </div>

        {kind === 'convo' && convo && (
          <div className="drawer-foot">
            <Link href="/ai-assistant" onClick={onClose} className="btn btn-primary" style={{ fontSize: 12.5, padding: '8px 14px', height: 'auto' }}>Copilotで開く</Link>
            <Link href="/field" onClick={onClose} className="btn btn-secondary" style={{ fontSize: 12.5, padding: '8px 14px', height: 'auto' }}>現場スコアの内訳を見る</Link>
            <Link href="/investigations" onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12.5, padding: '8px 14px', height: 'auto' }}>調査案件として保存</Link>
          </div>
        )}
      </div>
    </>
  );
}

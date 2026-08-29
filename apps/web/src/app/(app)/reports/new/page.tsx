export const runtime = 'edge';
import { createReportAction } from './actions';


const KIND_OPTIONS = [
  ['tech-survey', '技術調査報告書'], ['patent-survey', '特許調査報告書'], ['prior-art', '先行技術調査書'],
  ['claim-compare', 'Claim比較レポート'], ['novelty', '新規性レビュー'], ['inventive-step', '進歩性レビュー'],
  ['ai-examine', 'AI模擬審査報告'], ['competitor', '競合分析'], ['landscape', 'Patent Landscape'],
  ['whitespace', 'ホワイトスペース分析'], ['field-application', '現場適用性評価'], ['rnd', 'R&D提案'],
  ['licensing', 'ライセンス評価'], ['executive', '経営サマリー']
] as const;

export default function NewReportPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>レポート作成</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-23 / REPORT AUTHORING</span>
      </div>
      <div className="notice notice-blue" style={{ fontSize: 12 }}>
        MVPでは出力履歴への記録のみ行います（実際のPDF/DOCX/XLSX生成は本番設計で実装予定のバックログです）。
      </div>
      <form action={createReportAction} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          種別
          <select name="kind" required style={{ height: 34, border: '1px solid var(--line)', borderRadius: 3, padding: '0 8px' }}>
            {KIND_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          タイトル
          <input name="title" required placeholder="例：港湾ケーソン据付技術 特許調査報告書"
            style={{ height: 34, border: '1px solid var(--line)', borderRadius: 3, padding: '0 8px' }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
          出力形式
          <select name="format" required defaultValue="html" style={{ height: 34, border: '1px solid var(--line)', borderRadius: 3, padding: '0 8px' }}>
            <option value="html">HTML</option>
            <option value="pdf">PDF</option>
            <option value="docx">DOCX</option>
            <option value="xlsx">XLSX</option>
          </select>
        </label>
        <button type="submit" className="btn btn-primary">作成して出力履歴へ記録</button>
      </form>
    </div>
  );
}

const FAQS = [
  { q: 'AIの「類似率」は権利侵害の判断ですか？', a: 'いいえ。AIが算出する一致率は専門家が確認すべき箇所を絞るための目印であり、侵害可能性の結論として社外へ提示することはできません。' },
  { q: 'AIは発明の採否や承認を決定しますか？', a: 'いいえ。AIは一次レビューと根拠の提示のみを行い、最終判断は必ず人間（技術・知財・法務の各担当者）が行います。' },
  { q: '表示されているデータは実データですか？', a: 'MVP環境で表示されるデータはすべてデモ用のダミーデータです。実在の人物・企業・案件とは関係ありません。' },
  { q: 'AIの回答の根拠はどこで確認できますか？', a: '「AI実行履歴・根拠」画面で、各AI実行がどの特許・NETIS・自社技術データを参照したかを確認できます。' },
  { q: '契約や法務判断はこのシステムで完結しますか？', a: 'いいえ。正式な契約・権利判断はConstruction-LegalOps-DXと連携します。このシステムは技術・知財インテリジェンスの正本です。' }
];

export const runtime = 'edge';

export default function FaqPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>FAQ</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-21 / KNOWLEDGE FAQ</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {FAQS.map((f, i) => (
          <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>Q. {f.q}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>A. {f.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

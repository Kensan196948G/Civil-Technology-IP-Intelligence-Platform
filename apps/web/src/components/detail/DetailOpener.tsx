'use client';

import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { useDetail } from './DetailDrawer';
import type { DetailSpec } from './types';

// 行やチップはボタン要素にしたいところだが、行の中にさらにリンク（「特許詳細を見る →」など）を
// 置く画面があり、button/a の入れ子は不正なHTMLになる。role="button" の div にして、
// 内側のリンクのクリックは stopPropagation で通す構成にしている。

function useOpenHandlers(detail: DetailSpec) {
  const { open } = useDetail();
  return {
    onClick: () => open(detail),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(detail);
      }
    }
  };
}

/** 一覧の1行。クリックで詳細ドロワーを開く。 */
export function DetailRow({
  detail, children, className = 'row', style
}: { detail: DetailSpec; children: ReactNode; className?: string; style?: CSSProperties }) {
  const handlers = useOpenHandlers(detail);
  return (
    <div role="button" tabIndex={0} className={className} style={{ cursor: 'pointer', ...style }} {...handlers}>
      {children}
    </div>
  );
}

/** 表の1行。 */
export function DetailTr({ detail, children }: { detail: DetailSpec; children: ReactNode }) {
  const handlers = useOpenHandlers(detail);
  return (
    <tr role="button" tabIndex={0} className="clickable" {...handlers}>
      {children}
    </tr>
  );
}

/** チップ・バッジ・小さな文字リンクなど、インラインの起点。 */
export function DetailChip({
  detail, children, className, style
}: { detail: DetailSpec; children: ReactNode; className?: string; style?: CSSProperties }) {
  const handlers = useOpenHandlers(detail);
  return (
    <span role="button" tabIndex={0} className={className} style={{ cursor: 'pointer', ...style }} {...handlers}>
      {children}
    </span>
  );
}

/**
 * 行の中に置くリンク。親の詳細ドロワーではなくリンク先へ遷移させる。
 * （Linkをそのまま置くと親のonClickも走ってドロワーが同時に開いてしまう）
 */
export function StopPropagation({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'contents' }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      {children}
    </span>
  );
}

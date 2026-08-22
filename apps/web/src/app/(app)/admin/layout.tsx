import type { ReactNode } from 'react';
import { requireRole } from '@/lib/auth/require-role';

// docs/10-requirements/05-rbac-matrix.md M25 Administration: executive(R) / sysadmin(R/W) のみ。
// このlayoutは apps/web/src/app/(app)/admin/ 配下の全ページに自動適用される
// （Next.js App Routerの仕様上、ネストしたlayoutは配下の全ルートをラップする）。
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole(['executive', 'sysadmin']);
  return <>{children}</>;
}

import { describe, it, expect, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import {
  defaultVisibleClassifications,
  canViewRow,
  canViewRowAudited,
  isC3ReaderRole,
  visibleWhere
} from './row-visibility';

// StringChunk/SQL は drizzle-orm 内部の具象クラスを import せずダックタイピングで
// 再帰的にテキスト化する（sql`` テンプレートの実装詳細に依存しすぎないため）。
function flattenSqlText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  if ('queryChunks' in node && Array.isArray((node as SQL).queryChunks)) {
    return (node as SQL).queryChunks.map(flattenSqlText).join('');
  }
  if ('value' in node && Array.isArray((node as { value: unknown }).value)) {
    return ((node as { value: string[] }).value).join('');
  }
  return '';
}

// #11 C3/C4 行レベル制御の判定ロジック（Issue #11・D-6 対応）。
// RBAC §4「権限のない利用者には存在も見せない」をコードで保証する。
// 注: visibleWhere は drizzle の SQL フラグメントを返す。ユーザーID等はプレースホルダ化されるため、
// 文字列比較ではなく「必ず C1/C2 を含み、ロールにより C3/owner 条件が分岐すること」を型と
// SQL 生成の成功で確認する（実際のフィルタ保証は canViewRow + 各ページの WHERE 適用テストで担保）。

describe('defaultVisibleClassifications', () => {
  it('C3 閲覧ロールは C1〜C3 まで可視（C4 は grant 導入まで含めない）', () => {
    expect(defaultVisibleClassifications('ip')).toEqual(['C1', 'C2', 'C3']);
    expect(defaultVisibleClassifications('tech_manager')).toEqual(['C1', 'C2', 'C3']);
    expect(defaultVisibleClassifications('sysadmin')).toEqual(['C1', 'C2', 'C3']);
  });

  it('engineer/viewer は C1/C2 のみ既定可視', () => {
    expect(defaultVisibleClassifications('engineer')).toEqual(['C1', 'C2']);
    expect(defaultVisibleClassifications('viewer')).toEqual(['C1', 'C2']);
  });
});

describe('isC3ReaderRole', () => {
  it('M15 Invention に R を持つロールを C3 閲覧可とする', () => {
    expect(isC3ReaderRole('ip')).toBe(true);
    expect(isC3ReaderRole('rnd')).toBe(true);
    expect(isC3ReaderRole('engineer')).toBe(false);
    expect(isC3ReaderRole('viewer')).toBe(false);
  });
});

describe('canViewRow', () => {
  it('C1/C2 は全ロール閲覧可', () => {
    expect(canViewRow('viewer', 'C1', false)).toBe(true);
    expect(canViewRow('engineer', 'C2', false)).toBe(true);
  });

  it('C3 は R ロールなら閲覧可（owner でなくても）', () => {
    expect(canViewRow('ip', 'C3', false)).toBe(true);
    expect(canViewRow('executive', 'C3', false)).toBe(true);
  });

  it('C3 は engineer/viewer では owner（自分の起案）のみ閲覧可', () => {
    expect(canViewRow('engineer', 'C3', true)).toBe(true);
    expect(canViewRow('engineer', 'C3', false)).toBe(false);
    expect(canViewRow('viewer', 'C3', false)).toBe(false);
  });

  it('C4 は grant が無ければ owner・sysadmin・R ロールでも不可視', () => {
    expect(canViewRow('sysadmin', 'C4', true)).toBe(false);
    expect(canViewRow('ip', 'C4', false)).toBe(false);
    expect(canViewRow('engineer', 'C4', false)).toBe(false);
  });

  it('C4 は個別付与（grant）がある利用者のみ可視（ロール・owner を問わない）', () => {
    expect(canViewRow('engineer', 'C4', false, true)).toBe(true);
    expect(canViewRow('viewer', 'C4', false, true)).toBe(true);
    expect(canViewRow('sysadmin', 'C4', false, false)).toBe(false);
  });

  it('C3 は grant があれば R ロール外・非 owner でも可視', () => {
    expect(canViewRow('engineer', 'C3', false, true)).toBe(true);
    expect(canViewRow('viewer', 'C3', false, false)).toBe(false);
  });
});

describe('canViewRowAudited', () => {
  // NFR-L-001（拒否操作の監査記録）: canViewRow が false を返した場合のみ
  // 監査ログ（result: 'denied'）を記録し、true の場合は書き込まないことを確認する。
  function createFakeDb() {
    const values = vi.fn().mockResolvedValue(undefined);
    const insert = vi.fn(() => ({ values }));
    return { db: { insert } as unknown as Parameters<typeof canViewRowAudited>[0], insert, values };
  }

  it('閲覧不可の場合、監査ログを denied で記録し false を返す', async () => {
    const { db, insert, values } = createFakeDb();
    const allowed = await canViewRowAudited(db, {
      role: 'engineer', classification: 'C3', isOwner: false,
      actorUserId: 'u1', targetType: 'invention', targetId: 'inv-1'
    });

    expect(allowed).toBe(false);
    expect(insert).toHaveBeenCalledTimes(1);
    const row = values.mock.calls[0]![0];
    expect(row.result).toBe('denied');
    expect(row.actorUserId).toBe('u1');
    expect(row.targetType).toBe('invention');
    expect(row.targetId).toBe('inv-1');
    expect(row.meta).toEqual({ classification: 'C3', role: 'engineer' });
  });

  it('閲覧可能な場合、監査ログを書き込まず true を返す', async () => {
    const { db, insert } = createFakeDb();
    const allowed = await canViewRowAudited(db, {
      role: 'ip', classification: 'C3', isOwner: false,
      actorUserId: 'u1', targetType: 'invention', targetId: 'inv-1'
    });

    expect(allowed).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });

  it('C4 は grant が無ければ sysadmin でも denied として記録される', async () => {
    const { db, values } = createFakeDb();
    const allowed = await canViewRowAudited(db, {
      role: 'sysadmin', classification: 'C4', isOwner: false,
      actorUserId: 'u1', targetType: 'invention', targetId: 'inv-2'
    });

    expect(allowed).toBe(false);
    expect(values.mock.calls[0]![0].reason).toBe('row_visibility_denied');
  });

  it('C4 は hasGrant: true を渡すと監査ログを書き込まず true を返す', async () => {
    const { db, insert } = createFakeDb();
    const allowed = await canViewRowAudited(db, {
      role: 'engineer', classification: 'C4', isOwner: false,
      actorUserId: 'u1', targetType: 'invention', targetId: 'inv-3', hasGrant: true
    });

    expect(allowed).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe('visibleWhere', () => {
  it('ロール・owner の有無にかかわらず drizzle SQL フラグメントを生成できる', () => {
    const c = { name: 'classification' };
    const o = { name: 'author_id' };
    expect(visibleWhere(c, o, { role: 'ip', viewerUserId: 'u1' })).toBeTruthy();
    expect(visibleWhere(c, o, { role: 'engineer', viewerUserId: 'u1' })).toBeTruthy();
    expect(visibleWhere(c, o, { role: 'engineer' })).toBeTruthy();
  });

  it('grant を渡すと access_grants への EXISTS 条件を含む SQL を生成する（C4 の可視化に使う）', () => {
    const c = { name: 'classification' };
    const o = { name: 'author_id' };
    const idCol = { name: 'id' };

    const withGrantC3Reader = visibleWhere(c, o, {
      role: 'ip', viewerUserId: 'u1', grant: { idCol, targetType: 'invention' }
    });
    expect(flattenSqlText(withGrantC3Reader)).toContain('access_grants');

    const withGrantEngineer = visibleWhere(c, o, {
      role: 'engineer', viewerUserId: 'u1', grant: { idCol, targetType: 'workflow_instance' }
    });
    expect(flattenSqlText(withGrantEngineer)).toContain('access_grants');

    // viewerUserId が無い場合は grant を渡しても EXISTS を組み込まない（付与判定不能なため）。
    const withoutViewer = visibleWhere(c, o, { role: 'engineer', grant: { idCol, targetType: 'invention' } });
    expect(flattenSqlText(withoutViewer)).not.toContain('access_grants');

    // grant を渡さない既存呼び出しは従来どおり access_grants を含まない（後方互換）。
    const legacyCall = visibleWhere(c, o, { role: 'engineer', viewerUserId: 'u1' });
    expect(flattenSqlText(legacyCall)).not.toContain('access_grants');
  });
});

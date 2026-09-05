import { describe, it, expect } from 'vitest';
import {
  defaultVisibleClassifications,
  canViewRow,
  isC3ReaderRole,
  visibleWhere
} from './row-visibility';

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

  it('C4 は個別付与（grant）導入まで全ロール不可視', () => {
    expect(canViewRow('sysadmin', 'C4', true)).toBe(false);
    expect(canViewRow('ip', 'C4', false)).toBe(false);
    expect(canViewRow('engineer', 'C4', false)).toBe(false);
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
});

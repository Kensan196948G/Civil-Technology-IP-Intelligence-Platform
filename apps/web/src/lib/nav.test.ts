// 権限によるナビゲーション表示制御の回帰テスト。
//
// Deep Debug (2026-09-10): サイドナビが権限で絞られておらず、一般技術者(engineer)にも
// 「システム管理」(/admin) が表示されていた（middleware は 404 で拒否）。
// 設計 docs/30-design/04-screen-design.md §3 / §7-4、
// 根拠 docs/10-requirements/05-rbac-matrix.md §3（M25 Administration の engineer は「-」）。
import { describe, expect, it } from 'vitest';
import { isNavHrefVisible } from './nav';
import type { DemoRole } from '@/lib/auth/demo';

describe('isNavHrefVisible', () => {
  it('管理権限のないロールには /admin を表示しない', () => {
    const denied: DemoRole[] = ['engineer', 'tech_manager', 'rnd', 'ip', 'legal', 'viewer'];
    for (const role of denied) {
      expect(isNavHrefVisible('/admin', role), `${role} は /admin を表示しない`).toBe(false);
      expect(isNavHrefVisible('/admin/users', role), `${role} は /admin/users を表示しない`).toBe(false);
    }
  });

  it('管理権限のあるロールには /admin を表示する', () => {
    for (const role of ['executive', 'sysadmin'] as DemoRole[]) {
      expect(isNavHrefVisible('/admin', role), `${role} は /admin を表示する`).toBe(true);
      expect(isNavHrefVisible('/admin/users', role), `${role} は /admin/users を表示する`).toBe(true);
    }
  });

  it('ゲート未定義のパスは全ロールに表示する', () => {
    const roles: DemoRole[] = ['engineer', 'tech_manager', 'rnd', 'ip', 'legal', 'executive', 'sysadmin', 'viewer'];
    for (const role of roles) {
      for (const href of ['/dashboard', '/search', '/field', '/audit', '/ai-assistant?c=1']) {
        expect(isNavHrefVisible(href, role), `${role} は ${href} を表示する`).toBe(true);
      }
    }
  });

  it('前方一致の罠にかからない（/administrator はゲート対象外）', () => {
    expect(isNavHrefVisible('/administrator', 'engineer')).toBe(true);
    expect(isNavHrefVisible('/administrators', 'engineer')).toBe(true);
  });

  it('末尾スラッシュ・クエリ付きでも判定できる', () => {
    expect(isNavHrefVisible('/admin/', 'engineer')).toBe(false);
    expect(isNavHrefVisible('/admin?tab=users', 'engineer')).toBe(false);
    expect(isNavHrefVisible('/search?q=test', 'engineer')).toBe(true);
  });
});

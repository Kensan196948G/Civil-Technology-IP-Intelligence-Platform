import { describe, it, expect, beforeAll, vi } from 'vitest';

// signValue/verifySignedValue は getDemoCookieSecret() 経由で環境変数を要求するため、
// 実行前に固定のテスト用シークレットを注入する。
vi.mock('@/lib/env', () => ({
  getDemoCookieSecret: () => 'unit-test-secret-do-not-use-in-real-environment'
}));

let signValue: typeof import('./sign').signValue;
let verifySignedValue: typeof import('./sign').verifySignedValue;

beforeAll(async () => {
  const mod = await import('./sign');
  signValue = mod.signValue;
  verifySignedValue = mod.verifySignedValue;
});

describe('signValue / verifySignedValue', () => {
  it('署名したCookie値は正しく検証できる', async () => {
    const signed = await signValue('tanaka.makoto@demo.ctiip.example');
    const verified = await verifySignedValue(signed);
    expect(verified).toBe('tanaka.makoto@demo.ctiip.example');
  });

  it('改ざんされたメールアドレス部分は検証に失敗する', async () => {
    const signed = await signValue('tanaka.makoto@demo.ctiip.example');
    const tampered = signed.replace('tanaka.makoto', 'kondo.jun');
    const verified = await verifySignedValue(tampered);
    expect(verified).toBeNull();
  });

  it('署名部分を書き換えた値は検証に失敗する', async () => {
    const signed = await signValue('tanaka.makoto@demo.ctiip.example');
    const [email] = signed.split('.');
    const forged = `${email}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    const verified = await verifySignedValue(forged);
    expect(verified).toBeNull();
  });

  it('署名区切り文字(.)を含まない値は不正として扱う', async () => {
    const verified = await verifySignedValue('no-dot-here');
    expect(verified).toBeNull();
  });

  it('空文字列は不正として扱う', async () => {
    const verified = await verifySignedValue('');
    expect(verified).toBeNull();
  });

  it('異なるメールアドレスは異なる署名になる（衝突しない）', async () => {
    const a = await signValue('sato.ken@demo.ctiip.example');
    const b = await signValue('inoue.akira@demo.ctiip.example');
    expect(a).not.toBe(b);
  });
});

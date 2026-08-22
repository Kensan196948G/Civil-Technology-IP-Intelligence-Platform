import { test, expect, type Page } from '@playwright/test';

async function loginAs(page: Page, name: string) {
  await page.goto('/login');
  await page.getByText(name, { exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

test('未ログインは /login へリダイレクトされる', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('デモログイン → ダッシュボードに実件数が出る', async ({ page }) => {
  await loginAs(page, '田村 誠');
  await expect(page.getByText('MVP環境')).toBeVisible();
  await expect(page.locator('.main')).toContainText('特許');
});

test('横断検索：実データがヒットしタブ切替が動く', async ({ page }) => {
  await loginAs(page, '田村 誠');
  await page.goto('/search?q=ケーソン&tab=patent');
  await expect(page.locator('.main')).toContainText('ケーソン据付装置');
  await page.getByRole('link', { name: /NETIS/ }).click();
  await expect(page.locator('.main')).toContainText('GNSS併用ケーソン据付支援システム');
});

test('Claim Chart：注記が常時表示され、判定を変更すると反映される', async ({ page }) => {
  await loginAs(page, '高橋 実');
  await page.goto('/claims');
  await page.getByText('ケーソン据付装置').click();
  await expect(page).toHaveURL(/\/claims\//);
  await expect(page.getByText('類似度は権利侵害の判断ではありません')).toBeVisible();

  const firstRow = page.locator('table tbody tr').first();
  // 判定変更前：1行目は初期状態の「一致」ボタンが選択状態（太字）になっている
  await expect(firstRow.getByText('一致', { exact: true })).toHaveCSS('font-weight', '700');

  await firstRow.getByText('相違', { exact: true }).click();
  await page.waitForTimeout(1200);
  await page.reload();

  // 判定変更後：再読込してもDB側で「相違」が選択状態のまま反映されている（同語反復にならないよう、
  // 「相違」ボタンが太字＝選択中であることまで確認する。単なるテキスト存在チェックでは
  // 更新が失敗していても常に通ってしまうため、CSSでの状態確認を必須にしている）
  const firstRowAfter = page.locator('table tbody tr').first();
  await expect(firstRowAfter.getByText('相違', { exact: true })).toHaveCSS('font-weight', '700');
  await expect(firstRowAfter.getByText('一致', { exact: true })).not.toHaveCSS('font-weight', '700');
  await expect(page.getByText('類似度は権利侵害の判断ではありません')).toBeVisible();
});

test('現場適用スコア：軸別内訳が常に併記される', async ({ page }) => {
  await loginAs(page, '佐藤 建');
  await page.goto('/search?q=ケーソン&tab=tech');
  await page.getByRole('link', { name: '現場適用性を見る →' }).first().click();
  await expect(page.getByText('FIELD APPLICABILITY SCORE')).toBeVisible();
  await expect(page.getByText('このスコアは導入可否の判断を代替しません')).toBeVisible();
  await expect(page.getByText('海象')).toBeVisible();
});

test('現場課題フォーム：送信すると一覧に反映される（実DB書込み）', async ({ page }) => {
  await loginAs(page, '佐藤 建');
  await page.goto('/sites');
  await page.getByRole('link', { name: /困りごとを登録/ }).first().click();
  const uniqueText = `E2Eテスト投稿 ${Date.now()}`;
  await page.locator('textarea[name="body"]').fill(uniqueText);
  await page.getByRole('button', { name: 'この内容で送る' }).click();
  await expect(page.getByText(uniqueText)).toBeVisible({ timeout: 10000 });
});

test('承認：自己承認は禁止、他者は承認できる', async ({ page }) => {
  await loginAs(page, '佐藤 建');
  await page.goto('/approvals');
  await page.getByText('吊具姿勢の自動補正').click();
  await expect(page.getByText('起案者はご自身の案件を承認できません')).toBeVisible();

  await loginAs(page, '高橋 実');
  await page.goto('/approvals');
  await page.getByText('吊具姿勢の自動補正').click();
  await expect(page.getByText('人間確認事項が未完了です')).toBeVisible();
  await expect(page.getByRole('button', { name: '承認' })).toBeDisabled();
  await page.getByRole('button', { name: '確認完了を記録' }).click();
  await page.waitForTimeout(800);
  await expect(page.getByRole('button', { name: '承認' })).toBeEnabled();
});

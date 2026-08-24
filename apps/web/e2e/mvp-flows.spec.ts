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
  // 新サイドバーの「最近の会話」にもNETISを含む項目があるため、種別チップの検索は本文に限定する。
  await page.locator('.main').getByRole('link', { name: /NETIS/ }).click();
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
  // 固定待機ではなく、UI状態（相違ボタンが選択状態になる）の自動待機にする
  await expect(firstRow.getByText('相違', { exact: true })).toHaveCSS('font-weight', '700');
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
  // 「ケーソン」は自社技術2件（現場適用性データの有無が異なる）にヒットし、
  // 同一トランザクション内で作成されたため created_at が同値で順序が非決定的になる。
  // 現場適用性データを持つ技術だけがヒットする語で検索し、一意に特定する。
  await page.goto('/search?q=GNSS&tab=tech');
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
  // toBeEnabled() 自体がポーリングして待つため、固定待機は不要
  await expect(page.getByRole('button', { name: '承認' })).toBeEnabled();
});

// Deep Debug Round2で発見・修正した本番専用の不具合（middleware.ts参照）の回帰防止テスト。
// notFound()/redirect()がReact Server Componentのレンダリングパイプライン内では
// 本番ビルドでのみ信頼できないことが判明したため、実際にRBACを強制しているmiddlewareの
// 挙動そのものを検証する（layout側の requireRole() ではなくmiddlewareを通した実挙動）。
test('RBAC：権限の無いロールは/admin/*へアクセスできない、権限のあるロールは閲覧できる', async ({ page }) => {
  await loginAs(page, '田村 誠'); // tech_manager（管理者権限なし）
  let resp = await page.goto('/admin/users');
  expect(resp?.status()).toBe(404);
  resp = await page.goto('/admin/feature-flags');
  expect(resp?.status()).toBe(404);
  // 管理外ページには回帰がないことも確認
  resp = await page.goto('/patents');
  expect(resp?.status()).toBe(200);

  await loginAs(page, '山本 恵'); // executive（管理者権限あり）
  resp = await page.goto('/admin/users');
  expect(resp?.status()).toBe(200);
  // ナビゲーション・ヘッダーの画面名・ページ見出しが同じ文言になるため、
  // getByText も素の getByRole('heading') も strict mode violation になる。本文の見出しに絞る。
  await expect(page.locator('.main').getByRole('heading', { name: 'ユーザー管理' })).toBeVisible();
});

// Deep Debug Round2で追加した (app)/error.tsx の回帰防止テスト。
// 不正なUUID形式のIDを特許詳細ページへ渡すと、DrizzleのクエリがPostgresへ
// 不正な型のパラメータを送ることになりServer Component内で例外が発生する。
// これは実際に起こりうるシナリオ（不正なURL直接入力・古いブックマーク等）であり、
// error.tsxのフォールバックUIが表示されることを確認する。
test('エラーバウンダリ：不正なIDでのアクセスがエラー画面としてハンドリングされる', async ({ page }) => {
  await loginAs(page, '田村 誠');
  await page.goto('/patents/not-a-valid-uuid');
  await expect(page.getByText('この画面の表示中にエラーが発生しました')).toBeVisible();
  await expect(page.getByRole('button', { name: '再試行' })).toBeVisible();
  await page.getByRole('link', { name: 'ダッシュボードへ戻る' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

// ── 新WebUI（design-B-copilot）の回帰防止 ──────────────────────────────

test('詳細ドロワー：検索結果の行を開くと右から詳細が出て、閉じられる', async ({ page }) => {
  await loginAs(page, '田村 誠');
  await page.goto('/search?q=ケーソン&tab=patent');

  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeHidden();

  // 行内の「特許詳細を見る →」リンクを踏まないよう、行の左上（種別バッジ側）を押す。
  await page.locator('.main .row-list > [role="button"]').first().click({ position: { x: 10, y: 10 } });
  await expect(drawer).toBeVisible();
  // 出どころと注記は常に併記される（AIの要約だけを見せない）
  await expect(drawer.getByText('要約と言い換えはAIによるものです')).toBeVisible();

  await drawer.getByRole('button', { name: '閉じる' }).click();
  await expect(drawer).toBeHidden();
});

test('サイドバー：最近の会話を選ぶとCopilotホームがその会話に切り替わる', async ({ page }) => {
  await loginAs(page, '田村 誠');
  await page.getByRole('link', { name: 'Copilot に聞く' }).click();
  await expect(page).toHaveURL(/\/ai-assistant/);

  await page.getByRole('link', { name: '競合A社の直近1年の出願' }).click();
  await expect(page).toHaveURL(/\/ai-assistant\?c=/);
  await expect(page.locator('.main')).toContainText('競合A社の直近1年の出願動向をまとめて。');
  // 回答には必ず根拠件数が併記される
  await expect(page.locator('.main')).toContainText('根拠');
});

test('全モジュール：20分類が並び、項目から実画面へ遷移できる', async ({ page }) => {
  await loginAs(page, '田村 誠');
  await page.getByRole('link', { name: /全モジュール/ }).click();
  await expect(page).toHaveURL(/\/modules/);

  // nav.ts の20セクションがすべてカードとして出ている
  await expect(page.locator('.main section.panel')).toHaveCount(20);

  await page.locator('.main').getByRole('link', { name: '調査案件一覧' }).click();
  await expect(page).toHaveURL(/\/investigations/);
});

const { chromium } = require('@playwright/test');
const BASE = 'https://ctiip-mvp.mirai-dx-platform.com';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text().slice(0, 150)}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${String(e).slice(0, 200)}`));

  await page.goto(`${BASE}/login`, { timeout: 120000, waitUntil: 'domcontentloaded' });
  await page.getByText('田村 誠', { exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 120000 });
  await page.waitForTimeout(8000);

  const sb = await page.evaluate(() => {
    const nav = document.querySelector('.sb-nav');
    const user = document.querySelector('.sb-user');
    const items = [...document.querySelectorAll('.sb-nav a')].map(a => ({
      text: a.textContent.trim().slice(0, 40), href: a.getAttribute('href')
    }));
    return {
      navScrollH: nav ? nav.scrollHeight : null,
      navClientH: nav ? nav.clientHeight : null,
      userVisible: user ? getComputedStyle(user).display : null,
      items
    };
  });
  console.log('SIDEBAR:', JSON.stringify(sb, null, 1));

  // 従来メニュー → 全モジュール をクリック
  const modLink = page.locator('.sb-nav a', { hasText: '全モジュール' });
  const cnt = await modLink.count();
  console.log('modules link count:', cnt);
  if (cnt > 0) {
    await modLink.first().click();
    await page.waitForTimeout(5000);
    console.log('URL after click:', page.url());
    const modText = await page.evaluate(() => ({
      has20: document.body.textContent.includes('20モジュール'),
      cards: document.querySelectorAll('.panel').length
    }));
    console.log('modules page:', JSON.stringify(modText));
  }
  console.log('LOGS:', logs.join('\n') || 'none');
  await browser.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });

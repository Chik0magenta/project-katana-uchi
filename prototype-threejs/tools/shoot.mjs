// 빠른 화면 점검: 개발용 메뉴로 각 화면에 들어가 캡처하고 콘솔 오류를 모은다.
// 사용: node tools/shoot.mjs [출력 폴더]
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const out = process.argv[2] || 'docs/screenshots';
const url = pathToFileURL(resolve('dist/katana-uchi.html')).href;
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/q_title.png` });
const shots = ['dev-map', 'dev-travel', 'dev-river', 'dev-mountain', 'dev-forest', 'dev-inn', 'dev-workshop', 'dev-assign', 'dev-shape', 'dev-quench', 'dev-result', 'dev-castle', 'dev-inventory', 'dev-peddler', 'dev-bandit'];
for (const id of shots) {
  await page.evaluate(() => window.__katana.go('dev'));
  await page.click(`[data-testid="${id}"]`);
  await page.waitForTimeout(['dev-travel', 'dev-peddler', 'dev-bandit'].includes(id) ? 2200 : id === 'dev-assign' ? 300 : 900);
  await page.screenshot({ path: `${out}/q_${id}.png` });
}
console.log(errors.length ? `ERRORS:\n${errors.join('\n')}` : 'no console errors');
await browser.close();

// 측정을 브라우저에서 자동으로 실행한다. dev 서버를 직접 띄우고, 버튼을 누르고, 끝날 때까지 기다린다.
//   node scripts/run-bench.mjs            → 정확도 + 리사이즈 전체(60회)
//   node scripts/run-bench.mjs accuracy   → 정확도만
//   node scripts/run-bench.mjs all        → 리사이즈 전체만
//   --channel=chrome                      → Playwright Chromium 대신 설치된 Chrome 사용
// 창을 띄워서(headed) 돌린다. 측정 중에는 창을 가리거나 최소화하지 말 것(requestAnimationFrame이 느려진다).
import { createServer } from 'vite'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const channel = args.find((a) => a.startsWith('--channel='))?.split('=')[1]
const jobs = args.filter((a) => !a.startsWith('--'))
if (jobs.length === 0) jobs.push('accuracy', 'all')

const server = await createServer()
await server.listen()
const url = server.resolvedUrls.local[0]
const browser = await chromium.launch({ headless: false, channel })
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
page.on('pageerror', (e) => console.error('pageerror:', e.message))
await page.goto(url)
await page.waitForFunction(() => window.__bench !== undefined)
for (const job of jobs) {
  await page.click(`#run-${job}`)
  await page.waitForFunction((j) => window.__bench.done.includes(j), job, { timeout: 15 * 60_000 })
}
console.log(await page.textContent('#log'))
await browser.close()
await server.close()

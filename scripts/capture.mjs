// 화면 캡처를 docs/img/에 저장한다.
//  1. diff-<케이스>-<너비>.png : results/accuracy.json에서 줄 내용이 DOM과 달랐던 행. 기록된 줄 배열을 그대로 세 칸(DOM / Canvas / pretext)에 그린다.
//  2. view-*.png             : 비교 화면(3분할, 겹쳐 보기)
// 사용: node scripts/capture.mjs
import { mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { chromium } from 'playwright'

mkdirSync('docs/img', { recursive: true })
const acc = JSON.parse(readFileSync('results/accuracy.json', 'utf8'))
const server = await createServer()
await server.listen()
const url = server.resolvedUrls.local[0]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })

// 2. 비교 화면
for (const [name, query] of [
  ['view-split', '?case=mixed&width=320&view=split'],
  ['view-overlay-lines', '?case=mixed&width=320&view=overlay&html=lines'],
  ['view-overlay-native', '?case=mixed&width=320&view=overlay&html=native'],
  ['view-overlay-fallback', '?case=fallback&width=320&view=overlay&html=native'],
  ['view-overlay-emoji', '?case=emoji&width=320&view=overlay&html=native'],
]) {
  await page.goto(url + query)
  await page.waitForSelector('#stage .box')
  await page.locator('#compare').screenshot({ path: `docs/img/${name}.png` })
}
// 선택 박스
await page.goto(url + '?case=ko-long&width=320&view=split')
await page.locator('#stage .box').first().click()
await page.locator('#compare').screenshot({ path: 'docs/img/view-selected.png' })

// 1. 줄 내용이 달랐던 행
const differing = acc.rows.filter((r) => r.canvas?.firstDiffLine != null || r.pretext.firstDiffLine != null)
for (const row of differing) {
  await page.evaluate(
    ({ row, font, lineHeight }) => {
      document.getElementById('diff-shot')?.remove()
      const root = document.createElement('div')
      root.id = 'diff-shot'
      root.style.cssText = 'display:flex;gap:24px;padding:16px;background:#fff;position:absolute;left:0;top:0;z-index:9'
      const first = Math.min(row.canvas?.firstDiffLine ?? Infinity, row.pretext.firstDiffLine ?? Infinity)
      for (const [label, m] of [['DOM (기준)', row.dom], ['Canvas', row.canvas], ['pretext', row.pretext]]) {
        if (!m) continue
        const col = document.createElement('div')
        const cap = document.createElement('div')
        cap.textContent = `${label} · ${m.lineCount}줄 · ${m.height}px`
        cap.style.cssText = 'font:12px sans-serif;color:#666;margin-bottom:6px'
        const box = document.createElement('div')
        box.style.cssText = `width:${row.width}px;outline:1px dashed #bbb`
        m.lines.forEach((text, i) => {
          const line = document.createElement('div')
          line.textContent = text
          line.style.cssText = `font:${font};line-height:${lineHeight}px;height:${lineHeight}px;white-space:pre;` +
            (i + 1 >= first && text !== row.dom.lines[i] ? 'background:#fee2e2' : '')
          box.appendChild(line)
        })
        col.append(cap, box)
        root.appendChild(col)
      }
      document.body.appendChild(root)
    },
    { row, font: acc.font, lineHeight: acc.lineHeight },
  )
  await page.locator('#diff-shot').screenshot({ path: `docs/img/diff-${row.case}-${row.width}.png` })
}
console.log(`비교 화면 6장, 차이 나는 행 ${differing.length}장 저장`)
await browser.close()
await server.close()

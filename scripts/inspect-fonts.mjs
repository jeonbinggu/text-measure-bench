// 겹쳐 보기에서 어긋나 보이는 글리프의 원인 조사용.
// 같은 문자열을 HTML / SVG / Canvas가 각각 어떤 폭으로 그리는지, HTML·SVG가 실제로 어떤 글꼴 파일을 썼는지(CDP) 출력한다.
// Canvas가 쓴 글꼴은 브라우저가 알려 주지 않는다.
// 사용: node scripts/inspect-fonts.mjs
import { createServer } from 'vite'
import { chromium } from 'playwright'

const SAMPLES = ['한글 Latin 123', '漢字文章特殊測定確認', '⌘⏎∮ℵ☃⚙♞', '🇰🇷👍🏽👨‍👩‍👧‍👦🎉']
const FONT = '500 16px Pretendard'

const server = await createServer()
await server.listen()
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(server.resolvedUrls.local[0])
await page.waitForSelector('#stage .box')
const cdp = await page.context().newCDPSession(page)
await cdp.send('DOM.enable')
await cdp.send('CSS.enable')
const { root } = await cdp.send('DOM.getDocument')

for (const text of SAMPLES) {
  const widths = await page.evaluate(
    ({ text, font }) => {
      document.getElementById('probe')?.remove()
      const wrap = document.createElement('div')
      wrap.id = 'probe'
      const span = document.createElement('span')
      span.id = 'probe-html'
      span.style.cssText = `font:${font};white-space:pre`
      span.textContent = text
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      t.id = 'probe-svg'
      t.style.cssText = `font:${font};white-space:pre`
      t.textContent = text
      svg.appendChild(t)
      wrap.append(span, svg)
      document.body.appendChild(wrap)
      const ctx = document.createElement('canvas').getContext('2d')
      ctx.font = font
      return {
        html: span.getBoundingClientRect().width,
        svg: t.getComputedTextLength(),
        canvas: ctx.measureText(text).width,
      }
    },
    { text, font: FONT },
  )
  const fontsOf = async (selector) => {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector })
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    return fonts.map((f) => `${f.familyName}(${f.glyphCount})`).join(', ')
  }
  console.log(JSON.stringify(text))
  console.log(`  폭  HTML ${widths.html.toFixed(3)} / SVG ${widths.svg.toFixed(3)} / Canvas ${widths.canvas.toFixed(3)}`)
  console.log(`  HTML 글꼴: ${await fontsOf('#probe-html')}`)
  console.log(`  SVG  글꼴: ${await fontsOf('#probe-svg')}`)
}

// 선택 박스 동작 확인: 키보드 → 끌기 순서로 readout이 어떻게 바뀌는지
const readout = () => page.textContent('#readout')
await page.goto(server.resolvedUrls.local[0] + '?case=ko-long&width=320')
await page.locator('#stage .box').first().click()
console.log('\n선택 직후       :', await readout())
await page.locator('.box.selected .handle-e').focus()
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowRight')
console.log('e 핸들 → 2번    :', await readout())
const e = await page.locator('.box.selected .handle-e').boundingBox()
await page.mouse.move(e.x + 6, e.y + 6)
await page.mouse.down()
await page.mouse.move(e.x + 106, e.y + 6, { steps: 10 })
await page.mouse.up()
console.log('e 핸들 +100px 끌기:', await readout())
const se = await page.locator('.box.selected .handle-se').boundingBox()
await page.mouse.move(se.x + 6, se.y + 6)
await page.mouse.down()
await page.mouse.move(se.x + 116, se.y + 6, { steps: 10 })
await page.mouse.up()
console.log('se 모서리 +110px :', await readout())
await page.locator('.box.selected .handle-s').focus()
await page.keyboard.press('ArrowDown')
console.log('s 핸들 ↓ 1번    :', await readout())

await browser.close()
await server.close()

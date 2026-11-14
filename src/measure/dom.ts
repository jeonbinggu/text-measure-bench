import { assertFontsReady, graphemes } from './fonts'
import type { MeasureInput, Measurer, MeasurerOptions } from './types'

let host: HTMLDivElement | null = null

/** 화면 밖이지만 레이아웃은 되는 컨테이너 (display:none이면 높이가 0이 된다) */
function getHost(): HTMLDivElement {
  if (!host || !host.isConnected) {
    host = document.createElement('div')
    host.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none'
    document.body.appendChild(host)
  }
  return host
}

/** 측정용 div의 CSS. 화면에 그리는 박스도 같은 값을 써야 비교가 성립한다 */
export function textCss({ font, maxWidth, lineHeight }: Omit<MeasureInput, 'text'>, keepAll = false): string {
  // font 단축 속성이 line-height를 초기화하므로 line-height는 반드시 뒤에 쓴다.
  // overflow-wrap: break-word는 CSS 기본값이 아니지만, 없으면 공백 없는 긴 문자열이 줄바꿈되지 않고 넘친다 (docs/method.md)
  return (
    `font:${font};line-height:${lineHeight}px;width:${maxWidth}px;margin:0;padding:0;border:0;` +
    `white-space:normal;overflow-wrap:break-word;word-break:${keepAll ? 'keep-all' : 'normal'}`
  )
}

/**
 * 기준값. 브라우저가 실제로 레이아웃한 높이를 읽는다.
 * 줄 수 = height / lineHeight.
 */
export function createDomMeasurer(opts: MeasurerOptions = {}): Measurer {
  return (input) => {
    if (!opts.allowBeforeFonts) assertFontsReady()
    const el = document.createElement('div')
    el.style.cssText = textCss(input, opts.keepAll)
    el.textContent = input.text
    getHost().appendChild(el)
    const height = el.getBoundingClientRect().height
    const lines = opts.lines ? extractLines(el, input.lineHeight) : undefined
    el.remove()
    return { height, lineCount: Math.round(height / input.lineHeight), lines }
  }
}

/** 그래핌마다 Range의 위치를 읽어, top이 반 줄 이상 내려가면 새 줄로 본다 */
function extractLines(el: HTMLElement, lineHeight: number): { text: string; width: number }[] {
  const node = el.firstChild
  if (!node) return []
  const range = document.createRange()
  const lines: { text: string; left: number; right: number }[] = []
  let top = -Infinity
  let offset = 0
  for (const g of graphemes(node.textContent ?? '')) {
    range.setStart(node, offset)
    range.setEnd(node, offset + g.length)
    offset += g.length
    const rect = range.getClientRects()[0]
    // 줄 끝에서 접힌 공백은 사각형이 없거나 폭이 0이다 — 새 줄을 열지 않고 지금 줄에 붙인다
    const visible = rect !== undefined && rect.width > 0
    if (visible && (lines.length === 0 || rect.top > top + lineHeight / 2)) {
      lines.push({ text: g, left: rect.left, right: rect.right })
      top = rect.top
      continue
    }
    const cur = lines.at(-1)
    if (!cur) continue
    cur.text += g
    if (visible) {
      cur.left = Math.min(cur.left, rect.left)
      cur.right = Math.max(cur.right, rect.right)
    }
  }
  return lines.map((l) => ({ text: l.text, width: l.right - l.left }))
}

export const measureDom = createDomMeasurer()

import { textCss } from '../measure/dom'
import type { RenderInput } from './canvas'

export type HtmlMode = 'lines' | 'native'

/**
 * lines: pretext가 정한 줄마다 div 하나 (브라우저는 줄바꿈하지 않는다).
 * native: 원문 전체를 넣고 브라우저 줄바꿈에 맡긴다 — pretext 결과와 실제 브라우저 결과의 차이를 보기 위함.
 */
export function renderHtml(
  { lines, font, lineHeight, width, color }: RenderInput,
  mode: HtmlMode,
  text: string,
  keepAll: boolean,
): HTMLDivElement {
  const el = document.createElement('div')
  if (mode === 'native') {
    el.style.cssText = `${textCss({ font, maxWidth: width, lineHeight }, keepAll)};color:${color}`
    el.textContent = text
    return el
  }
  el.style.cssText = `width:${width}px;color:${color}`
  for (const line of lines) {
    const row = document.createElement('div')
    row.style.cssText = `font:${font};line-height:${lineHeight}px;height:${lineHeight}px;white-space:pre`
    row.textContent = line.text
    el.appendChild(row)
  }
  return el
}

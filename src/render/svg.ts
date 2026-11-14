import { baselineOffset, type RenderInput } from './canvas'

const NS = 'http://www.w3.org/2000/svg'

/** 줄마다 <text> 하나. y = 줄 번호 × lineHeight + 베이스라인 보정 (baselineOffset 주석 참고) */
export function renderSvg({ lines, font, lineHeight, width, height, color }: RenderInput): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))
  svg.style.cssText = 'display:block;overflow:visible'
  const base = baselineOffset(font, lineHeight)
  lines.forEach((line, i) => {
    const text = document.createElementNS(NS, 'text')
    text.setAttribute('x', '0')
    text.setAttribute('y', String(i * lineHeight + base))
    text.setAttribute('fill', color)
    // 공백이 접히지 않게. font는 canvas와 같은 단축 문자열을 그대로 쓴다
    text.style.cssText = `font:${font};white-space:pre`
    text.textContent = line.text
    svg.appendChild(text)
  })
  return svg
}

/** HTML로는 할 수 없는 표현의 예: 원호를 따라 흐르는 글자 */
export function renderArc(textContent: string, font: string, color: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 300 150')
  svg.setAttribute('width', '300')
  svg.setAttribute('height', '150')
  const path = document.createElementNS(NS, 'path')
  path.id = 'arc-path'
  path.setAttribute('d', 'M 30 140 A 120 120 0 0 1 270 140')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#E8D3C8')
  path.setAttribute('stroke-dasharray', '3 4')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', '원호를 따라 흐르는 글자 예시')
  const text = document.createElementNS(NS, 'text')
  text.setAttribute('fill', color)
  text.style.font = font
  const tp = document.createElementNS(NS, 'textPath')
  tp.setAttribute('href', '#arc-path')
  tp.setAttribute('startOffset', '50%')
  tp.setAttribute('text-anchor', 'middle')
  tp.textContent = textContent
  text.appendChild(tp)
  svg.append(path, text)
  return svg
}

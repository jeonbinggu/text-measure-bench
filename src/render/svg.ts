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
  svg.setAttribute('viewBox', '0 0 360 190')
  svg.setAttribute('width', '360')
  svg.setAttribute('height', '190')
  const path = document.createElementNS(NS, 'path')
  path.id = 'arc-path'
  path.setAttribute('d', 'M 20 170 A 160 160 0 0 1 340 170')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', '#ddd')
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

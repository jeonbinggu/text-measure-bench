export interface RenderInput {
  /** pretext layoutWithLines()가 돌려준 줄 배열 */
  lines: { text: string; width: number }[]
  font: string
  lineHeight: number
  width: number
  height: number
  color: string
}

const probe = document.createElement('canvas').getContext('2d')!

/**
 * 줄 상자 위쪽에서 베이스라인까지의 거리.
 * CSS는 (line-height − (ascent + descent))를 위아래로 반씩 나눠 붙인다(half-leading). 같은 계산을 폰트의
 * fontBoundingBoxAscent/Descent로 해서 SVG와 Canvas에 똑같이 쓴다.
 * dominant-baseline을 쓰지 않는 이유: 그 값은 글리프 기준선 종류만 고르고 half-leading은 맞춰 주지 않는다.
 */
export function baselineOffset(font: string, lineHeight: number): number {
  probe.font = font
  const m = probe.measureText('Hg가')
  return (lineHeight - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent
}

export function renderCanvas({ lines, font, lineHeight, width, height, color }: RenderInput): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const dpr = window.devicePixelRatio || 1
  // 비트맵은 기기 픽셀 크기로, 화면 크기는 CSS 픽셀로 — 그러지 않으면 고배율 화면에서 흐리게 그려진다
  canvas.width = Math.ceil(width * dpr)
  canvas.height = Math.ceil(height * dpr)
  canvas.style.cssText = `display:block;width:${width}px;height:${height}px`
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.font = font
  ctx.fillStyle = color
  ctx.textBaseline = 'alphabetic'
  const base = baselineOffset(font, lineHeight)
  lines.forEach((line, i) => ctx.fillText(line.text, 0, i * lineHeight + base))
  return canvas
}

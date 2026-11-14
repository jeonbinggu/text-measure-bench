import { layout } from '@chenglou/pretext'
import { measureCanvas } from '../measure/canvas'
import { textCss } from '../measure/dom'
import { FONT_FAMILY } from '../measure/fonts'
import { getPrepared, invalidatePretext } from '../measure/pretext'
import { getEnv, type Env } from './env'

export const METHODS = ['dom-batched', 'dom-interleaved', 'canvas', 'pretext'] as const
export type Method = (typeof METHODS)[number]
export const NS = [10, 60, 200]
export const RUNS = 5
export const FRAMES = 30
const FROM = 320
const TO = 640
const FONT = `500 16px ${FONT_FAMILY}`
const LINE_HEIGHT = 24

export interface ResizeResult {
  method: Method
  n: number
  run: number
  /** 프레임별 "측정 시작 ~ 높이 반영 완료" (ms). 브라우저가 그 뒤에 하는 레이아웃·페인트는 들어 있지 않다 */
  frames: number[]
  /** 프레임별 직전 requestAnimationFrame과의 간격 (ms). 주사율에 묶여 있어 참고용이다 */
  rafDeltas: number[]
  /** pretext만: 박스 N개를 처음 prepare하는 데 걸린 시간 (ms). 프레임 시간에는 들어 있지 않다 */
  prepareMs: number | null
  widths: number[]
  font: string
  lineHeight: number
  env: Env
}

const SENTENCES = [
  '측정값은 같은 조건에서 다시 재도 비슷하게 나와야 한다.',
  'Every box gets its own paragraph so nothing is shared by accident.',
  '너비가 바뀌면 줄바꿈이 달라지고 높이도 따라 바뀐다.',
  'Resize from 320 to 640 pixels across 30 frames.',
  '2026년 기준 60fps 한 프레임은 약 16.7ms다.',
  'Reading layout right after writing style forces a reflow.',
  '쓰기와 읽기를 번갈아 하면 박스마다 레이아웃이 다시 돈다.',
  'The cheap path is arithmetic over widths measured once.',
  '한글은 글자 단위로, English는 단어 단위로 끊긴다.',
  'Numbers like 3.14159 and 1,000,000 stay together.',
  '결과는 원본 JSON으로 남기고 표는 스크립트가 만든다.',
  'If nothing is slow, then nothing is slow, and that is the result.',
]

/** 박스마다 다른 문단. 같은 문단을 돌려 쓰면 pretext 캐시만 이득을 본다 */
export function boxText(i: number): string {
  const parts = [`${i + 1}번 상자.`]
  for (let k = 0; k < 4 + (i % 3); k++) parts.push(SENTENCES[(i * 5 + k * 7) % SENTENCES.length])
  return parts.join(' ')
}

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r))

/** 한 조합(방식 × N)을 한 번 실행한다. 매번 측정 컨테이너를 새로 만들고 끝나면 지운다 */
export async function runResize(method: Method, n: number, run: number, mount: HTMLElement): Promise<ResizeResult> {
  const container = document.createElement('div')
  container.style.cssText = 'display:flex;flex-wrap:wrap;align-items:flex-start;gap:8px'
  const texts = Array.from({ length: n }, (_, i) => boxText(i))
  const boxes: HTMLDivElement[] = []
  const inners: HTMLDivElement[] = []
  for (const text of texts) {
    // 바깥 박스의 높이를 직접 정하고, DOM 방식은 안쪽 div의 자연 높이를 읽는다
    const box = document.createElement('div')
    box.style.cssText = `width:${FROM}px;overflow:hidden;outline:1px solid #ccc`
    const inner = document.createElement('div')
    inner.style.cssText = textCss({ font: FONT, maxWidth: FROM, lineHeight: LINE_HEIGHT })
    inner.style.width = 'auto' // 바깥 박스의 너비를 따라간다
    inner.textContent = text
    box.appendChild(inner)
    container.appendChild(box)
    boxes.push(box)
    inners.push(inner)
  }
  mount.appendChild(container)

  // 회차마다 캐시를 비워 prepare 비용을 매번 같은 조건(콜드)으로 잰다
  let prepareMs: number | null = null
  if (method === 'pretext') {
    invalidatePretext()
    const t = performance.now()
    for (const text of texts) getPrepared(text, FONT)
    prepareMs = performance.now() - t
  }
  const prepared = method === 'pretext' ? texts.map((text) => getPrepared(text, FONT)) : []

  // 처음 레이아웃·페인트가 끝난 뒤에 시작한다
  await nextFrame()
  let last = await nextFrame()

  const frames: number[] = []
  const rafDeltas: number[] = []
  const widths: number[] = []
  for (let f = 0; f < FRAMES; f++) {
    const now = await nextFrame()
    rafDeltas.push(now - last)
    last = now
    const w = Math.round(FROM + ((TO - FROM) * (f + 1)) / FRAMES)
    widths.push(w)
    const t0 = performance.now()
    if (method === 'dom-batched') {
      for (const box of boxes) box.style.width = `${w}px`
      const heights = inners.map((inner) => inner.getBoundingClientRect().height)
      for (let i = 0; i < n; i++) boxes[i].style.height = `${heights[i]}px`
    } else if (method === 'dom-interleaved') {
      for (let i = 0; i < n; i++) {
        boxes[i].style.width = `${w}px`
        boxes[i].style.height = `${inners[i].getBoundingClientRect().height}px`
      }
    } else {
      for (let i = 0; i < n; i++) {
        const height =
          method === 'canvas'
            ? measureCanvas({ text: texts[i], font: FONT, maxWidth: w, lineHeight: LINE_HEIGHT }).height
            : layout(prepared[i], w, LINE_HEIGHT).height
        boxes[i].style.width = `${w}px`
        boxes[i].style.height = `${height}px`
      }
    }
    frames.push(performance.now() - t0)
  }
  await nextFrame()
  container.remove()
  return { method, n, run, frames, rafDeltas, prepareMs, widths, font: FONT, lineHeight: LINE_HEIGHT, env: getEnv() }
}

export const resizeFileName = (r: { method: Method; n: number; run: number }) =>
  `resize-${r.method}-${r.n}-${r.run}.json`

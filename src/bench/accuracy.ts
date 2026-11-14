import { createCanvasMeasurer } from '../measure/canvas'
import { createDomMeasurer } from '../measure/dom'
import { FONT_FAMILY, FONT_FILE, graphemes } from '../measure/fonts'
import { createPretextMeasurer, invalidatePretext } from '../measure/pretext'
import type { MeasureResult } from '../measure/types'
import { BEFORE_FONT_TEXT, CASES, WIDTHS } from './cases'
import { getEnv, type Env } from './env'

export const ACC_FONT = `500 16px ${FONT_FAMILY}`
export const ACC_LINE_HEIGHT = 24

export interface Measured {
  height: number
  lineCount: number
  lines: string[]
}
export interface Compared extends Measured {
  heightDiff: number // 기준값(DOM) 대비
  lineDiff: number
  firstDiffLine: number | null // 줄 내용이 처음 달라진 줄 번호(1부터). 모든 줄이 같으면 null
}
export interface AccuracyRow {
  case: string
  width: number
  mode: 'normal' | 'keep-all'
  dom: Measured
  canvas: Compared | null // keep-all은 Canvas 구현에 없다
  pretext: Compared
}
export interface BeforeFontRow {
  width: number
  method: 'dom' | 'canvas' | 'pretext'
  before: { height: number; lineCount: number }
  /** 폰트 로드 뒤 아무것도 하지 않고 다시 잰 값. pretext는 캐시된 prepare 결과를 그대로 쓴다 */
  afterStale: { height: number; lineCount: number }
  /** 폰트 로드 뒤 캐시를 비우고 다시 잰 값 */
  afterFresh: { height: number; lineCount: number }
}
export interface AccuracyResult {
  font: string
  lineHeight: number
  env: Env
  /** 케이스별로, 폴백 폰트로 그려진 것이 확인된 그래핌 (못 잡는 글리프가 있다 — fallbackGraphemes 주석) */
  fallbackGraphemes: Record<string, string[]>
  rows: AccuracyRow[]
  beforeFont: BeforeFontRow[]
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

const pick = (r: MeasureResult): Measured => ({
  height: r.height,
  lineCount: r.lineCount,
  lines: (r.lines ?? []).map((l) => norm(l.text)),
})

function compare(r: MeasureResult, dom: Measured): Compared {
  const m = pick(r)
  const n = Math.max(m.lines.length, dom.lines.length)
  let firstDiffLine: number | null = null
  for (let i = 0; i < n; i++) {
    if (m.lines[i] !== dom.lines[i]) {
      firstDiffLine = i + 1
      break
    }
  }
  return { ...m, heightDiff: m.height - dom.height, lineDiff: m.lineCount - dom.lineCount, firstDiffLine }
}

const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
function pixels(g: string, fallback: string): string {
  ctx.canvas.width = 48
  ctx.canvas.height = 32
  ctx.font = `500 16px ${FONT_FAMILY}, ${fallback}`
  ctx.fillText(g, 4, 22)
  return ctx.getImageData(0, 0, 48, 32).data.join()
}
/**
 * 폴백 폰트로 그려진 그래핌 찾기: 뒤에 붙인 generic family만 바꿔 그렸을 때 픽셀이 달라지면 Pretendard에 없는 글리프다.
 * 한계: serif·sans-serif·monospace 어디에도 없어 같은 시스템 폰트로 넘어가는 글리프(일부 기호, 이모지)는 못 잡는다.
 */
function fallbackGraphemes(text: string): string[] {
  const found = new Set<string>()
  for (const g of graphemes(text)) {
    if (g.trim() === '') continue
    const base = pixels(g, 'serif')
    if (base !== pixels(g, 'sans-serif') || base !== pixels(g, 'monospace')) found.add(g)
  }
  return [...found]
}

/** 케이스 7종 × 너비 3 × (normal, keep-all). loadFonts() 뒤에 부를 것 */
export function runAccuracy(): AccuracyRow[] {
  const rows: AccuracyRow[] = []
  for (const c of CASES) {
    for (const width of WIDTHS) {
      for (const keepAll of [false, true]) {
        const input = { text: c.text, font: ACC_FONT, maxWidth: width, lineHeight: ACC_LINE_HEIGHT }
        const dom = pick(createDomMeasurer({ keepAll, lines: true })(input))
        rows.push({
          case: c.key,
          width,
          mode: keepAll ? 'keep-all' : 'normal',
          dom,
          canvas: keepAll ? null : compare(createCanvasMeasurer({ lines: true })(input), dom),
          pretext: compare(createPretextMeasurer({ keepAll, lines: true })(input), dom),
        })
      }
    }
  }
  return rows
}

/**
 * before-font: 아직 로드되지 않은 폰트 이름으로 먼저 재고, 로드 뒤에 다시 잰다.
 * 매번 새 family 이름으로 FontFace를 등록하므로 페이지를 새로 고치지 않아도 "로드 전" 상태를 다시 만들 수 있다.
 */
export async function runBeforeFont(): Promise<BeforeFontRow[]> {
  const family = `PretendardLate${Date.now()}`
  const face = new FontFace(family, `url(${import.meta.env.BASE_URL}fonts/${FONT_FILE})`, { weight: '45 920' })
  document.fonts.add(face)
  const font = `500 16px ${family}`
  const o = { allowBeforeFonts: true }
  const measurers = {
    dom: createDomMeasurer(o),
    canvas: createCanvasMeasurer(o),
    pretext: createPretextMeasurer(o),
  }
  const run = () =>
    WIDTHS.flatMap((width) =>
      (['dom', 'canvas', 'pretext'] as const).map((method) => {
        const r = measurers[method]({ text: BEFORE_FONT_TEXT, font, maxWidth: width, lineHeight: ACC_LINE_HEIGHT })
        return { width, method, value: { height: r.height, lineCount: r.lineCount } }
      }),
    )
  const before = run()
  await face.load()
  await document.fonts.ready
  const stale = run()
  invalidatePretext()
  const fresh = run()
  document.fonts.delete(face)
  return before.map((b, i) => ({
    width: b.width,
    method: b.method,
    before: b.value,
    afterStale: stale[i].value,
    afterFresh: fresh[i].value,
  }))
}

export async function runAccuracyAll(): Promise<AccuracyResult> {
  const rows = runAccuracy()
  const beforeFont = await runBeforeFont()
  return {
    font: ACC_FONT,
    lineHeight: ACC_LINE_HEIGHT,
    env: getEnv(),
    fallbackGraphemes: Object.fromEntries(CASES.map((c) => [c.key, fallbackGraphemes(c.text)])),
    rows,
    beforeFont,
  }
}

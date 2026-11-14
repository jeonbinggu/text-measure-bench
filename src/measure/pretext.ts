import {
  clearCache,
  layout,
  layoutWithLines,
  prepareWithSegments,
  type PreparedTextWithSegments,
} from '@chenglou/pretext'
import { assertFontsReady } from './fonts'
import type { Measurer, MeasurerOptions } from './types'

const cache = new Map<string, PreparedTextWithSegments>()
let prepareCalls = 0

/** prepare가 실제로 불린 횟수. "리사이즈 중에는 layout만"을 확인하는 데 쓴다 */
export const getPrepareCalls = (): number => prepareCalls

/**
 * 같은 텍스트·폰트 조합은 한 번만 prepare한다. 폰트 문자열(크기 포함)이 키에 들어가므로
 * 글자 크기가 바뀌면 새로 prepare되고, 너비만 바뀌면 캐시를 그대로 쓴다.
 */
export function getPrepared(text: string, font: string, keepAll = false): PreparedTextWithSegments {
  const key = `${font}\0${keepAll ? 1 : 0}\0${text}`
  let prepared = cache.get(key)
  if (!prepared) {
    prepareCalls++
    prepared = prepareWithSegments(text, font, keepAll ? { wordBreak: 'keep-all' } : undefined)
    cache.set(key, prepared)
  }
  return prepared
}

/**
 * 같은 폰트 이름이 가리키는 글꼴이 바뀌었을 때(웹폰트 로드 완료 등) 부른다.
 * 부르지 않으면 폴백 폰트로 잰 폭이 캐시에 남는다 (before-font 케이스).
 */
export function invalidatePretext(): void {
  cache.clear()
  clearCache()
}

export function createPretextMeasurer(opts: MeasurerOptions = {}): Measurer {
  return ({ text, font, maxWidth, lineHeight }) => {
    if (!opts.allowBeforeFonts) assertFontsReady()
    const prepared = getPrepared(text, font, opts.keepAll)
    if (!opts.lines) return layout(prepared, maxWidth, lineHeight)
    const r = layoutWithLines(prepared, maxWidth, lineHeight)
    return { height: r.height, lineCount: r.lineCount, lines: r.lines.map((l) => ({ text: l.text, width: l.width })) }
  }
}

export const measurePretext = createPretextMeasurer()

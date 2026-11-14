import { assertFontsReady, graphemes } from './fonts'
import type { Measurer, MeasurerOptions } from './types'

const ctx = document.createElement('canvas').getContext('2d')!

/** 글자 단위로 끊는 문자: 한글, 한자, 가나 */
const CJK = /^[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u

/**
 * Canvas measureText로 폭을 재고 줄바꿈은 직접 한다. 브라우저 규칙을 흉내 내지 않는다 — 차이가 결과다.
 *
 * 줄바꿈 규칙 (docs/method.md에도 같은 내용):
 * 1. 연속 공백·개행은 공백 하나로 접는다 (white-space: normal).
 * 2. 공백에서 끊을 수 있다. 줄 끝 공백은 폭에 넣지 않는다.
 * 3. 한글·한자·가나는 글자(그래핌)마다 앞뒤에서 끊을 수 있다.
 * 4. 그 밖의 문자(영문, 숫자, 문장부호, 이모지)가 이어진 덩어리는 끊지 않는다.
 * 5. 단, 덩어리 하나가 maxWidth보다 넓으면 그래핌 단위로 강제로 끊는다.
 * 6. 금칙 처리 없음: 닫는 괄호·마침표가 줄 맨 앞에 올 수 있다.
 * 7. keep-all 없음.
 * 폭은 후보 줄 전체를 measureText로 잰 값이다 (커닝 포함). 폭 캐시는 두지 않는다.
 */
export function createCanvasMeasurer(opts: MeasurerOptions = {}): Measurer {
  return ({ text, font, maxWidth, lineHeight }) => {
    if (!opts.allowBeforeFonts) assertFontsReady()
    ctx.font = font
    const width = (s: string) => ctx.measureText(s).width
    const lines: string[] = []
    let cur = ''
    for (const word of text.split(/\s+/).filter(Boolean)) {
      atoms(word).forEach((atom, i) => {
        const candidate = cur === '' ? atom : cur + (i === 0 ? ' ' : '') + atom
        if (width(candidate) <= maxWidth) {
          cur = candidate
          return
        }
        if (cur !== '') lines.push(cur)
        cur = ''
        // 규칙 5: 한 덩어리가 줄보다 넓다
        for (const g of graphemes(atom)) {
          if (cur !== '' && width(cur + g) > maxWidth) {
            lines.push(cur)
            cur = g
          } else cur += g
        }
      })
    }
    if (cur !== '') lines.push(cur)
    return {
      height: lines.length * lineHeight,
      lineCount: lines.length,
      lines: opts.lines ? lines.map((l) => ({ text: l, width: width(l) })) : undefined,
    }
  }
}

/** 단어를 "끊을 수 없는 덩어리"로 나눈다. CJK 글자는 하나씩, 나머지는 이어 붙인다 */
function atoms(word: string): string[] {
  const out: string[] = []
  let run = ''
  for (const g of graphemes(word)) {
    if (CJK.test(g)) {
      if (run) out.push(run)
      run = ''
      out.push(g)
    } else run += g
  }
  if (run) out.push(run)
  return out
}

export const measureCanvas = createCanvasMeasurer()

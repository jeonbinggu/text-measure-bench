// 브라우저(Vitest browser mode, Chromium)에서 도는 회귀 테스트.
// 스냅샷은 이 환경(OS의 폴백 폰트·이모지 폰트 포함)에서의 값이다. 다른 OS에서는 "알려진 차이" 스냅샷이 달라질 수 있다.
import '../src/style.css'
import { beforeAll, describe, expect, it } from 'vitest'
import { ACC_FONT, ACC_LINE_HEIGHT, runAccuracy, runBeforeFont } from '../src/bench/accuracy'
import { measureCanvas } from '../src/measure/canvas'
import { measureDom } from '../src/measure/dom'
import { loadFonts, resetFontsReady } from '../src/measure/fonts'
import { getPrepareCalls, getPrepared, measurePretext } from '../src/measure/pretext'
import { resize } from '../src/ui/selection'

const input = { text: '폰트가 오기 전에 재면 안 된다', font: ACC_FONT, maxWidth: 200, lineHeight: ACC_LINE_HEIGHT }

/**
 * pretext와 DOM의 줄 수가 다른 것으로 알려진 행 (`케이스@너비@모드`).
 * 2026-11-14 측정(results/accuracy.json)에서는 42행 모두 같아서 비어 있다.
 * 새로 달라진 행이 생기면 원인을 확인한 뒤 여기에 올리고, 값은 아래 스냅샷으로 고정한다. 테스트에서 빼지 않는다.
 */
const PRETEXT_KNOWN_DIFFS = new Set<string>([])

describe('폰트 준비 전', () => {
  it('fonts.ready 이전에 측정 함수를 부르면 던진다', () => {
    resetFontsReady()
    expect(() => measureDom(input)).toThrow(/fonts\.ready/)
    expect(() => measureCanvas(input)).toThrow(/fonts\.ready/)
    expect(() => measurePretext(input)).toThrow(/fonts\.ready/)
  })
})

describe('폰트 준비 후', () => {
  beforeAll(() => loadFonts(ACC_FONT))

  const rows = () => runAccuracy().map((r) => ({ ...r, key: `${r.case}@${r.width}@${r.mode}` }))

  it('pretext: 알려진 차이가 아닌 행은 DOM과 줄 수·높이가 같아야 한다', () => {
    for (const r of rows().filter((r) => !PRETEXT_KNOWN_DIFFS.has(r.key))) {
      expect(r.pretext.lineCount, r.key).toBe(r.dom.lineCount)
      expect(r.pretext.height, r.key).toBe(r.dom.height)
    }
  })

  it('pretext: 알려진 차이는 현재 값으로 고정한다', () => {
    const known = rows()
      .filter((r) => PRETEXT_KNOWN_DIFFS.has(r.key))
      .map((r) => ({ key: r.key, lineDiff: r.pretext.lineDiff, heightDiff: r.pretext.heightDiff }))
    expect(known).toMatchSnapshot()
  })

  it('pretext: 줄 내용이 처음 달라지는 줄을 현재 값으로 고정한다', () => {
    expect(rows().map((r) => `${r.key} ${r.pretext.firstDiffLine ?? '같음'}`)).toMatchSnapshot()
  })

  it('canvas: DOM과의 차이(알려진 차이)를 현재 값으로 고정한다', () => {
    const diffs = rows()
      .filter((r) => r.canvas !== null)
      .map((r) => `${r.key} 줄 ${r.canvas!.lineDiff} / 높이 ${r.canvas!.heightDiff} / 처음 다른 줄 ${r.canvas!.firstDiffLine ?? '같음'}`)
    expect(diffs).toMatchSnapshot()
  })

  it('너비만 바뀌면 prepare를 다시 부르지 않고, 글자 크기가 바뀌면 다시 부른다', () => {
    const text = '너비만 바꾸는 동안에는 layout만 다시 한다'
    getPrepared(text, ACC_FONT)
    const calls = getPrepareCalls()
    for (let w = 320; w <= 640; w += 10) {
      measurePretext({ text, font: ACC_FONT, maxWidth: w, lineHeight: ACC_LINE_HEIGHT })
    }
    expect(getPrepareCalls()).toBe(calls)
    measurePretext({ text, font: ACC_FONT.replace('16px', '20px'), maxWidth: 320, lineHeight: 30 })
    expect(getPrepareCalls()).toBe(calls + 1)
  })

  it('before-font: 캐시를 비우지 않으면 pretext에 로드 전 값이 남고, 비우면 DOM과 같아진다', async () => {
    const result = await runBeforeFont()
    for (const p of result.filter((r) => r.method === 'pretext')) {
      const dom = result.find((r) => r.method === 'dom' && r.width === p.width)!
      expect(p.afterStale, `stale@${p.width}`).toEqual(p.before)
      expect(p.afterFresh, `fresh@${p.width}`).toEqual(dom.afterFresh)
    }
  })
})

describe('리사이즈 핸들', () => {
  const start = { width: 320, fontSize: 16, lineHeight: 24, height: 144, lineCount: 6 }

  it('좌우 핸들은 너비만 바꾼다', () => {
    expect(resize('e', start, 40, 99)).toMatchObject({ width: 360, fontSize: 16, lineHeight: 24 })
    expect(resize('w', start, 40, 0)).toMatchObject({ width: 280, fontSize: 16, lineHeight: 24 })
  })

  it('모서리 핸들은 너비와 글자 크기를 같은 비율로 바꾼다', () => {
    expect(resize('se', start, 160, 0)).toEqual({ width: 480, fontSize: 24, lineHeight: 36 })
    expect(resize('nw', start, 160, 0)).toEqual({ width: 160, fontSize: 8, lineHeight: 12 })
  })

  it('위아래 핸들은 줄 높이만 바꾼다', () => {
    expect(resize('s', start, 0, 36)).toMatchObject({ width: 320, fontSize: 16, lineHeight: 30 })
  })
})

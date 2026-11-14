export const FONT_FAMILY = 'Pretendard'
export const FONT_FILE = 'PretendardVariable.woff2'

let ready = false

/**
 * 측정 전에 반드시 한 번 기다린다.
 * document.fonts.ready만으로는 아직 아무도 쓰지 않은 폰트를 기다려 주지 않으므로 load()로 먼저 불러온다.
 */
export async function loadFonts(font: string): Promise<void> {
  const faces = await document.fonts.load(font, '가A1')
  if (faces.length === 0) throw new Error(`폰트를 불러오지 못했다: ${font}`)
  await document.fonts.ready
  ready = true
}

export function fontsReady(): boolean {
  return ready
}

/** 폰트가 준비되기 전에 잰 값은 폴백 폰트의 값이다. 조용히 틀린 값을 주지 않고 던진다 */
export function assertFontsReady(): void {
  if (!ready) throw new Error('document.fonts.ready 이전에 측정 함수를 호출했다. loadFonts()를 먼저 기다릴 것')
}

/** 테스트 전용 */
export function resetFontsReady(): void {
  ready = false
}

export const segmenter = new Intl.Segmenter('ko', { granularity: 'grapheme' })
export const graphemes = (s: string): string[] => Array.from(segmenter.segment(s), (g) => g.segment)

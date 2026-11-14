export interface MeasureInput {
  text: string
  font: string // canvas font 형식, 예: '500 24px Pretendard'
  maxWidth: number // px
  lineHeight: number // px, CSS line-height와 반드시 같게
}
export interface MeasureResult {
  height: number
  lineCount: number
  lines?: { text: string; width: number }[]
}
export type Measurer = (input: MeasureInput) => MeasureResult

export interface MeasurerOptions {
  /** word-break: keep-all로 잰다 (기본은 normal) */
  keepAll?: boolean
  /** 줄별 텍스트·폭도 돌려준다. 느리므로 성능 측정에서는 끈다 */
  lines?: boolean
  /** before-font 케이스 전용: 폰트 준비 확인을 건너뛴다 */
  allowBeforeFonts?: boolean
}

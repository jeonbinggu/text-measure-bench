// 리사이즈 결과 요약 규칙. 화면의 표(main.ts)와 문서의 표(scripts/make-tables.ts)가 같은 코드를 쓴다.
// node --experimental-strip-types로도 불러오므로 다른 모듈을 import하지 않는다.

export const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** nearest-rank p95 */
export const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.ceil(xs.length * 0.95) - 1]

export interface RunLike {
  run: number
  frames: number[]
  rafDeltas: number[]
  prepareMs: number | null
}

export interface Summary {
  median: number
  p95: number
  rafMedian: number
  prepareMedian: number | null
  frameCount: number
  excludedRun: number
  excludedMedian: number
}

/**
 * 한 조합(방식 × N)의 회차들을 요약한다.
 * 회차별 중앙값 중, 그 중앙값들의 중앙값에서 가장 먼 1회를 빼고, 남은 회차의 프레임을 모두 합쳐 중앙값·p95를 낸다.
 */
export function summarize(runs: RunLike[]): Summary {
  const meds = runs.map((r) => median(r.frames))
  const center = median(meds)
  let out = 0
  meds.forEach((m, i) => {
    if (Math.abs(m - center) > Math.abs(meds[out] - center)) out = i
  })
  const kept = runs.filter((_, i) => i !== out)
  const frames = kept.flatMap((r) => r.frames)
  const prep = kept.map((r) => r.prepareMs).filter((x): x is number => x !== null)
  return {
    median: median(frames),
    p95: p95(frames),
    rafMedian: median(kept.flatMap((r) => r.rafDeltas)),
    prepareMedian: prep.length ? median(prep) : null,
    frameCount: frames.length,
    excludedRun: runs[out].run,
    excludedMedian: meds[out],
  }
}

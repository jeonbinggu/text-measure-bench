// results/*.json → 마크다운 표. README.md와 docs/findings.md의 표 자리(마커 사이)를 통째로 바꿔 쓴다.
// 표를 손으로 고치지 말 것. 숫자를 바꾸려면 측정을 다시 하고 이 스크립트를 다시 돌린다.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { summarize } from '../src/bench/stats.ts'

const METHODS = ['dom-batched', 'dom-interleaved', 'canvas', 'pretext']
const NS = [10, 60, 200]
const RUNS = 5
const START = '<!-- tables:start -->'
const END = '<!-- tables:end -->'

const read = (name: string) => JSON.parse(readFileSync(`results/${name}`, 'utf8'))
const ms = (x: number) => x.toFixed(3)
const signed = (x: number) => (x > 0 ? `+${x}` : String(x))

const files = existsSync('results') ? readdirSync('results') : []
const envs = new Set<string>()
const noteEnv = (e: { browser: string; platform: string; devicePixelRatio: number; fontFile: string; crossOriginIsolated: boolean }) =>
  envs.add(
    `${e.browser || '브라우저 미상'} · ${e.platform} · DPR ${Number(e.devicePixelRatio.toFixed(2))} · ${e.fontFile}` +
      ` · performance.now() 해상도 ${e.crossOriginIsolated ? '5µs' : '100µs'}`,
  )

// ── 리사이즈 비용 ──
function resizeTable(): string {
  const rows: string[] = []
  const excluded: string[] = []
  let any = false
  for (const n of NS) {
    for (const method of METHODS) {
      const runs = Array.from({ length: RUNS }, (_, i) => i + 1)
        .filter((run) => files.includes(`resize-${method}-${n}-${run}.json`))
        .map((run) => read(`resize-${method}-${n}-${run}.json`))
      if (runs.length < RUNS) {
        rows.push(`| \`${method}\` | ${n} | 미측정 | 미측정 | 미측정 | 미측정 | ${runs.length}/${RUNS}회만 있음 |`)
        continue
      }
      any = true
      runs.forEach((r) => noteEnv(r.env))
      // 제외 규칙과 통계는 화면의 표와 같은 코드(src/bench/stats.ts)를 쓴다
      const s = summarize(runs)
      excluded.push(`\`${method}\` N=${n}: ${s.excludedRun}회차(중앙값 ${ms(s.excludedMedian)}ms)`)
      rows.push(
        `| \`${method}\` | ${n} | ${ms(s.median)} | ${ms(s.p95)} | ${ms(s.rafMedian)} | ` +
          `${s.prepareMedian === null ? '—' : ms(s.prepareMedian)} | ${s.frameCount} |`,
      )
    }
  }
  return [
    '### 리사이즈 비용',
    '',
    '프레임 하나에서 "측정 시작 ~ 높이 반영 완료"까지 걸린 시간(ms). 박스 N개, 너비 320 → 640px, 30프레임.',
    '',
    '| 방식 | N | 중앙값 (ms) | p95 (ms) | rAF 간격 중앙값 (ms) | prepare 1회 (ms) | 프레임 수 |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    any
      ? `조합마다 5회 중 회차 중앙값이 가장 튀는 1회를 뺐다. 뺀 회차: ${excluded.join(', ')}.`
      : '아직 측정 결과가 없다.',
    '',
    '- 중앙값·p95는 남은 4회의 프레임을 모두 합쳐(120프레임) 계산했다.',
    '- 이 시간에는 스크립트가 끝난 뒤 브라우저가 하는 레이아웃·페인트가 들어 있지 않다. rAF 간격은 그것까지 포함하지만 화면 주사율보다 짧아질 수 없으므로 참고용이다.',
    '- prepare 1회는 `pretext`가 박스 N개를 처음 준비하는 시간으로, 프레임 시간과 별도다(4회의 중앙값).',
  ].join('\n')
}

// ── 측정 오차 ──
function accuracyTables(): string {
  if (!files.includes('accuracy.json')) return '### 측정 오차\n\n미측정 (`results/accuracy.json` 없음).'
  const acc = read('accuracy.json')
  noteEnv(acc.env)
  const cmp = (c: { heightDiff: number; lineDiff: number; firstDiffLine: number | null } | null) =>
    c === null ? '해당 없음' : `${signed(c.heightDiff)}px / ${signed(c.lineDiff)}줄 / ${c.firstDiffLine ?? '같음'}`
  const rows = acc.rows.map(
    (r: any) =>
      `| \`${r.case}\` | ${r.width} | ${r.mode} | ${r.dom.height}px / ${r.dom.lineCount}줄 | ${cmp(r.canvas)} | ${cmp(r.pretext)} |`,
  )
  const count = (pick: (r: any) => any, test: (c: any) => boolean) => {
    const xs = acc.rows.map(pick).filter((c: any) => c !== null)
    return `${xs.filter(test).length} / ${xs.length}`
  }
  const fallback = Object.entries(acc.fallbackGraphemes as Record<string, string[]>)
    .filter(([, gs]) => gs.length > 0)
    .map(([k, gs]) => `\`${k}\`: ${gs.join(' ')}`)
  const bf = acc.beforeFont.map(
    (b: any) =>
      `| ${b.width} | ${b.method} | ${b.before.height}px / ${b.before.lineCount}줄 | ` +
      `${b.afterStale.height}px / ${b.afterStale.lineCount}줄 | ${b.afterFresh.height}px / ${b.afterFresh.lineCount}줄 |`,
  )
  return [
    '### 측정 오차',
    '',
    `기준값은 DOM(\`getBoundingClientRect\`)이다. 폰트 \`${acc.font}\`, 줄 높이 ${acc.lineHeight}px.`,
    '각 칸은 `높이 차 / 줄 수 차 / 줄 내용이 처음 달라진 줄 번호`.',
    '',
    '| 케이스 | 너비 | word-break | DOM (기준) | Canvas − DOM | pretext − DOM |',
    '| --- | ---: | --- | --- | --- | --- |',
    ...rows,
    '',
    `- 줄 수가 DOM과 다른 행: Canvas ${count((r) => r.canvas, (c) => c.lineDiff !== 0)}, pretext ${count((r) => r.pretext, (c) => c.lineDiff !== 0)}.`,
    `- 줄 내용이 한 줄이라도 다른 행: Canvas ${count((r) => r.canvas, (c) => c.firstDiffLine !== null)}, pretext ${count((r) => r.pretext, (c) => c.firstDiffLine !== null)}.`,
    '- Canvas 구현에는 keep-all이 없어 keep-all 행은 `해당 없음`이다.',
    `- 폴백 폰트로 그려진 것이 확인된 글리프 — ${fallback.length ? fallback.join('; ') : '없음'}. (판별 방법의 한계로 못 잡은 글리프가 있을 수 있다.)`,
    '',
    '### 폰트 로드 전후 (`before-font`)',
    '',
    '아직 로드되지 않은 폰트 이름으로 먼저 재고, 로드가 끝난 뒤 다시 쟀다. "로드 후(그대로)"는 캐시를 건드리지 않고 다시 잰 값, "로드 후(캐시 비움)"은 pretext 캐시를 비우고 다시 잰 값이다.',
    '',
    '| 너비 | 방식 | 로드 전 | 로드 후 (그대로) | 로드 후 (캐시 비움) |',
    '| ---: | --- | --- | --- | --- |',
    ...bf,
  ].join('\n')
}

const resize = resizeTable()
const accuracy = accuracyTables()
const body = [
  START,
  '<!-- npm run tables가 만든 내용이다. 손으로 고치지 말 것 -->',
  '',
  resize,
  '',
  accuracy,
  '',
  '### 측정 환경 (JSON에 기록된 값)',
  '',
  ...(envs.size ? [...envs].map((e) => `- ${e}`) : ['- 미측정']),
  '',
  END,
].join('\n')

for (const file of ['README.md', 'docs/findings.md']) {
  if (!existsSync(file)) continue
  const text = readFileSync(file, 'utf8')
  const a = text.indexOf(START)
  const b = text.indexOf(END)
  if (a === -1 || b === -1) {
    console.warn(`${file}: 표 자리(${START} … ${END})가 없어 건너뜀`)
    continue
  }
  writeFileSync(file, text.slice(0, a) + body + text.slice(b + END.length))
  console.log(`${file} 갱신`)
}
console.log(body)

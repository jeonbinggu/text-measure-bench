import './style.css'
import { layoutWithLines } from '@chenglou/pretext'
import { runAccuracyAll, type AccuracyResult } from './bench/accuracy'
import { CASES } from './bench/cases'
import { saveJson } from './bench/env'
import { METHODS, NS, RUNS, resizeFileName, runResize, type Method, type ResizeResult } from './bench/resize'
import { median, summarize } from './bench/stats'
import { FONT_FAMILY, loadFonts } from './measure/fonts'
import { getPrepareCalls, getPrepared } from './measure/pretext'
import { renderCanvas, type RenderInput } from './render/canvas'
import { renderHtml, type HtmlMode } from './render/html'
import { renderArc, renderSvg } from './render/svg'
import { attachSelection, type BoxLayout } from './ui/selection'

declare global {
  interface Window {
    /** 브라우저 자동화가 측정이 끝났는지 확인하는 표시 */
    __bench: { running: boolean; done: string[] }
  }
}
window.__bench = { running: false, done: [] }

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}
const fontOf = (size: number) => `500 ${size}px ${FONT_FAMILY}`
const INK = '#1F2328'

type Kind = 'html' | 'svg' | 'canvas'
const RENDERERS: Record<Kind, { name: string; color: string; desc: () => string }> = {
  html: {
    name: 'HTML',
    color: '#2459D6',
    desc: () => (state.htmlMode === 'lines' ? '줄마다 div 하나' : '원문을 넣고 브라우저가 줄바꿈'),
  },
  svg: { name: 'SVG', color: '#C2410C', desc: () => '줄마다 text, 베이스라인 보정' },
  canvas: { name: 'Canvas', color: '#0B7A62', desc: () => 'fillText, 화면 배율 반영' },
}
const CASE_DESC: Record<string, string> = {
  'ko-long': '공백이 적은 한글, 글자 단위 줄바꿈',
  'en-long': '단어 단위 줄바꿈',
  mixed: '문자 종류가 바뀌는 경계',
  emoji: '국기, 피부색, 가족 이모지',
  'long-url': '공백 없는 120자 이상',
  punct: '괄호, 따옴표, 전각 부호, 가격',
  fallback: '한자와 기호, 폴백 폰트',
}

// 측정·렌더 모두 폰트가 준비된 뒤에 시작한다
await loadFonts(fontOf(16))

// ── 렌더러 비교 ───────────────────────────────────────────────
const params = new URLSearchParams(location.search)
const state = {
  caseKey: params.get('case') ?? CASES[0].key,
  view: (params.get('view') ?? 'split') as 'split' | 'overlay',
  htmlMode: (params.get('html') ?? 'lines') as HtmlMode,
  keepAll: params.get('keepAll') === '1',
  width: Number(params.get('width') ?? 320),
  fontSize: 16,
  lineHeight: 24,
}
let current: BoxLayout = { ...state, height: 0, lineCount: 0 }
let layoutCalls = 0

interface Panel {
  kinds: Kind[]
  box: HTMLElement
  content: HTMLElement
  ruler: HTMLElement
  nums: HTMLElement
  desc: HTMLElement | null
}
let panels: Panel[] = []
const stage = $('stage')

/** 보기 방식이 바뀔 때만 박스를 새로 만든다. 끄는 동안 박스(와 핸들)를 다시 만들면 포인터 캡처가 풀린다 */
function buildStage() {
  stage.replaceChildren()
  const groups: Kind[][] = state.view === 'split' ? [['html'], ['svg'], ['canvas']] : [['html', 'svg', 'canvas']]
  panels = groups.map((kinds) => {
    const overlay = kinds.length > 1
    const card = el('section', 'card panel')
    let desc: HTMLElement | null = null
    if (overlay) {
      card.setAttribute('aria-label', '세 렌더러 겹쳐 보기')
      const legend = el('div', 'legend')
      for (const kind of kinds) {
        const item = el('span')
        const dot = el('span', 'dot')
        dot.style.background = RENDERERS[kind].color
        dot.setAttribute('aria-hidden', 'true')
        item.append(dot, RENDERERS[kind].name)
        legend.appendChild(item)
      }
      legend.appendChild(el('span', 'muted', '겹친 줄이 한 색으로 진하게 보이면 일치, 색이 갈라지면 어긋난 곳입니다'))
      card.appendChild(legend)
    } else {
      const r = RENDERERS[kinds[0]]
      card.setAttribute('aria-label', `${r.name} 렌더러`)
      const head = el('div', 'panel-head')
      const dot = el('span', 'dot')
      dot.style.background = r.color
      dot.setAttribute('aria-hidden', 'true')
      head.append(dot, el('h2', '', r.name))
      desc = el('p', 'panel-desc')
      card.append(head, desc)
    }
    const plot = el('div', 'plot')
    const nums = el('div', 'line-nums')
    nums.setAttribute('aria-hidden', 'true')
    const col = el('div')
    const ruler = el('div', 'ruler')
    ruler.setAttribute('aria-hidden', 'true')
    const box = el('div', 'box')
    box.tabIndex = 0
    box.style.outline = `1px solid ${overlay ? '#C9CED6' : RENDERERS[kinds[0]].color}`
    const content = el('div', 'content')
    box.appendChild(content)
    attachSelection(
      box,
      () => current,
      (next) => {
        Object.assign(state, next)
        update()
      },
    )
    col.append(ruler, box)
    plot.append(nums, col)
    card.appendChild(plot)
    stage.appendChild(card)
    return { kinds, box, content, ruler, nums, desc }
  })
  update()
}

function chip(label: string, value: string): HTMLElement {
  const c = el('span', 'chip')
  c.append(el('span', '', label), ' ', el('b', '', value))
  return c
}

function update() {
  const text = CASES.find((c) => c.key === state.caseKey)!.text
  const font = fontOf(state.fontSize)
  const lh = state.lineHeight
  // 너비·줄 높이만 바뀌면 캐시된 prepare 결과에 layout만 다시 한다
  const prepared = getPrepared(text, font, state.keepAll)
  const { lines, height, lineCount } = layoutWithLines(prepared, state.width, lh)
  layoutCalls++
  current = { width: state.width, fontSize: state.fontSize, lineHeight: lh, height, lineCount }

  for (const { kinds, box, content, ruler, nums, desc } of panels) {
    const overlay = kinds.length > 1
    if (desc) desc.textContent = RENDERERS[kinds[0]].desc()
    ruler.style.width = `${state.width}px`
    ruler.replaceChildren(
      ...Array.from({ length: Math.floor(state.width / 100) + 1 }, (_, i) => {
        const tick = el('span', '', String(i * 100))
        tick.style.left = `${i * 100}px`
        return tick
      }),
    )
    nums.replaceChildren(
      ...Array.from({ length: lineCount }, (_, i) => {
        const n = el('div', '', String(i + 1))
        n.style.cssText = `height:${lh}px;line-height:${lh}px`
        return n
      }),
    )
    box.style.width = `${state.width}px`
    box.style.height = `${height}px`
    // 줄 높이마다 옅은 가로줄 — 줄 상자가 어디서 끝나는지 보인다
    box.style.backgroundImage = `repeating-linear-gradient(to bottom,transparent 0,transparent ${lh - 1}px,#EEF1F5 ${lh - 1}px,#EEF1F5 ${lh}px)`
    content.replaceChildren(
      ...kinds.map((kind) => {
        const input: RenderInput = {
          lines,
          font,
          lineHeight: lh,
          width: state.width,
          height,
          color: overlay ? RENDERERS[kind].color : INK,
        }
        const node =
          kind === 'html'
            ? renderHtml(input, state.htmlMode, text, state.keepAll)
            : kind === 'svg'
              ? renderSvg(input)
              : renderCanvas(input)
        if (overlay) node.classList.add('layer')
        return node
      }),
    )
  }

  $('readout').replaceChildren(
    chip('크기', `${state.width} × ${height}px`),
    chip('줄 수', `${lineCount}줄`),
    chip('글자 / 줄 높이', `${state.fontSize}px / ${lh}px`),
    chip('prepare', `${getPrepareCalls()}회`),
    chip('layout', `${layoutCalls}회`),
  )
  wRange.value = String(state.width)
  sRange.value = String(state.fontSize)
  $('w-value').textContent = `${state.width}px`
  $('s-value').textContent = `${state.fontSize}px, 줄 높이 ${lh}px`
}

// 옆 조건
const caseList = $('cases')
function renderCases() {
  caseList.replaceChildren(
    ...CASES.map((c) => {
      const b = el('button', 'case')
      b.type = 'button'
      b.setAttribute('aria-pressed', String(c.key === state.caseKey))
      b.append(el('b', '', c.label), el('span', '', CASE_DESC[c.key] ?? c.key))
      b.addEventListener('click', () => {
        state.caseKey = c.key
        renderCases()
        update()
      })
      return b
    }),
  )
}

function segmented(id: string, get: () => string, set: (v: string) => void) {
  const buttons = [...$(id).querySelectorAll<HTMLButtonElement>('button')]
  const sync = () => buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === get())))
  for (const b of buttons) {
    b.addEventListener('click', () => {
      set(b.dataset.v!)
      sync()
    })
  }
  sync()
}
segmented(
  'view',
  () => state.view,
  (v) => {
    state.view = v as typeof state.view
    buildStage()
  },
)
segmented(
  'html-mode',
  () => state.htmlMode,
  (v) => {
    state.htmlMode = v as HtmlMode
    update()
  },
)

const keepSwitch = $<HTMLButtonElement>('keep-all')
keepSwitch.setAttribute('aria-checked', String(state.keepAll))
keepSwitch.addEventListener('click', () => {
  state.keepAll = !state.keepAll
  keepSwitch.setAttribute('aria-checked', String(state.keepAll))
  update()
})

const wRange = $<HTMLInputElement>('w-range')
const sRange = $<HTMLInputElement>('s-range')
wRange.addEventListener('input', () => {
  state.width = Number(wRange.value)
  update()
})
sRange.addEventListener('input', () => {
  // 글자 크기가 바뀌면 폰트 문자열이 바뀌므로 prepare가 다시 불린다. 줄 높이는 글자 크기의 1.5배로 맞춘다
  state.fontSize = Number(sRange.value)
  state.lineHeight = state.fontSize * 1.5
  update()
})

renderCases()
buildStage()
$('arc').appendChild(renderArc('원호를 따라 흐르는 글자, text on a curve', fontOf(17), '#C2410C'))

// ── 측정 ──────────────────────────────────────────────────────
// 레포에 들어 있는 원본으로 표를 채우고, 이 화면에서 새로 잰 결과가 생기면 그 값으로 바꾼다
const resizeResults = new Map<string, ResizeResult>()
for (const r of Object.values(
  import.meta.glob<ResizeResult>('../results/resize-*.json', { eager: true, import: 'default' }),
)) {
  resizeResults.set(resizeFileName(r), r)
}
let accuracyResult: AccuracyResult | null =
  Object.values(import.meta.glob<AccuracyResult>('../results/accuracy.json', { eager: true, import: 'default' }))[0] ??
  null

const METHOD_LABEL: Record<Method, [string, string]> = {
  'dom-batched': ['DOM, 모아서 읽기', '모든 너비를 쓴 뒤 한 번에 높이를 읽음'],
  'dom-interleaved': ['DOM, 번갈아 읽기', '박스마다 쓰기와 읽기를 반복 (layout thrashing)'],
  canvas: ['Canvas', 'measureText와 직접 구현한 줄바꿈 (폭 캐시 없음)'],
  pretext: ['pretext', 'prepare 결과를 두고 layout만 다시 계산'],
}

function renderResultTable() {
  $('result-body').replaceChildren(
    ...METHODS.map((method) => {
      const tr = el('tr')
      const th = el('th', '', METHOD_LABEL[method][0])
      th.scope = 'row'
      th.appendChild(el('span', '', METHOD_LABEL[method][1]))
      tr.appendChild(th)
      for (const n of NS) {
        const runs = Array.from({ length: RUNS }, (_, i) => resizeResults.get(resizeFileName({ method, n, run: i + 1 })))
        const have = runs.filter((r): r is ResizeResult => r !== undefined)
        if (have.length < RUNS) {
          tr.appendChild(el('td', 'empty', '미측정'))
          continue
        }
        const s = summarize(have)
        tr.appendChild(el('td', '', `${s.median.toFixed(3)} / ${s.p95.toFixed(3)}`))
      }
      return tr
    }),
  )
}
renderResultTable()

const methodSelect = $<HTMLSelectElement>('method')
const nSelect = $<HTMLSelectElement>('n')
for (const m of METHODS) methodSelect.add(new Option(m, m))
for (const n of NS) nSelect.add(new Option(String(n), String(n)))
const logEl = $('log')
const log = (line: string) => {
  logEl.textContent += `${line}\n`
  logEl.scrollTop = logEl.scrollHeight
}
const runButtons = ['run-all', 'run-one', 'run-accuracy'].map((id) => $<HTMLButtonElement>(id))

async function guarded(name: string, job: () => Promise<void>) {
  if (window.__bench.running) return
  window.__bench.running = true
  runButtons.forEach((b) => (b.disabled = true))
  try {
    await job()
    window.__bench.done.push(name)
  } catch (e) {
    log(`오류: ${e instanceof Error ? e.message : String(e)}`)
    throw e
  } finally {
    window.__bench.running = false
    runButtons.forEach((b) => (b.disabled = false))
  }
}

async function runCombos(combos: { method: Method; n: number }[]) {
  const mount = $('bench-mount')
  // 회차를 바깥 루프로 둔다: 한 조합의 5회가 연달아 붙지 않아, 시간에 따른 변동이 한 조합에 몰리지 않는다
  for (let run = 1; run <= RUNS; run++) {
    for (const { method, n } of combos) {
      const result = await runResize(method, n, run, mount)
      const how = await saveJson(resizeFileName(result), result)
      resizeResults.set(resizeFileName(result), result)
      log(`${resizeFileName(result)} 중앙값 ${median(result.frames).toFixed(3)}ms (${how})`)
    }
  }
  renderResultTable()
}

$('run-one').addEventListener('click', () =>
  guarded('one', () => runCombos([{ method: methodSelect.value as Method, n: Number(nSelect.value) }])),
)
$('run-all').addEventListener('click', () =>
  guarded('all', async () => {
    await runCombos(NS.flatMap((n) => METHODS.map((method) => ({ method, n }))))
    log('전체 실행 끝')
  }),
)
$('run-accuracy').addEventListener('click', () =>
  guarded('accuracy', async () => {
    accuracyResult = await runAccuracyAll()
    const how = await saveJson('accuracy.json', accuracyResult)
    const diff = accuracyResult.rows.filter((r) => r.pretext.lineDiff !== 0 || (r.canvas && r.canvas.lineDiff !== 0))
    log(`accuracy.json ${accuracyResult.rows.length}행, 줄 수가 다른 행 ${diff.length}개 (${how})`)
    update() // before-font가 pretext 캐시를 비웠다
  }),
)
// 지금 화면이 들고 있는 원본 전부를 파일 하나로 내려받는다
$('download').addEventListener('click', () => {
  const body = JSON.stringify({ resize: [...resizeResults.values()], accuracy: accuracyResult }, null, 2)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
  a.download = 'text-measure-bench-results.json'
  a.click()
  URL.revokeObjectURL(a.href)
})

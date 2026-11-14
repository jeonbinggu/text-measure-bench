import './style.css'
import { layoutWithLines } from '@chenglou/pretext'
import { runAccuracyAll } from './bench/accuracy'
import { CASES } from './bench/cases'
import { saveJson } from './bench/env'
import { METHODS, NS, RUNS, resizeFileName, runResize, type Method } from './bench/resize'
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
const fontOf = (size: number) => `500 ${size}px ${FONT_FAMILY}`
const COLORS = { html: '#2563eb', svg: '#dc2626', canvas: '#16a34a' }
const INK = '#111'

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

const stage = $('stage')
const caseSelect = $<HTMLSelectElement>('case')
for (const c of CASES) caseSelect.add(new Option(`${c.key} — ${c.label}`, c.key))
caseSelect.value = state.caseKey
$<HTMLSelectElement>('view').value = state.view
$<HTMLSelectElement>('html-mode').value = state.htmlMode
$<HTMLInputElement>('keep-all').checked = state.keepAll

type Kind = 'html' | 'svg' | 'canvas'
let boxes: { box: HTMLElement; content: HTMLElement; kinds: Kind[] }[] = []

/** 보기 방식이 바뀔 때만 박스를 새로 만든다. 끄는 동안 박스(와 핸들)를 다시 만들면 포인터 캡처가 풀린다 */
function buildStage() {
  stage.replaceChildren()
  const groups: Kind[][] = state.view === 'split' ? [['html'], ['svg'], ['canvas']] : [['html', 'svg', 'canvas']]
  boxes = groups.map((kinds) => {
    const figure = document.createElement('figure')
    const caption = document.createElement('figcaption')
    caption.textContent = kinds.map((k) => k.toUpperCase()).join(' + ')
    const box = document.createElement('div')
    box.className = 'box'
    box.tabIndex = 0
    const content = document.createElement('div')
    content.className = 'content'
    box.appendChild(content)
    attachSelection(
      box,
      () => current,
      (next) => {
        Object.assign(state, next)
        update()
      },
    )
    figure.append(caption, box)
    stage.appendChild(figure)
    return { box, content, kinds }
  })
  $('legend').hidden = state.view !== 'overlay'
  update()
}

function update() {
  const text = CASES.find((c) => c.key === state.caseKey)!.text
  const font = fontOf(state.fontSize)
  // 너비·줄 높이만 바뀌면 캐시된 prepare 결과에 layout만 다시 한다
  const prepared = getPrepared(text, font, state.keepAll)
  const { lines, height, lineCount } = layoutWithLines(prepared, state.width, state.lineHeight)
  current = { width: state.width, fontSize: state.fontSize, lineHeight: state.lineHeight, height, lineCount }

  for (const { box, content, kinds } of boxes) {
    box.style.width = `${state.width}px`
    box.style.height = `${height}px`
    const overlay = kinds.length > 1
    content.replaceChildren(
      ...kinds.map((kind) => {
        const input: RenderInput = {
          lines,
          font,
          lineHeight: state.lineHeight,
          width: state.width,
          height,
          color: overlay ? COLORS[kind] : INK,
        }
        const el =
          kind === 'html'
            ? renderHtml(input, state.htmlMode, text, state.keepAll)
            : kind === 'svg'
              ? renderSvg(input)
              : renderCanvas(input)
        if (overlay) el.classList.add('layer')
        return el
      }),
    )
  }
  $('readout').textContent =
    `${state.width} × ${height}px · ${lineCount}줄 · 글자 ${state.fontSize}px / 줄 높이 ${state.lineHeight}px` +
    ` · prepare 누적 ${getPrepareCalls()}회`
}

caseSelect.addEventListener('change', () => {
  state.caseKey = caseSelect.value
  update()
})
$<HTMLSelectElement>('view').addEventListener('change', (e) => {
  state.view = (e.target as HTMLSelectElement).value as typeof state.view
  buildStage()
})
$<HTMLSelectElement>('html-mode').addEventListener('change', (e) => {
  state.htmlMode = (e.target as HTMLSelectElement).value as HtmlMode
  update()
})
$<HTMLInputElement>('keep-all').addEventListener('change', (e) => {
  state.keepAll = (e.target as HTMLInputElement).checked
  update()
})
buildStage()
$('arc').appendChild(renderArc('원호를 따라 흐르는 글자 · text on a curved path', fontOf(18), INK))

// ── 측정 ──────────────────────────────────────────────────────
const methodSelect = $<HTMLSelectElement>('method')
const nSelect = $<HTMLSelectElement>('n')
for (const m of METHODS) methodSelect.add(new Option(m, m))
for (const n of NS) nSelect.add(new Option(String(n), String(n)))
const logEl = $('log')
const log = (line: string) => {
  logEl.textContent += `${line}\n`
  logEl.scrollTop = logEl.scrollHeight
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

async function guarded(name: string, job: () => Promise<void>) {
  if (window.__bench.running) return
  window.__bench.running = true
  try {
    await job()
    window.__bench.done.push(name)
  } catch (e) {
    log(`오류: ${e instanceof Error ? e.message : String(e)}`)
    throw e
  } finally {
    window.__bench.running = false
  }
}

async function runCombos(combos: { method: Method; n: number }[]) {
  const mount = $('bench-mount')
  // 회차를 바깥 루프로 둔다: 한 조합의 5회가 연달아 붙지 않아, 시간에 따른 변동이 한 조합에 몰리지 않는다
  for (let run = 1; run <= RUNS; run++) {
    for (const { method, n } of combos) {
      const result = await runResize(method, n, run, mount)
      const how = await saveJson(resizeFileName(result), result)
      log(`${resizeFileName(result)} 중앙값 ${median(result.frames).toFixed(3)}ms (${how})`)
    }
  }
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
    const result = await runAccuracyAll()
    const how = await saveJson('accuracy.json', result)
    const diff = result.rows.filter((r) => r.pretext.lineDiff !== 0 || (r.canvas && r.canvas.lineDiff !== 0))
    log(`accuracy.json ${result.rows.length}행, 줄 수가 다른 행 ${diff.length}개 (${how})`)
    update() // before-font가 pretext 캐시를 비웠다
  }),
)

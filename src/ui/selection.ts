export interface BoxState {
  width: number
  fontSize: number
  lineHeight: number
}
export interface BoxLayout extends BoxState {
  height: number
  lineCount: number
}

export const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const
export type Dir = (typeof DIRS)[number]

const LABEL: Record<Dir, string> = {
  n: '위쪽: 줄 높이 조절',
  s: '아래쪽: 줄 높이 조절',
  e: '오른쪽: 너비 조절',
  w: '왼쪽: 너비 조절',
  ne: '오른쪽 위 모서리: 너비와 글자 크기 조절',
  nw: '왼쪽 위 모서리: 너비와 글자 크기 조절',
  se: '오른쪽 아래 모서리: 너비와 글자 크기 조절',
  sw: '왼쪽 아래 모서리: 너비와 글자 크기 조절',
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * 핸들을 (dx, dy)만큼 움직였을 때의 다음 상태.
 * - 좌우(e, w): 너비만 바뀐다 → 폰트 문자열이 그대로라 pretext는 layout()만 다시 부르면 된다.
 * - 위아래(n, s): 줄 높이만 바뀐다 → 줄 높이는 layout()의 인자라 이것도 layout()만.
 * - 모서리: 너비와 글자 크기가 같은 비율로 바뀐다 → 글자 크기가 바뀌면 폰트가 바뀐 것이므로 prepare()를 다시 불러야 한다.
 */
export function resize(dir: Dir, start: BoxLayout, dx: number, dy: number): BoxState {
  if (dir === 'e' || dir === 'w') {
    return { ...start, width: clamp(Math.round(start.width + (dir === 'e' ? dx : -dx)), 80, 960) }
  }
  if (dir === 'n' || dir === 's') {
    const height = start.height + (dir === 's' ? dy : -dy)
    const lineHeight = Math.round(height / Math.max(1, start.lineCount))
    return { ...start, lineHeight: clamp(lineHeight, start.fontSize, start.fontSize * 4) }
  }
  const scale = (start.width + (dir.includes('e') ? dx : -dx)) / start.width
  const fontSize = clamp(Math.round(start.fontSize * scale), 8, 96)
  const k = fontSize / start.fontSize
  return {
    width: Math.round(start.width * k),
    fontSize,
    lineHeight: Math.round(start.lineHeight * k),
  }
}

/** 박스에 선택 테두리와 핸들 8개를 붙인다. 박스를 누르면 선택되고, 바깥을 누르면 풀린다 */
export function attachSelection(box: HTMLElement, get: () => BoxLayout, set: (next: BoxState) => void): void {
  const frame = document.createElement('div')
  frame.className = 'sel-frame'
  box.appendChild(frame)

  for (const dir of DIRS) {
    const handle = document.createElement('button')
    handle.type = 'button'
    handle.className = `handle handle-${dir}`
    handle.setAttribute('aria-label', LABEL[dir])
    handle.title = LABEL[dir]

    let start: { x: number; y: number; layout: BoxLayout } | null = null
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      handle.setPointerCapture(e.pointerId)
      handle.focus()
      start = { x: e.clientX, y: e.clientY, layout: get() }
    })
    handle.addEventListener('pointermove', (e) => {
      if (start) set(resize(dir, start.layout, e.clientX - start.x, e.clientY - start.y))
    })
    const end = (e: PointerEvent) => {
      start = null
      if (handle.hasPointerCapture(e.pointerId)) handle.releasePointerCapture(e.pointerId)
    }
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)

    handle.addEventListener('keydown', (e) => {
      const step: Record<string, [number, number]> = {
        ArrowLeft: [-8, 0],
        ArrowRight: [8, 0],
        ArrowUp: [0, -8],
        ArrowDown: [0, 8],
      }
      const d = step[e.key]
      if (!d) return
      e.preventDefault()
      set(resize(dir, get(), d[0], d[1]))
    })
    box.appendChild(handle)
  }

  box.addEventListener('pointerdown', () => {
    document.querySelectorAll('.box.selected').forEach((b) => b !== box && b.classList.remove('selected'))
    box.classList.add('selected')
  })
  // 핸들에 키보드로 들어와도 선택 상태로 본다
  box.addEventListener('focusin', () => box.classList.add('selected'))
}

document.addEventListener('pointerdown', (e) => {
  if (e.target instanceof Element && e.target.closest('.box')) return
  document.querySelectorAll('.box.selected').forEach((b) => b.classList.remove('selected'))
})

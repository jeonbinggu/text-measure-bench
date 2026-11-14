import { FONT_FILE } from '../measure/fonts'

export interface Env {
  userAgent: string
  browser: string
  platform: string
  devicePixelRatio: number
  hardwareConcurrency: number
  screen: string
  /** true면 performance.now() 해상도가 5µs, false면 100µs */
  crossOriginIsolated: boolean
  fontFile: string
  timestamp: string
}

/** 코드로 알 수 있는 환경 정보. 전원 연결·시크릿 창 여부는 사람이 docs/log.md에 적는다 */
export function getEnv(): Env {
  const uaData = (navigator as { userAgentData?: { brands: { brand: string; version: string }[]; platform: string } })
    .userAgentData
  return {
    userAgent: navigator.userAgent,
    browser: uaData?.brands.map((b) => `${b.brand} ${b.version}`).join(', ') ?? '',
    platform: uaData?.platform ?? navigator.platform,
    devicePixelRatio: window.devicePixelRatio,
    hardwareConcurrency: navigator.hardwareConcurrency,
    screen: `${screen.width}x${screen.height}`,
    crossOriginIsolated: window.crossOriginIsolated,
    fontFile: FONT_FILE,
    timestamp: new Date().toISOString(),
  }
}

/** dev 서버가 있으면 results/에 저장하고, 없으면(정적 배포) 파일로 내려받는다 */
export async function saveJson(name: string, data: unknown): Promise<'saved' | 'downloaded'> {
  const body = JSON.stringify(data, null, 2)
  try {
    const res = await fetch(`/__save?name=${encodeURIComponent(name)}`, { method: 'POST', body })
    if (res.ok && (await res.text()) === 'ok') return 'saved'
  } catch {
    // dev 서버가 아니다
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  return 'downloaded'
}

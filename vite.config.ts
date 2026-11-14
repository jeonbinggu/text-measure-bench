import { mkdirSync, writeFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  base: './', // 정적 배포 시 하위 경로에서도 동작하게
  server: {
    // cross-origin isolation을 켜면 performance.now() 해상도가 100µs → 5µs로 올라간다
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    watch: { ignored: ['**/results/**', '**/docs/**'] },
  },
  plugins: [
    {
      // dev 전용: 측정 원본을 results/에 그대로 저장한다 (POST /__save?name=파일명.json)
      name: 'save-results',
      configureServer(server) {
        server.middlewares.use('/__save', (req, res) => {
          const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? ''
          if (req.method !== 'POST' || !/^[\w-]+\.json$/.test(name)) {
            res.statusCode = 400
            return res.end('bad request')
          }
          const chunks: Buffer[] = []
          req.on('data', (c) => chunks.push(c))
          req.on('end', () => {
            mkdirSync('results', { recursive: true })
            writeFileSync(`results/${name}`, Buffer.concat(chunks))
            res.end('ok')
          })
        })
      },
    },
  ],
  test: {
    include: ['tests/**/*.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})

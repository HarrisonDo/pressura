/**
 * 浏览器端到端检查：启动 Vite → 用本机 Chrome（无头）打开页面 → 跑场景 → 截图。
 * 用法：node scripts/e2e.mjs [场景名 ...]   不带参数时跑全部场景
 *
 * 音频场景用 Chrome 的假麦克风：把 scripts/audio/*.wav 当作麦克风输入。
 * 截图和日志输出到 .e2e/（已在 .gitignore 中）。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import { scenarios } from './e2e-scenarios.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, '.e2e')

const requested = process.argv.slice(2)
const selected = requested.length
  ? scenarios.filter((s) => requested.includes(s.name))
  : scenarios
if (selected.length === 0) {
  console.error(`没有匹配的场景。可用：${scenarios.map((s) => s.name).join(', ')}`)
  process.exit(2)
}

await mkdir(outDir, { recursive: true })

const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 5199, strictPort: false, host: '127.0.0.1' },
})
await server.listen()
const baseUrl = server.resolvedUrls?.local[0]
if (!baseUrl) throw new Error('Vite 没有返回本地地址')

let failed = 0
try {
  for (const scenario of selected) {
    const ok = await runScenario(scenario, baseUrl)
    if (!ok) failed++
  }
} finally {
  await server.close()
}

console.log(failed ? `\n✗ ${failed} 个场景失败` : '\n✓ 全部场景通过')
process.exit(failed ? 1 : 0)

async function runScenario(scenario, url) {
  const args = [
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
  ]
  // 自动同意麦克风授权；测试"拒绝授权"时不加
  if (!scenario.denyMic) args.push('--use-fake-ui-for-media-stream')
  if (scenario.audio) {
    const wav = path.join(root, 'scripts', 'audio', scenario.audio)
    if (!existsSync(wav)) await import('./gen-audio.mjs')
    // %noloop：音频播完后不循环，之后就是纯静音
    args.push(`--use-file-for-fake-audio-capture=${wav}%noloop`)
  }

  const browser = await chromium.launch({ channel: 'chrome', headless: true, args })
  const context = await browser.newContext({
    viewport: scenario.viewport ?? { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    permissions: scenario.denyMic ? [] : ['microphone'],
  })
  const page = await context.newPage()
  const errors = []
  const logs = []
  page.on('console', (msg) => {
    const line = `[${msg.type()}] ${msg.text()}`
    logs.push(line)
    if (msg.type() === 'error') errors.push(line)
  })
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.stack ?? err.message}`))

  const started = Date.now()
  let ok = true
  let note = ''
  try {
    await page.goto(url + (scenario.query ?? ''), { waitUntil: 'load' })
    await page.waitForSelector('canvas', { timeout: 15000 })
    const shot = (name) => page.screenshot({ path: path.join(outDir, `${scenario.name}-${name}.png`) })
    note = (await scenario.run({ page, shot, log: (...m) => console.log('   ', ...m) })) ?? ''
  } catch (err) {
    ok = false
    note = err instanceof Error ? err.stack ?? err.message : String(err)
  }

  const ignorable = scenario.ignoreErrors ?? []
  const realErrors = errors.filter((e) => !ignorable.some((re) => re.test(e)))
  if (realErrors.length) ok = false

  await writeFile(path.join(outDir, `${scenario.name}.log`), logs.join('\n'))
  await browser.close()

  const secs = ((Date.now() - started) / 1000).toFixed(1)
  console.log(`${ok ? '✓' : '✗'} ${scenario.name} (${secs}s)`)
  if (note) console.log('   ' + String(note).split('\n').join('\n   '))
  for (const e of realErrors) console.log('   ' + e)
  return ok
}

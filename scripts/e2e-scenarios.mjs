/**
 * 端到端场景清单。每个里程碑往这里追加场景。
 * run() 可以返回一段说明文字，会打印在结果里。
 */

/** 等待应用进入某个阶段（读开发模式暴露的 window.__PRESSURA__） */
async function waitForPhase(page, phase, timeout) {
  await page.waitForFunction((p) => window.__PRESSURA__?.getState().phase === p, phase, {
    timeout,
    polling: 200,
  })
}

const readState = (page) =>
  page.evaluate(() => {
    const api = window.__PRESSURA__
    const s = api.live.snapshot
    const st = api.getState()
    return {
      phase: st.phase,
      form: st.form,
      result: st.result,
      floorDb: s?.floorDb,
      pressure: s?.pressure,
      stats: s?.stats,
    }
  })

const fmtScores = (scores) =>
  Object.entries(scores)
    .map(([k, v]) => `${k}=${v.toFixed(2)}`)
    .join(' ')

function micScenario(type) {
  return {
    name: `mic-${type}`,
    audio: `${type}.wav`,
    async run({ page, shot }) {
      await page.getByRole('button', { name: '开始倾诉' }).click()
      await waitForPhase(page, 'recording', 10000)
      await page.waitForTimeout(9000)
      await page.keyboard.press('KeyD')
      await page.waitForTimeout(600)
      await shot('recording')
      await waitForPhase(page, 'inspecting', 45000)
      await page.waitForTimeout(800)
      await shot('result')
      const { result, floorDb } = await readState(page)
      const summary =
        `结果 ${result.type}（${result.endReason}）压力 ${(result.finalPressure * 100).toFixed(0)}% ` +
        `时长 ${result.durationSeconds.toFixed(1)}s 底噪 ${floorDb.toFixed(1)}dB\n` +
        `均强 ${result.meanLoud.toFixed(2)} 峰值 ${result.peakLoud.toFixed(2)} 起音 ${result.onsetRate.toFixed(2)}/s ` +
        `突发 ${result.burstCount} 亮度 ${result.centroidNorm.toFixed(2)}\n得分 ${fmtScores(result.scores)}`
      if (result.type !== type) throw new Error(`期望 ${type}，实际 ${result.type}\n${summary}`)
      return summary
    },
  }
}

export const scenarios = [
  {
    name: 'visual',
    // 逐个材质、逐个阶段截图，用来人工检查画面
    async run({ page, shot }) {
      await page.waitForTimeout(2500)
      await shot('0-idle')
      const frames = [
        ['seed', 0.08],
        ['ice', 0.25],
        ['ice', 0.55],
        ['ice', 0.8],
        ['ice', 0.97],
        ['stone', 0.25],
        ['stone', 0.55],
        ['stone', 0.8],
        ['stone', 0.97],
        ['fire', 0.25],
        ['fire', 0.55],
        ['fire', 0.8],
        ['fire', 0.97],
      ]
      const fps = []
      for (const [form, pressure] of frames) {
        await page.evaluate(
          ([f, p]) => window.__PRESSURA__.preview({ form: f, pressure: p, intensity: 0.55, burstEvery: 1.5 }),
          [form, pressure],
        )
        await page.waitForTimeout(3200)
        fps.push(
          await page.evaluate(
            () =>
              new Promise((resolve) => {
                let n = 0
                const start = performance.now()
                const tick = () => (++n < 30 ? requestAnimationFrame(tick) : resolve((n / (performance.now() - start)) * 1000))
                requestAnimationFrame(tick)
              }),
          ),
        )
        await shot(`${form}-${Math.round(pressure * 100)}`)
      }
      return `无头软件渲染帧率 ${Math.min(...fps).toFixed(0)}~${Math.max(...fps).toFixed(0)} fps（仅供参考，真机 GPU 会快得多）`
    },
  },

  {
    name: 'onboarding',
    async run({ page, shot }) {
      await page.waitForTimeout(1200)
      await shot('initial')
      await page.getByRole('button', { name: '开始倾诉' }).waitFor()
      await page.getByRole('button', { name: '没有麦克风？用模拟模式' }).waitFor()
      const size = await page.$eval('canvas', (c) => [c.width, c.height])
      if (size[0] < 100 || size[1] < 100) throw new Error(`画布尺寸异常：${size}`)
      return `canvas ${size[0]}x${size[1]}`
    },
  },

  micScenario('ice'),
  micScenario('stone'),
  micScenario('fire'),

  {
    name: 'sim-mode',
    async run({ page, shot }) {
      await page.getByRole('button', { name: '没有麦克风？用模拟模式' }).click()
      await waitForPhase(page, 'recording', 5000)
      await page.getByRole('button', { name: /石/ }).click()
      // 等校准结束再"发声"
      await page.waitForTimeout(1800)
      await page.keyboard.down('Space')
      await page.waitForTimeout(7000)
      await shot('holding')
      await page.keyboard.up('Space')
      const mid = await readState(page)
      if (!(mid.pressure > 0.1)) throw new Error(`按住 7 秒后压力只有 ${mid.pressure}`)
      await page.keyboard.press('Enter')
      await waitForPhase(page, 'inspecting', 5000)
      await shot('result')
      const { result } = await readState(page)
      return `模拟 7 秒 → 压力 ${(mid.pressure * 100).toFixed(0)}%，结果 ${result.type}（${result.endReason}）`
    },
  },

  {
    name: 'interact',
    // 完整演示：模拟倾诉 → 凝结 → 种树 / 浇水 / 汽油 / 敲碎 → 收集 → 标本馆 → 重新打开
    async run({ page, shot }) {
      const state = () => page.evaluate(() => window.__PRESSURA__.live.artifact?.state ?? null)
      const center = async () => {
        const box = await page.locator('canvas').boundingBox()
        return { x: box.x + box.width / 2, y: box.y + box.height * 0.47 }
      }
      await page.getByRole('button', { name: '没有麦克风？用模拟模式' }).click()
      await waitForPhase(page, 'recording', 5000)
      await page.getByRole('button', { name: /石/ }).click()
      await page.waitForTimeout(1800)
      await page.keyboard.down('Space')
      await page.waitForTimeout(12000)
      await page.keyboard.up('Space')
      await page.keyboard.press('Enter')
      await waitForPhase(page, 'inspecting', 5000)
      await page.waitForTimeout(1500)
      await shot('1-crystallized')

      const c = await center()
      // 种两棵树（点击位置稍微错开）
      await page.mouse.click(c.x - 40, c.y - 60)
      await page.waitForTimeout(400)
      await page.mouse.click(c.x + 50, c.y - 30)
      await page.waitForTimeout(2500)
      // 浇水
      await page.getByRole('button', { name: /浇水/ }).click()
      await page.mouse.move(c.x, c.y - 40)
      await page.mouse.down()
      await page.waitForTimeout(1500)
      await shot('2-watering')
      await page.mouse.up()
      // 汽油
      await page.getByRole('button', { name: /汽油/ }).click()
      await page.mouse.move(c.x + 20, c.y)
      await page.mouse.down()
      await page.waitForTimeout(800)
      await page.mouse.up()
      await page.waitForTimeout(1200)
      await shot('3-burning')
      const mid = await state()
      if (mid.trees.length < 2) throw new Error(`应有 2 棵树，实际 ${mid.trees.length}`)
      if (!(mid.wet > 0 || mid.burning > 0)) throw new Error('浇水/汽油没有生效')
      // 双击三次 → 碎裂
      for (let i = 0; i < 3; i++) {
        await page.mouse.dblclick(c.x, c.y)
        await page.waitForTimeout(350)
      }
      await page.waitForTimeout(600)
      await shot('4-shattered')
      const end = await state()
      if (!end.shattered) throw new Error(`敲了 3 次没碎，hits=${end.hits}`)
      // 收集 → 标本馆
      await page.getByRole('button', { name: /收集/ }).click()
      await waitForPhase(page, 'gallery', 5000)
      await page.waitForTimeout(500)
      await shot('5-gallery')
      const cards = await page.locator('.gallery-card').count()
      if (cards < 1) throw new Error('标本馆里没有卡片')
      // 重新打开
      await page.locator('.gallery-open').first().click()
      await waitForPhase(page, 'inspecting', 5000)
      await page.waitForTimeout(1500)
      await shot('6-reopened')
      const reopened = await state()
      return `树 ${mid.trees.length} 棵，湿润 ${mid.wet.toFixed(2)}，火 ${mid.burning.toFixed(2)}，敲击 ${end.hits} 次已碎；标本馆 ${cards} 件；重新打开后 shattered=${reopened.shattered}`
    },
  },

  {
    name: 'mic-denied',
    denyMic: true,
    async run({ page, shot }) {
      await page.getByRole('button', { name: '开始倾诉' }).click()
      const alert = page.getByRole('alert')
      await alert.waitFor({ timeout: 10000 })
      await shot('denied')
      const text = await alert.textContent()
      if (!text?.includes('权限被拒绝')) throw new Error(`提示文字不对：${text}`)
      return text
    },
    // 拒绝权限时浏览器会在控制台打印一条错误，属于预期
    ignoreErrors: [/Permission denied|NotAllowedError/i],
  },
]

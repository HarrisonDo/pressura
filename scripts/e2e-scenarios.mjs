/**
 * 端到端场景清单。每个里程碑往这里追加场景。
 * run() 可以返回一段说明文字，会打印在结果里。
 */
export const scenarios = [
  {
    name: 'smoke',
    async run({ page, shot }) {
      await page.waitForTimeout(1500)
      await shot('initial')
      const size = await page.$eval('canvas', (c) => [c.width, c.height])
      if (size[0] < 100 || size[1] < 100) throw new Error(`画布尺寸异常：${size}`)
      return `canvas ${size[0]}x${size[1]}`
    },
  },
]

/**
 * 程序生成的小纹理（不加载任何外部资源）。首次使用时创建并缓存。
 */
import { CanvasTexture, ClampToEdgeWrapping, SRGBColorSpace } from 'three'

let glow: CanvasTexture | null = null
let groundGlow: CanvasTexture | null = null

/** 地面用的光晕：中心白、向外渐黑（不透明），只覆盖地面中心约 1/6，外圈夹取为黑色 */
export function groundGlowTexture(): CanvasTexture {
  if (groundGlow) return groundGlow
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, '#6a6a6a')
    g.addColorStop(0.75, '#141414')
    g.addColorStop(1, '#000000')
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  groundGlow = new CanvasTexture(canvas)
  groundGlow.colorSpace = SRGBColorSpace
  groundGlow.wrapS = ClampToEdgeWrapping
  groundGlow.wrapT = ClampToEdgeWrapping
  groundGlow.repeat.set(6, 6)
  groundGlow.offset.set(-2.5, -2.5)
  return groundGlow
}

/** 中心亮、边缘透明的径向光晕 */
export function glowTexture(): CanvasTexture {
  if (glow) return glow
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  glow = new CanvasTexture(canvas)
  glow.colorSpace = SRGBColorSpace
  return glow
}

/**
 * 每种材质的环境配色。low = 压力 0 时，high = 压力 1 时，中间按压力插值；
 * 材质切换时再按 formWeight 交叉混合。
 */
import { Color } from 'three'
import type { GrowthForm } from '../../core/types'
import { formWeight, type VisualState } from '../visual'

export interface EnvPalette {
  background: [string, string]
  fog: [string, string]
  fogDensity: [number, number]
  sky: string
  groundLight: string
  key: string
  rim: string
  ground: string
  groundRoughness: number
  groundMetalness: number
  /** 地面反射强度 */
  reflection: number
  /** 地面自发光（火的焦土余热） */
  groundGlow: string
  groundGlowStrength: [number, number]
  accent: string
}

export const PALETTES: Record<GrowthForm, EnvPalette> = {
  seed: {
    background: ['#07070d', '#07070d'],
    fog: ['#0c0b16', '#0c0b16'],
    fogDensity: [0.045, 0.045],
    sky: '#8f88ff',
    groundLight: '#120f1c',
    key: '#c9c2ff',
    rim: '#6d63ff',
    ground: '#0d0c16',
    groundRoughness: 0.6,
    groundMetalness: 0.2,
    reflection: 0.6,
    groundGlow: '#000000',
    groundGlowStrength: [0, 0],
    accent: '#b6adff',
  },
  ice: {
    background: ['#071423', '#020711'],
    fog: ['#0f2840', '#1c3c5c'],
    fogDensity: [0.04, 0.085],
    sky: '#a9dcff',
    groundLight: '#0b2034',
    key: '#dff1ff',
    rim: '#4aa8ff',
    ground: '#7fb2d6',
    groundRoughness: 0.18,
    groundMetalness: 0.35,
    reflection: 2.2,
    groundGlow: '#2f7fd0',
    groundGlowStrength: [0, 0.25],
    accent: '#8fd2ff',
  },
  stone: {
    background: ['#120e0a', '#090605'],
    fog: ['#2a2018', '#3d2c1e'],
    fogDensity: [0.035, 0.08],
    sky: '#e3c7a3',
    groundLight: '#1c140d',
    key: '#ffe2bd',
    rim: '#b5784a',
    ground: '#4a3d33',
    groundRoughness: 0.95,
    groundMetalness: 0,
    reflection: 0.12,
    groundGlow: '#ff5a1a',
    groundGlowStrength: [0, 0.08],
    accent: '#d9b48a',
  },
  fire: {
    background: ['#160605', '#220201'],
    fog: ['#3a0e07', '#5c1407'],
    fogDensity: [0.03, 0.07],
    sky: '#ff9a5a',
    groundLight: '#2a0703',
    key: '#ffb072',
    rim: '#ff3c12',
    ground: '#1c0f0c',
    groundRoughness: 0.85,
    groundMetalness: 0.1,
    reflection: 0.5,
    groundGlow: '#ff4a12',
    groundGlowStrength: [0.15, 0.6],
    accent: '#ff8a3c',
  },
}

const FORMS: GrowthForm[] = ['seed', 'ice', 'stone', 'fire']
const tmp = new Color()
const tmp2 = new Color()

/** 按当前权重混合颜色（low/high 按压力插值） */
export function blendColor(
  out: Color,
  v: VisualState,
  pick: (p: EnvPalette) => string | [string, string],
): Color {
  out.setRGB(0, 0, 0)
  for (const form of FORMS) {
    const w = formWeight(v, form)
    if (w <= 0) continue
    const value = pick(PALETTES[form])
    if (typeof value === 'string') tmp.set(value)
    else tmp.set(value[0]).lerp(tmp2.set(value[1]), v.pressure)
    out.r += tmp.r * w
    out.g += tmp.g * w
    out.b += tmp.b * w
  }
  return out
}

export function blendNumber(v: VisualState, pick: (p: EnvPalette) => number | [number, number]): number {
  let sum = 0
  for (const form of FORMS) {
    const w = formWeight(v, form)
    if (w <= 0) continue
    const value = pick(PALETTES[form])
    sum += (typeof value === 'number' ? value : value[0] + (value[1] - value[0]) * v.pressure) * w
  }
  return sum
}

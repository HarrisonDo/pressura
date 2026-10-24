/**
 * 环境粒子：种子期是微尘，冰是飘雪（压力越高风越大），石是扬尘（声音越响越乱），火是上升的余烬。
 * 位置全部在着色器里计算；CPU 每帧只累加一个"行进量"，速度变化时不会跳。
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  ShaderMaterial,
  Vector3,
  type Blending,
} from 'three'
import { createRng } from '../../core/lib/random'
import type { GrowthForm } from '../../core/types'
import { useVisual } from '../VisualContext'
import { formWeight, type VisualState } from '../visual'

const vertexShader = /* glsl */ `
  uniform vec3 uBounds;
  uniform vec3 uOffset;
  uniform vec3 uTravel;
  uniform float uTime;
  uniform float uSize;
  uniform float uSway;
  uniform float uPixelRatio;
  attribute vec3 aSeed;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec3 p = aSeed * uBounds + uTravel * (0.6 + 0.8 * aSeed.y);
    p.x += sin(uTime * (0.4 + aSeed.z) + aSeed.y * 20.0) * uSway;
    p.z += cos(uTime * (0.3 + aSeed.x) + aSeed.x * 17.0) * uSway * 0.6;
    vec3 local = mod(p, uBounds);
    vec3 world = local - uBounds * 0.5 + uOffset;
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.45 + aSeed.x) * uPixelRatio * (300.0 / -mv.z);
    vec3 n = local / uBounds;
    vAlpha = smoothstep(0.0, 0.08, n.y) * smoothstep(1.0, 0.9, n.y) * smoothstep(0.0, 0.1, n.x) * smoothstep(1.0, 0.9, n.x);
    vSeed = aSeed.z;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uFlicker;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    float flicker = mix(1.0, 0.45 + 0.55 * sin(uTime * (5.0 + vSeed * 9.0) + vSeed * 40.0), uFlicker);
    gl_FragColor = vec4(uColor * (1.0 + uFlicker * 1.5), a * a * uOpacity * vAlpha * flicker);
  }
`

interface ParticleConfig {
  count: number
  color: string
  size: number
  opacity: number
  sway: number
  flicker: number
  blending: Blending
  /** 当前帧的速度（世界单位/秒） */
  velocity: (v: VisualState, out: Vector3) => Vector3
}

const CONFIGS: Record<GrowthForm, ParticleConfig> = {
  seed: {
    count: 420,
    color: '#a69dff',
    size: 0.035,
    opacity: 0.4,
    sway: 0.25,
    flicker: 0,
    blending: AdditiveBlending,
    velocity: (_, out) => out.set(0.02, 0.04, 0),
  },
  ice: {
    count: 1500,
    color: '#eaf6ff',
    size: 0.05,
    opacity: 0.8,
    sway: 0.3,
    flicker: 0,
    blending: NormalBlending,
    // 压力越高风雪越大
    velocity: (v, out) => out.set(0.15 + v.pressure * 1.6 + v.burst * 0.8, -0.45 - v.pressure * 0.9, 0.05),
  },
  stone: {
    count: 900,
    color: '#cfae86',
    size: 0.045,
    opacity: 0.45,
    sway: 0.35,
    flicker: 0,
    blending: NormalBlending,
    // 碎碎念越密，尘土越乱
    velocity: (v, out) =>
      out.set(
        0.06 + Math.sin(v.time * 0.7) * v.intensity * 0.6,
        0.03 + v.intensity * 0.25,
        Math.cos(v.time * 0.9) * v.intensity * 0.4,
      ),
  },
  fire: {
    count: 800,
    color: '#ff9a4a',
    size: 0.05,
    opacity: 0.85,
    sway: 0.28,
    flicker: 1,
    blending: AdditiveBlending,
    velocity: (v, out) => out.set(0.05, 0.45 + v.pressure * 1.2 + v.intensity * 0.9 + v.burst * 1.5, 0),
  },
}

const BOUNDS = new Vector3(16, 10, 12)
const OFFSET = new Vector3(0, 1.2, -2)

export function AmbientParticles() {
  return (
    <>
      <ParticleField form="seed" />
      <ParticleField form="ice" />
      <ParticleField form="stone" />
      <ParticleField form="fire" />
    </>
  )
}

function ParticleField({ form }: { form: GrowthForm }) {
  const v = useVisual()
  const dpr = useThree((s) => s.viewport.dpr)
  const config = CONFIGS[form]
  const travel = useRef(new Vector3())
  const velocity = useRef(new Vector3())

  const geometry = useMemo(() => {
    const rng = createRng(0x51a7 + config.count)
    const seeds = new Float32Array(config.count * 3)
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next()
    const g = new BufferGeometry()
    g.setAttribute('aSeed', new BufferAttribute(seeds, 3))
    // position 只是占位，真正的位置在着色器里算
    g.setAttribute('position', new BufferAttribute(new Float32Array(config.count * 3), 3))
    return g
  }, [config.count])

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: config.blending,
        uniforms: {
          uBounds: { value: BOUNDS },
          uOffset: { value: OFFSET },
          uTravel: { value: new Vector3() },
          uTime: { value: 0 },
          uSize: { value: config.size },
          uSway: { value: config.sway },
          uPixelRatio: { value: 1 },
          uColor: { value: new Color(config.color) },
          uOpacity: { value: 0 },
          uFlicker: { value: config.flicker },
        },
      }),
    [config],
  )

  useFrame((_, dt) => {
    const w = formWeight(v, form)
    material.visible = w > 0.001
    if (!material.visible) return
    config.velocity(v, velocity.current)
    travel.current.addScaledVector(velocity.current, dt)
    material.uniforms.uTravel.value.copy(travel.current)
    material.uniforms.uTime.value = v.time
    material.uniforms.uPixelRatio.value = dpr
    material.uniforms.uOpacity.value = config.opacity * w * (form === 'seed' && v.mode === 'idle' ? 0.8 : 1)
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

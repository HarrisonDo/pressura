/**
 * 火：没有实体网格，用面向镜头的程序化火焰面片（三层叠加）+ 炽热核心 + 上升火星。
 * 火星 → 小火苗 → 火焰 → 火柱 → 第 5 阶段收拢成翻滚的火球。
 */
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  ShaderMaterial,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type PointLight,
} from 'three'
import { smoothstep } from '../../core/lib/math'
import { createRng } from '../../core/lib/random'
import { useVisual } from '../VisualContext'
import { entitySize, formWeight, popIn } from '../visual'

const flameVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uShape;   // 0 = 火焰，1 = 火球
  uniform float uHeat;    // 这一层的温度（核心层更热更白）
  uniform float uAlpha;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
  vec3 ramp(float t) {
    vec3 c = mix(vec3(0.35, 0.02, 0.0), vec3(1.0, 0.25, 0.02), smoothstep(0.0, 0.35, t));
    c = mix(c, vec3(1.0, 0.62, 0.12), smoothstep(0.35, 0.65, t));
    c = mix(c, vec3(1.0, 0.95, 0.75), smoothstep(0.7, 1.0, t));
    return c;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float speed = 1.6 + uIntensity * 2.2;

    // 火焰：向上卷动的噪声 + 水滴形遮罩
    float h = vUv.y;
    vec2 q = vec2(p.x * 1.8, h * 2.2 - uTime * speed) + uSeed;
    float n = fbm(q);
    float n2 = fbm(q * 1.7 + 3.1);
    float sway = (n2 - 0.5) * 0.5 * h;
    float width = mix(0.62, 0.04, pow(h, 0.9)) * (0.9 + uIntensity * 0.25);
    float body = 1.0 - smoothstep(width * 0.45, width, abs(p.x + sway));
    float top = 1.0 - smoothstep(0.55, 1.0, h + (n - 0.5) * 0.55);
    float bottom = smoothstep(0.0, 0.1, h);
    float flame = body * top * bottom;

    // 火球：绕中心翻滚的噪声 + 圆形遮罩（旋转角有界，避免随时间无限缠绕成同心圆）
    float r = length(p);
    float ang = atan(p.y, p.x) + uTime * 0.35 + sin(uTime * 0.9) * (1.0 - r) * 1.2;
    vec2 sw = vec2(cos(ang), sin(ang)) * r * 2.2 + uSeed;
    float nb = fbm(sw + vec2(0.0, -uTime * speed * 0.6));
    float ball = 1.0 - smoothstep(0.3, 0.92, r + (nb - 0.5) * 0.6);

    float shape = mix(flame, ball, uShape);
    float detail = mix(n, nb, uShape);
    float heat = clamp(shape * (0.55 + 0.7 * detail) * uHeat * mix(1.0, 0.8, uShape), 0.0, 1.0);
    vec3 color = ramp(heat) * (1.2 + uIntensity * 0.8) * mix(1.0, 0.7, uShape);
    float alpha = smoothstep(0.02, 0.35, shape * (0.6 + detail)) * uAlpha;
    gl_FragColor = vec4(color, alpha);
  }
`

function createFlameMaterial(heat: number, seed: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: flameVertex,
    fragmentShader: flameFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0 },
      uShape: { value: 0 },
      uHeat: { value: heat },
      uAlpha: { value: 1 },
      uSeed: { value: seed },
    },
  })
}

const sparkVertex = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aSeed;
  varying float vLife;
  void main() {
    float life = fract(aSeed.x + uTime * (0.35 + aSeed.y * 0.5) * uSpeed);
    vec3 p = vec3(
      (aSeed.z - 0.5) * 0.9 * (0.4 + life) + sin(uTime * 3.0 + aSeed.y * 30.0) * 0.08 * life,
      life * 2.6,
      (fract(aSeed.z * 7.13) - 0.5) * 0.9 * (0.4 + life)
    );
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (1.0 - life) * uPixelRatio * (300.0 / -mv.z);
    vLife = life;
  }
`

const sparkFragment = /* glsl */ `
  uniform float uAlpha;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * (1.0 - vLife) * uAlpha;
    vec3 c = mix(vec3(1.0, 0.85, 0.5), vec3(1.0, 0.3, 0.05), vLife);
    gl_FragColor = vec4(c * 3.0, a);
  }
`

export function FireFlame({ seed }: { seed: number }) {
  const v = useVisual()
  const camera = useThree((s) => s.camera)
  const dpr = useThree((s) => s.viewport.dpr)
  const group = useRef<Group>(null)
  const billboard = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const light = useRef<PointLight>(null)

  const rng = useMemo(() => createRng(seed).fork('fire'), [seed])
  const layers = useMemo(
    () => [
      { material: createFlameMaterial(0.75, rng.range(0, 50)), scale: 1.25, alpha: 0.55, z: -0.02 },
      { material: createFlameMaterial(1.0, rng.range(0, 50)), scale: 1.0, alpha: 0.9, z: 0 },
      { material: createFlameMaterial(1.45, rng.range(0, 50)), scale: 0.55, alpha: 1.0, z: 0.02 },
    ],
    [rng],
  )
  const sparks = useMemo(() => {
    const count = 140
    const seeds = new Float32Array(count * 3)
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng.next()
    const g = new BufferGeometry()
    g.setAttribute('aSeed', new BufferAttribute(seeds, 3))
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    const material = new ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: sparkFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 1 },
        uSize: { value: 0.06 },
        uPixelRatio: { value: 1 },
        uAlpha: { value: 1 },
      },
    })
    return { geometry: g, material }
  }, [rng])
  const coreColor = useMemo(() => new Color('#ffcf7a'), [])
  const sparkTime = useRef(0)

  useFrame((_, dt) => {
    const g = group.current
    if (!g || !billboard.current) return
    const w = formWeight(v, 'fire')
    g.visible = w > 0.001
    if (!g.visible) return

    const p = v.pressure
    const size = entitySize(p) * popIn(w) * (1 + v.burst * 0.15)
    g.scale.setScalar(size)

    // 第 4 阶段拔高成火柱，第 5 阶段收拢成火球
    const pillar = smoothstep(0.66, 0.86, p)
    const ball = smoothstep(0.88, 0.99, p)
    const height = (1.9 + pillar * 1.1) * (1 - ball * 0.42)
    const width = (1.25 - pillar * 0.15) * (1 + ball * 0.15)

    billboard.current.quaternion.copy(camera.quaternion)
    layers.forEach((layer, i) => {
      const mesh = billboard.current?.children[i] as Mesh | undefined
      if (!mesh) return
      mesh.scale.set(width * layer.scale, height * layer.scale, 1)
      // 火焰面片的底部对齐核心；火球时居中
      mesh.position.set(0, (height * layer.scale * 0.5 - 0.35) * (1 - ball), layer.z)
      const u = layer.material.uniforms
      u.uTime.value = v.time
      u.uIntensity.value = v.intensity + v.burst * 0.6
      u.uShape.value = ball
      u.uAlpha.value = layer.alpha * Math.min(1, w * 1.4)
    })

    if (core.current) {
      const flicker = 1 + Math.sin(v.time * 23) * 0.04 + Math.sin(v.time * 37) * 0.03
      core.current.scale.setScalar((0.16 + v.intensity * 0.06 + v.burst * 0.08) * flicker)
      const mat = core.current.material as MeshBasicMaterial
      mat.color.copy(coreColor).multiplyScalar(2.5 + v.intensity * 2 + v.burst * 3)
    }

    sparkTime.current += dt * (0.6 + v.intensity * 1.6 + v.burst * 3)
    const su = sparks.material.uniforms
    su.uTime.value = sparkTime.current
    su.uPixelRatio.value = dpr
    su.uAlpha.value = w * (0.5 + v.intensity * 0.5)
    su.uSize.value = 0.05 + v.intensity * 0.03

    if (light.current) {
      const flicker = 0.85 + 0.15 * Math.sin(v.time * 19) * Math.sin(v.time * 7.3)
      light.current.intensity = (3 + p * 6 + v.intensity * 5 + v.burst * 8) * flicker * w
    }
  })

  return (
    <group ref={group} visible={false}>
      <group ref={billboard}>
        {layers.map((layer, i) => (
          <mesh key={i} material={layer.material}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        ))}
      </group>
      <mesh ref={core}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial color="#ffcf7a" toneMapped={false} />
      </mesh>
      <points geometry={sparks.geometry} material={sparks.material} frustumCulled={false} position={[0, -0.2, 0]} />
      <pointLight ref={light} color="#ff7a2a" intensity={3} distance={8} position={[0, 0.3, 0.4]} />
    </group>
  )
}

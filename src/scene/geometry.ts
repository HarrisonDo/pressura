/**
 * 几何体与材质工厂。生长场景和后续的标本查看器共用，保证同一种子长得一样。
 */
import {
  BufferAttribute,
  Color,
  IcosahedronGeometry,
  LatheGeometry,
  MeshStandardMaterial,
  Vector2,
  Vector3,
  type BufferGeometry,
} from 'three'
import { createStoneShaper } from '../core/artifact/stone'

/** 六棱柱 + 尖顶，底面在 y=0，高 1，半径 1 */
export function prismGeometry(): BufferGeometry {
  const profile = [
    new Vector2(0, 0),
    new Vector2(0.85, 0),
    new Vector2(1, 0.06),
    new Vector2(1, 0.76),
    new Vector2(0, 1),
  ]
  const g = new LatheGeometry(profile, 6).toNonIndexed()
  g.computeVertexNormals()
  return g
}

/** 根据种子生成带两个 morph target（粗石、裂岩）和裂缝属性的石头几何体 */
export function buildStoneGeometry(seed: number, detail = 12): BufferGeometry {
  const shaper = createStoneShaper(seed)
  const geometry = new IcosahedronGeometry(1, detail)
  const pos = geometry.getAttribute('position')
  const n = pos.count
  const smooth = new Float32Array(n * 3)
  const rough = new Float32Array(n * 3)
  const cracked = new Float32Array(n * 3)
  const crack = new Float32Array(n)
  const shade = new Float32Array(n * 3)
  const dir = new Vector3()
  const cache = new Map<string, ReturnType<typeof shaper>>()

  for (let i = 0; i < n; i++) {
    dir.fromBufferAttribute(pos, i).normalize()
    // 非索引几何体里同一个顶点会重复出现，缓存一下
    const key = `${dir.x.toFixed(5)},${dir.y.toFixed(5)},${dir.z.toFixed(5)}`
    let point = cache.get(key)
    if (!point) {
      point = shaper(dir.x, dir.y, dir.z)
      cache.set(key, point)
    }
    smooth.set(point.smooth, i * 3)
    rough.set(point.rough, i * 3)
    cracked.set(point.cracked, i * 3)
    crack[i] = point.crack
    // 凹处更暗，相当于手工的环境光遮蔽
    const ao = 0.62 + 0.38 * (point.cavity * 0.5 + 0.5)
    shade[i * 3] = ao
    shade[i * 3 + 1] = ao
    shade[i * 3 + 2] = ao
  }

  geometry.setAttribute('position', new BufferAttribute(smooth, 3))
  geometry.setAttribute('color', new BufferAttribute(shade, 3))
  geometry.setAttribute('aCrack', new BufferAttribute(crack, 1))
  geometry.morphAttributes.position = [new BufferAttribute(rough, 3), new BufferAttribute(cracked, 3)]
  geometry.morphTargetsRelative = false
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export interface StoneUniforms {
  uLava: { value: number }
  uCrackDark: { value: number }
  uTime: { value: number }
  uLavaColor: { value: Color }
}

/** 标准材质 + 裂缝变暗与熔岩自发光 */
export function createStoneMaterial(): { material: MeshStandardMaterial; uniforms: StoneUniforms } {
  const uniforms: StoneUniforms = {
    uLava: { value: 0 },
    uCrackDark: { value: 0 },
    uTime: { value: 0 },
    uLavaColor: { value: new Color('#ff5a14') },
  }
  const material = new MeshStandardMaterial({
    color: new Color('#9a8573'),
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
    vertexColors: true,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCrack;\nvarying float vCrack;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCrack = aCrack;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vCrack;\nuniform float uLava;\nuniform float uCrackDark;\nuniform float uTime;\nuniform vec3 uLavaColor;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= 1.0 - smoothstep(0.15, 0.7, vCrack) * uCrackDark * 0.85;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float lavaPulse = 0.75 + 0.25 * sin(uTime * 2.6 + vCrack * 6.0);
        totalEmissiveRadiance += uLavaColor * smoothstep(0.35, 0.9, vCrack) * uLava * lavaPulse * 4.0;`,
      )
  }
  material.customProgramCacheKey = () => 'pressura-stone'
  return { material, uniforms }
}

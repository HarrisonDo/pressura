/**
 * 种子：定型前的中性光核。随声音脉动，压力到 15% 时碎裂成具体材质。
 */
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, type Group, type Mesh, type SpriteMaterial } from 'three'
import { glowTexture } from '../textures'
import { useVisual } from '../VisualContext'
import { formWeight, seedSize } from '../visual'

export function Seed() {
  const v = useVisual()
  const group = useRef<Group>(null)
  const core = useRef<Mesh>(null)
  const shell = useRef<Mesh>(null)
  const halo = useRef<SpriteMaterial>(null)

  useFrame((_, dt) => {
    const g = group.current
    if (!g || !core.current || !shell.current || !halo.current) return
    const w = formWeight(v, 'seed')
    g.visible = w > 0.001
    if (!g.visible) return
    const breathe = Math.sin(v.time * 2.1) * 0.06
    const pulse = 1 + breathe + v.intensity * 0.45 + v.burst * 0.35
    // 定型瞬间先膨胀再消失
    const vanish = w < 1 && v.form !== 'seed' ? 1 + (1 - w) * 1.6 : 1
    g.scale.setScalar(seedSize(v) * pulse * vanish * Math.min(1, w * 1.5))
    core.current.rotation.y += dt * (0.5 + v.intensity * 3)
    core.current.rotation.x += dt * 0.3
    shell.current.rotation.y -= dt * (0.2 + v.intensity)
    halo.current.opacity = (0.45 + v.intensity * 0.5 + v.flash * 0.6) * w
  })

  return (
    <group ref={group}>
      <mesh ref={core}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#f1eeff" emissive="#a596ff" emissiveIntensity={2.2} flatShading toneMapped={false} />
      </mesh>
      <mesh ref={shell} scale={1.45}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color="#a596ff" wireframe transparent opacity={0.25} toneMapped={false} />
      </mesh>
      <sprite scale={6}>
        <spriteMaterial
          ref={halo}
          map={glowTexture()}
          color="#9b8cff"
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  )
}

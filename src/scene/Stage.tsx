import { Canvas } from '@react-three/fiber'

/**
 * 唯一的 WebGL 画布。主场景、凝结、处置、画廊查看器都在这一个上下文里切换内容。
 */
export function Stage() {
  return (
    <Canvas
      className="stage-canvas"
      dpr={[1, 2]}
      camera={{ position: [0, 0.6, 5], fov: 45, near: 0.1, far: 100 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#06060a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 2]} intensity={1.2} />
      <mesh>
        <icosahedronGeometry args={[0.15, 1]} />
        <meshStandardMaterial color="#c8d0ff" emissive="#6070ff" emissiveIntensity={0.6} flatShading />
      </mesh>
    </Canvas>
  )
}

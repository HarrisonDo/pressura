interface SparklineProps {
  values: readonly number[]
  width?: number
  height?: number
  color?: string
  label: string
}

/** 0~1 数据的面积小图 */
export function Sparkline({ values, width = 240, height = 48, color = 'currentColor', label }: SparklineProps) {
  if (values.length < 2) return null
  const step = width / (values.length - 1)
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(height - v * height).toFixed(1)}`)
  const area = `M0,${height} L${points.join(' L')} L${width},${height} Z`
  const line = `M${points.join(' L')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={area} fill={color} opacity={0.18} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

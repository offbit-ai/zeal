interface ConnectionLineProps {
  startX: number
  startY: number
  endX: number
  endY: number
  type?: 'solid' | 'dashed'
  color?: string
}

export function ConnectionLine({ 
  startX, 
  startY, 
  endX, 
  endY, 
  type = 'solid',
  color = '#D1D5DB' 
}: ConnectionLineProps) {
  // Create a curved path for smooth connections
  const midX = (startX + endX) / 2
  const pathData = `M ${startX} ${startY} Q ${midX} ${startY} ${midX} ${(startY + endY) / 2} T ${endX} ${endY}`

  return (
    <path
      d={pathData}
      stroke={color}
      strokeWidth="2"
      fill="none"
      strokeDasharray={type === 'dashed' ? '5,5' : undefined}
    />
  )
}
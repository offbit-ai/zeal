import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '@/store/graphStore'

// This hook subscribes to port position changes and forces re-renders
// when positions change, bypassing React's batching
export function usePortPositionSubscription() {
  const [updateTrigger, setUpdateTrigger] = useState(0)
  const portPositionsRef = useRef(new Map())

  useEffect(() => {
    // Subscribe to port position changes
    const unsubscribe = useGraphStore.subscribe(
      state => {
        const currentGraph = state.getCurrentGraph()
        return currentGraph?.workflowState?.portPositions || new Map()
      },
      portPositions => {
        // Check if positions actually changed
        const hasChanged =
          portPositions.size !== portPositionsRef.current.size ||
          Array.from(portPositions.entries()).some(([key, value]) => {
            const oldValue = portPositionsRef.current.get(key)
            return !oldValue || oldValue.x !== value.x || oldValue.y !== value.y
          })

        if (hasChanged) {
          portPositionsRef.current = new Map(portPositions)
          // Force a re-render
          setUpdateTrigger(prev => prev + 1)
        }
      }
    )

    return () => unsubscribe()
  }, [])

  return updateTrigger
}

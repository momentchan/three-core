import {
  atomicAdd,
  atomicStore,
  float,
  Fn,
  If,
  instancedArray,
  storage,
  uint,
} from 'three/tsl'

/** Per-instance visible index buffer for indirect draw. */
export function createVisibleIndicesBuffer(count: number) {
  return instancedArray(new Uint32Array(count), 'uint')
}

/** Reset indirect draw counters for one LOD buffer. */
export function createResetCountCompute(
  drawStorage: ReturnType<typeof storage>,
  indexCount: number
) {
  return Fn(() => {
    drawStorage.get('vertexCount').assign(uint(indexCount))
    atomicStore(drawStorage.get('instanceCount'), uint(0))
  })().compute(1)
}

export type VATLODRoutingBuffer = {
  drawStorage: ReturnType<typeof storage>
  indices: ReturnType<typeof instancedArray>
  minDistance: number
  maxDistance: number
}

/**
 * Assign each instance into exactly one LOD visible-indices buffer.
 *
 * false-earth Rose uses If/Else with exclusive min/max windows. The original
 * helper pre-built the next `If()` *outside* the Else callback; TSL records
 * nodes at construction time, so that inner If became a sibling of the outer
 * one and both bands could fire for the same instance (drawn > active, hi/low
 * z-fight). Independent Ifs with the same exclusive windows keep Rose's
 * routing rules without that graph bug.
 */
export function createLODRouting(lodBuffers: VATLODRoutingBuffer[]) {
  return (distToCamera: any, instanceIdx: any) => {
    if (lodBuffers.length === 0) return

    const push = (config: VATLODRoutingBuffer) => {
      const lodIndex = atomicAdd(config.drawStorage.get('instanceCount'), uint(1))
      config.indices.element(lodIndex).assign(uint(instanceIdx))
    }

    if (lodBuffers.length === 1) {
      push(lodBuffers[0])
      return
    }

    for (let i = 0; i < lodBuffers.length; i += 1) {
      const config = lodBuffers[i]
      const isLast = i === lodBuffers.length - 1
      const minDist = float(config.minDistance)
      const maxDist =
        config.maxDistance === Infinity ? float(1e9) : float(config.maxDistance)
      const inRange = distToCamera.greaterThanEqual(minDist).and(
        isLast || config.maxDistance === Infinity
          ? distToCamera.lessThanEqual(maxDist)
          : distToCamera.lessThan(maxDist),
      )
      If(inRange, () => {
        push(config)
      })
    }
  }
}

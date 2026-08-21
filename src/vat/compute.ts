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
 * Build a distance-based LOD routing function for use inside a compute Fn.
 * Assigns each instance into exactly one LOD visible-indices buffer.
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

    // Exclusive split: [0, split) -> lod 0, [split, inf) -> lod 1.
    // A chained If/ElseIf used to emit both bands on some mobile WGSL paths,
    // so one flower was drawn twice (drawn > active) and popped hi/low.
    const split = float(
      lodBuffers[0].maxDistance === Infinity
        ? 1e9
        : lodBuffers[0].maxDistance,
    )
    If(distToCamera.lessThan(split), () => {
      push(lodBuffers[0])
    }).Else(() => {
      push(lodBuffers[lodBuffers.length - 1])
    })
  }
}

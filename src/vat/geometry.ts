import * as THREE from 'three'
import type { VATMeta } from './types'

export type SetupVATGeometryOptions = {
  /**
   * Flip X on mesh positions (Unity left-handed -> Three.js right-handed).
   * Default: true
   */
  flipX?: boolean
  /**
   * Assign stem/flower part colors when COLOR_0 is missing from the GLB.
   * Flower = red (1,0,0), stem = black (0,0,0) by default.
   */
  partColors?: VatPartColorOptions | false
}

export type VatPartColorOptions = {
  /** Rest-pose Y threshold: vertices at or below this are stem. */
  stemYMax?: number
  flowerColor?: [number, number, number]
  stemColor?: [number, number, number]
}

const DEFAULT_FLOWER_COLOR: [number, number, number] = [1, 0, 0]
const DEFAULT_STEM_COLOR: [number, number, number] = [0, 0, 0]

function hasFlowerTaggedVertices(colorAttr: THREE.BufferAttribute): boolean {
  for (let i = 0; i < colorAttr.count; i++) {
    if (colorAttr.getX(i) > 0.5) {
      return true
    }
  }
  return false
}

/** Ensure COLOR_0 exists for flower/stem shader branching. */
export function setupVatPartColors(
  geometry: THREE.BufferGeometry,
  options: VatPartColorOptions = {},
): 'vertex' | 'yThreshold' {
  const {
    stemYMax = 0.05,
    flowerColor = DEFAULT_FLOWER_COLOR,
    stemColor = DEFAULT_STEM_COLOR,
  } = options

  const colorAttr = geometry.getAttribute('color')
  if (colorAttr && hasFlowerTaggedVertices(colorAttr as THREE.BufferAttribute)) {
    return 'vertex'
  }

  if (colorAttr && !hasFlowerTaggedVertices(colorAttr as THREE.BufferAttribute)) {
    console.warn(
      '[VAT] COLOR_0 is present but no flower vertices (r > 0.5). Using Y-threshold fallback.',
    )
  } else {
    console.warn(
      `[VAT] COLOR_0 missing from GLB — using Y <= ${stemYMax} as stem. Re-export with vertex colors.`,
    )
  }

  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)

  for (let i = 0; i < position.count; i++) {
    const isStem = position.getY(i) <= stemYMax
    const color = isStem ? stemColor : flowerColor
    colors[i * 3 + 0] = color[0]
    colors[i * 3 + 1] = color[1]
    colors[i * 3 + 2] = color[2]
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return 'yThreshold'
}

/**
 * Setup VAT geometry: generate UV1 coordinates for Unity VAT texture layout.
 * Optionally converts positions from Unity's left-handed to Three.js right-handed.
 */
export function setupVATGeometry(
  geometry: THREE.BufferGeometry,
  meta: VATMeta,
  options: SetupVATGeometryOptions = {}
): void {
  const { flipX = true } = options
  const count = geometry.getAttribute('position').count
  const positionAttr = geometry.getAttribute('position')

  const uv1Array = new Float32Array(count * 2)
  const padding = meta.padding ?? 2
  const adjustedFramesCount = meta.frameCount + padding

  for (let i = 0; i < count; i++) {
    const columnIndex = Math.floor(i / meta.textureHeight)
    const verticalIndex = i % meta.textureHeight

    const uIdx = columnIndex * adjustedFramesCount
    const vIdx = verticalIndex

    uv1Array[2 * i + 0] = (uIdx + 0.5) / meta.textureWidth
    uv1Array[2 * i + 1] = (vIdx + 0.5) / meta.textureHeight
  }

  geometry.setAttribute('uv1', new THREE.BufferAttribute(uv1Array, 2))

  if (flipX) {
    const positionArray = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      positionArray[3 * i + 0] = positionAttr.getX(i) * -1
      positionArray[3 * i + 1] = positionAttr.getY(i)
      positionArray[3 * i + 2] = positionAttr.getZ(i)
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3))
  }

  if (options.partColors !== false) {
    setupVatPartColors(geometry, options.partColors ?? {})
  }
}

/**
 * Resolve animation frame ratio [0, 1] from explicit ratio or elapsed time.
 */
export function calculateVATFrame(
  frameRatio: number | undefined,
  currentTime: number,
  metaData: VATMeta,
  speed: number
): number {
  if (frameRatio !== undefined) {
    return Math.max(0, Math.min(1, frameRatio))
  }
  const fps = metaData.fps || 24
  const duration = metaData.frameCount / fps
  const timePosition = ((currentTime * speed) % duration) / duration
  return Math.max(0, Math.min(1, timePosition))
}

/** Extract the first mesh geometry from a THREE.Group/Scene. */
export function extractGeometryFromScene(
  scene: THREE.Group,
  meta?: VATMeta,
  options: SetupVATGeometryOptions = {}
): THREE.BufferGeometry | null {
  if (meta) {
    return extractMeshGeometriesFromScene(scene, meta, options)[0]?.geometry ?? null
  }

  let geometry: THREE.BufferGeometry | null = null

  scene.traverse((object: any) => {
    if (object.isMesh && object.geometry && !geometry) {
      geometry = object.geometry.clone()
    }
  })

  return geometry
}

export type VATMeshPart = {
  name: string
  geometry: THREE.BufferGeometry
}

/** Extract all mesh geometries from a VAT GLB scene and set up UV1 for sampling. */
export function extractMeshGeometriesFromScene(
  scene: THREE.Group,
  meta: VATMeta,
  options: SetupVATGeometryOptions = {}
): VATMeshPart[] {
  const parts: VATMeshPart[] = []

  scene.traverse((object: any) => {
    if (object.isMesh && object.geometry) {
      const geometry = object.geometry.clone()
      setupVATGeometry(geometry, meta, options)
      parts.push({
        name: object.name || `mesh_${parts.length}`,
        geometry,
      })
    }
  })

  return parts
}

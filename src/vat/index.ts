export type {
  VATMeta,
  VATData,
  VATLODConfig,
  VATLODBufferConfig,
} from './types'

export { drawIndirectStructure } from './structures'

export {
  setupVATGeometry,
  setupVatPartColors,
  calculateVATFrame,
  extractGeometryFromScene,
  extractMeshGeometriesFromScene,
} from './geometry'
export type { SetupVATGeometryOptions, VATMeshPart, VatPartColorOptions } from './geometry'

export {
  preloadVATAssets,
  useVATPreloader,
  clearVATCache,
} from './loader'

export {
  decodeVatNormal,
  createVATSampleUV,
  sampleVATPosition,
  sampleVATNormal,
  sampleVATNormalVarying,
  sampleVATNormalFrameBlended,
} from './tsl'

export {
  createVisibleIndicesBuffer,
  createResetCountCompute,
  createLODRouting,
} from './compute'
export type { VATLODRoutingBuffer } from './compute'

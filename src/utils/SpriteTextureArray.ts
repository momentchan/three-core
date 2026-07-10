import * as THREE from 'three/webgpu'

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

type TextureSource =
  | HTMLImageElement
  | ImageBitmap
  | HTMLCanvasElement
  | Blob
  | File
  | string

function sourceToImage(source: TextureSource): Promise<HTMLImageElement | ImageBitmap | HTMLCanvasElement> {
  if (source instanceof HTMLImageElement) return Promise.resolve(source)
  if (source instanceof ImageBitmap) return Promise.resolve(source)
  if (source instanceof HTMLCanvasElement) return Promise.resolve(source)
  if (source instanceof Blob || source instanceof File) return createImageBitmap(source)
  if (typeof source === 'string') return loadImage(source)
  return Promise.reject(new TypeError('Unsupported texture source'))
}

type FitMode = 'contain' | 'stretch'

export class SpriteTextureArray {
  width: number
  height: number
  maxLayers: number
  layerCount: number
  fit: FitMode
  texture: THREE.DataArrayTexture
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor({
    width,
    height,
    maxLayers,
    fit = 'contain',
  }: {
    width: number
    height: number
    maxLayers: number
    fit?: FitMode
  }) {
    this.width = width
    this.height = height
    this.maxLayers = maxLayers
    this.fit = fit
    this.layerCount = 0

    const data = new Uint8Array(width * height * 4 * maxLayers)
    this.texture = new THREE.DataArrayTexture(data, width, height, maxLayers)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.wrapS = THREE.ClampToEdgeWrapping
    this.texture.wrapT = THREE.ClampToEdgeWrapping
    this.texture.flipY = false
    this.texture.needsUpdate = true

    this.canvas = document.createElement('canvas')
    this.canvas.width = width
    this.canvas.height = height
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
  }

  randomLayerIndex(): number {
    if (this.layerCount === 0) return 0
    return Math.floor(Math.random() * this.layerCount)
  }

  async addFromSource(source: TextureSource): Promise<number> {
    if (this.layerCount >= this.maxLayers) {
      throw new Error('Sprite texture array is full')
    }

    const image = await sourceToImage(source)
    const layer = this.layerCount

    this.ctx.clearRect(0, 0, this.width, this.height)

    if (this.fit === 'stretch') {
      // Fill the whole layer, distorting aspect ratio if needed.
      this.ctx.drawImage(image as CanvasImageSource, 0, 0, this.width, this.height)
    } else {
      // Fit the source into the layer without distorting its aspect ratio
      // ("contain"): scale to fit, then center. Sources that already match the
      // layer aspect (e.g. the square reference art) draw 1:1; landscape/portrait
      // scans get transparent padding instead of being stretched.
      const srcWidth = 'width' in image ? image.width : this.width
      const srcHeight = 'height' in image ? image.height : this.height
      const scale = Math.min(this.width / srcWidth, this.height / srcHeight)
      const drawWidth = srcWidth * scale
      const drawHeight = srcHeight * scale
      const dx = (this.width - drawWidth) / 2
      const dy = (this.height - drawHeight) / 2
      this.ctx.drawImage(image as CanvasImageSource, dx, dy, drawWidth, drawHeight)
    }

    const pixels = this.ctx.getImageData(0, 0, this.width, this.height).data
    const offset = layer * this.width * this.height * 4
    this.texture.image.data.set(pixels, offset)
    this.texture.addLayerUpdate(layer)
    this.texture.needsUpdate = true

    this.layerCount += 1
    return layer
  }

  async addFromUrl(url: string): Promise<number> {
    return this.addFromSource(url)
  }
}

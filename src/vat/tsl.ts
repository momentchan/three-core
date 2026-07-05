import * as THREE from 'three/webgpu'
import {
  abs,
  float,
  floor,
  fract,
  min,
  mix,
  normalize,
  sign,
  step,
  texture,
  uniform,
  uv,
  varying,
  vec2,
  vec3,
} from 'three/tsl'
import type { VATMeta } from './types'

/** Decode VAT normal texel (oct-encoded or linear RGB). */
export const decodeVatNormal = (texel: any, isCompressed: boolean) => {
  if (isCompressed) {
    const encoded = texel.xy.mul(2.0).sub(1.0)
    const vZ = float(1.0).sub(abs(encoded.x)).sub(abs(encoded.y))
    const v = vec3(encoded.x, encoded.y, vZ)
    const s = sign(v.xy)
    const adj = float(1.0).sub(abs(v.yx)).mul(s)
    const finalXY = mix(adj, v.xy, step(0.0, v.z))
    return normalize(vec3(finalXY.x, finalXY.y, v.z))
  }
  return normalize(texel.rgb.mul(2.0).sub(1.0))
}

/**
 * Build VAT sample UV from animation frame [0, 1] and meta layout.
 * Uses mesh UV1 as the base coordinate.
 */
export function createVATSampleUV(frame: any, meta: VATMeta) {
  const uFrames = uniform(meta.frameCount)
  const frameIndex = uFrames.sub(float(1.0)).mul(frame)
  return vec2(uv(1).x.add(frameIndex.mul(1.0 / meta.textureWidth)), uv(1).y)
}

/** Sample VAT position texture (RGB = local position). */
export function sampleVATPosition(posTex: THREE.Texture, sampleUV: any) {
  return texture(posTex, sampleUV).rgb
}

/** Sample and decode VAT normal texture. */
export function sampleVATNormal(
  nrmTex: THREE.Texture,
  sampleUV: any,
  compressNormal = true
) {
  const rawNormal = texture(nrmTex, sampleUV)
  return decodeVatNormal(rawNormal, compressNormal)
}

/**
 * Sample and decode the VAT normal in the vertex stage.
 *
 * VAT UVs are per-vertex texel lookups, so the fetch must happen in the
 * vertex shader; fragment-stage sampling reads arbitrary texels between
 * vertex rows. Use this (or wrap your own sampling chain in varying())
 * when feeding normalNode/colorNode. Returns the interpolated local-space
 * normal.
 */
export function sampleVATNormalVarying(
  nrmTex: THREE.Texture,
  sampleUV: any,
  compressNormal = true
) {
  return varying(sampleVATNormal(nrmTex, sampleUV, compressNormal))
}

/**
 * Sample the VAT normal with frame-safe interpolation.
 *
 * A fractional frame UV lets the hardware linear filter blend the *encoded*
 * texels of two adjacent frames. Oct-encoded normals are not linear (the
 * encoding has sign-flip seams), so that blend produces bogus normals on
 * some vertices for in-between frames, which reads as color flicker.
 *
 * This samples both neighboring frames at exact texel centers, decodes
 * each normal, and then blends the decoded vectors. Returns a varying
 * with the interpolated local-space normal.
 */
export function sampleVATNormalFrameBlended(
  nrmTex: THREE.Texture,
  frame: any,
  meta: VATMeta,
  compressNormal = true
) {
  const uFrames = uniform(meta.frameCount)
  const frameIndex = uFrames.sub(float(1.0)).mul(frame)
  const frameA = floor(frameIndex)
  const frameB = min(frameA.add(float(1.0)), uFrames.sub(float(1.0)))
  const blend = fract(frameIndex)

  const texelStep = 1.0 / meta.textureWidth
  const uvA = vec2(uv(1).x.add(frameA.mul(texelStep)), uv(1).y)
  const uvB = vec2(uv(1).x.add(frameB.mul(texelStep)), uv(1).y)

  const normalA = decodeVatNormal(texture(nrmTex, uvA), compressNormal)
  const normalB = decodeVatNormal(texture(nrmTex, uvB), compressNormal)

  return varying(normalize(mix(normalA, normalB, blend)))
}

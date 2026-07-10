import { useFrame, useThree } from '@react-three/fiber'
import { useControls, folder } from 'leva'
import { useEffect, useMemo, useRef } from 'react'
import type { Node } from 'three/webgpu'
import { pass, renderOutput, uniform, vec3, dot, mix } from 'three/tsl'
import {
  ACESFilmicToneMapping,
  NoToneMapping,
  PostProcessing,
} from 'three/webgpu'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { smaa } from 'three/addons/tsl/display/SMAANode.js'

type PostFXControls = {
  enabled: boolean
  bloomEnabled: boolean
  intensity: number
  luminanceThreshold: number
  luminanceSmoothing: number
  bloomRadius: number
  smaaEnabled: boolean
  toneMappingEnabled: boolean
  exposure: number
  colorGradeEnabled: boolean
  brightness: number
  contrast: number
  saturation: number
}

const LUMA = vec3(0.2126, 0.7152, 0.0722)

export type PostFXDefaults = Partial<PostFXControls>

const BASE_DEFAULTS: PostFXControls = {
  enabled: true,
  bloomEnabled: true,
  intensity: 1,
  luminanceThreshold: 1,
  luminanceSmoothing: 0.2,
  bloomRadius: 0.6,
  smaaEnabled: true,
  toneMappingEnabled: true,
  exposure: 0.5,
  colorGradeEnabled: true,
  brightness: 1,
  contrast: 1,
  saturation: 1,
}

function WebGPUPostFX({ ctrl }: { ctrl: PostFXControls }) {
  const { gl, scene, camera } = useThree()
  const postProcessingRef = useRef<PostProcessing | null>(null)
  const bloomPassRef = useRef<ReturnType<typeof bloom> | null>(null)

  // Live-updating uniforms for the screenspace color grade (identity defaults).
  const grade = useMemo(
    () => ({
      brightness: uniform(1),
      contrast: uniform(1),
      saturation: uniform(1),
    }),
    [],
  )

  useEffect(() => {
    const scenePass = pass(scene, camera)
    const sceneColor = scenePass.getTextureNode('output')

    let outputNode: Node = sceneColor

    if (ctrl.bloomEnabled) {
      const bloomPass = bloom(
        sceneColor,
        ctrl.intensity,
        ctrl.bloomRadius,
        ctrl.luminanceThreshold,
      )
      bloomPass.smoothWidth.value = ctrl.luminanceSmoothing
      bloomPassRef.current = bloomPass
      outputNode = sceneColor.add(bloomPass)
    } else {
      bloomPassRef.current = null
    }

    // Screenspace color grade: brightness -> contrast -> saturation.
    if (ctrl.colorGradeEnabled) {
      const bright = outputNode.mul(grade.brightness)
      const contrasted = bright.sub(0.5).mul(grade.contrast).add(0.5)
      const luma = dot(contrasted, LUMA)
      outputNode = mix(vec3(luma), contrasted, grade.saturation)
    }

    if (ctrl.smaaEnabled) {
      outputNode = smaa(outputNode)
    }

    const needsManualOutput = ctrl.smaaEnabled || ctrl.toneMappingEnabled
    if (needsManualOutput) {
      outputNode = renderOutput(outputNode)
    }

    const postProcessing = new PostProcessing(gl as never, outputNode)
    postProcessing.outputColorTransform = !needsManualOutput
    postProcessingRef.current = postProcessing

    return () => {
      postProcessing.dispose()
      postProcessingRef.current = null
      bloomPassRef.current = null
    }
  }, [
    gl,
    scene,
    camera,
    grade,
    ctrl.bloomEnabled,
    ctrl.smaaEnabled,
    ctrl.toneMappingEnabled,
    ctrl.colorGradeEnabled,
  ])

  useFrame(() => {
    gl.toneMapping = ctrl.toneMappingEnabled
      ? ACESFilmicToneMapping
      : NoToneMapping
    gl.toneMappingExposure = ctrl.exposure

    grade.brightness.value = ctrl.brightness
    grade.contrast.value = ctrl.contrast
    grade.saturation.value = ctrl.saturation

    const bloomPass = bloomPassRef.current
    if (bloomPass) {
      bloomPass.strength.value = ctrl.intensity
      bloomPass.threshold.value = ctrl.luminanceThreshold
      bloomPass.radius.value = ctrl.bloomRadius
      bloomPass.smoothWidth.value = ctrl.luminanceSmoothing
    }

    postProcessingRef.current?.render()
  }, 1)

  return null
}

export function PostFX({ defaults }: { defaults?: PostFXDefaults } = {}) {
  const d = { ...BASE_DEFAULTS, ...defaults }
  const ctrl = useControls('PostFX', {
    enabled: { value: d.enabled },
    bloom: folder({
      bloomEnabled: { value: d.bloomEnabled },
      intensity: { value: d.intensity, min: 0, max: 3, step: 0.01 },
      luminanceThreshold: { value: d.luminanceThreshold, min: 0, max: 2, step: 0.01 },
      luminanceSmoothing: { value: d.luminanceSmoothing, min: 0, max: 1, step: 0.01 },
      bloomRadius: { value: d.bloomRadius, min: 0, max: 1, step: 0.01, label: 'Radius' },
    }, { collapsed: true }),
    antialias: folder({
      smaaEnabled: { value: d.smaaEnabled, label: 'SMAA' },
    }, { collapsed: true }),
    toneMapping: folder({
      toneMappingEnabled: { value: d.toneMappingEnabled },
      exposure: { value: d.exposure, min: 0, max: 4, step: 0.01 },
    }, { collapsed: true }),
    colorGrade: folder({
      colorGradeEnabled: { value: d.colorGradeEnabled, label: 'Enabled' },
      brightness: { value: d.brightness, min: 0, max: 2, step: 0.01 },
      contrast: { value: d.contrast, min: 0, max: 2, step: 0.01 },
      saturation: { value: d.saturation, min: 0, max: 2, step: 0.01 },
    }, { collapsed: true }),
  })

  if (!ctrl.enabled) return null

  return <WebGPUPostFX ctrl={ctrl} />
}

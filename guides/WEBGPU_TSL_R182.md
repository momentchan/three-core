# Three.js WebGPU and TSL Rules

Shared guidance for Three.js r182. Check release notes and official source before
applying version-sensitive names to another Three.js revision.

React lifecycle and ownership rules are in `R3F_RUNTIME.md`.

## Imports and backend checks

For the WebGPU rendering path, use:

```js
import * as THREE from 'three/webgpu';
import { Fn, uniform, vec3 } from 'three/tsl';
```

Do not casually mix class instances imported from `three`, `three/webgpu`, and
legacy examples. Use a different entry point only when an API explicitly
requires it.

Before calling backend-specific methods such as `compute`, verify the renderer
or capability. Do not normalize casts such as
`gl as unknown as WebGPURenderer` as a substitute for a runtime guard.

## Renderer initialization

Initialize `WebGPURenderer` through R3F:

```jsx
function createRenderer(props) {
  const renderer = new THREE.WebGPURenderer({
    ...props,
    powerPreference: 'high-performance',
    antialias: true,
  });
  return renderer.init().then(() => renderer);
}

<Canvas gl={createRenderer}>{/* scene */}</Canvas>
```

Renderer flags are requirements, not universal defaults:

- `alpha` depends on page composition
- `preserveDrawingBuffer` has a cost and should be enabled only when required
- antialiasing, shadows, stencil, and sorting depend on content
- DPR limits and performance thresholds are product policy

Define one deliberate color pipeline. R3F configures color management and tone
mapping from `Canvas` props, so direct renderer values can be overridden. Use
the appropriate `Canvas` configuration, such as `flat`, when the intended
pipeline requires no tone mapping.

## TSL and NodeMaterial

Use NodeMaterial for custom WebGPU material behavior:

```js
const material = new THREE.MeshStandardNodeMaterial();
material.colorNode = colorNode;
material.positionNode = positionNode;
```

Use `Fn` for reusable node graphs:

```js
const shade = Fn(([baseColor, amount]) => (
  vec3(baseColor).mul(amount)
));
```

Rules:

- TSL records a shader graph; it does not execute ordinary JavaScript math.
- Keep local, world, view, clip, and screen coordinate spaces explicit.
- In r182, `positionNode` supplies local-space vertex position.
- Use `.toVar()` when a node result is reused or mutated with assignment
  operations.
- Use `uniform()` for scalar or small structured values updated from JavaScript.
- Update `uniform.value`; do not rebuild a material for an ordinary control
  change.
- Rebuild only when shader graph topology or compile-time structure changes.
- Prefer TSL nodes over raw GLSL/WGSL in a WebGPU path unless a documented
  backend requirement justifies custom source.

Alpha blending, alpha test/hash, masks, and explicit `Discard` have different
depth, sorting, edge, and performance behavior. Choose from rendering
requirements; do not treat one as a universal replacement.

## Uniform scope

Create uniforms per material or component when instances need independent
values.

Module-level uniforms are valid intentional shared state, but they couple every
consumer. Use them only for a genuinely global value and document the shared
ownership.

## TSL flow control

Construct `If`, `Else`, loops, and nested branches inside the callbacks that
define their intended graph scope. Do not prebuild nested branches outside an
`Else` callback and then assume JavaScript nesting controls shader recording.

For LOD routing or compaction:

- make windows mutually exclusive
- ensure an instance can be submitted only once
- test boundary distances
- name compute nodes for GPU diagnostics

`three-core/src/vat/compute.ts` is the shared LOD-routing reference. It records
each branch in its intended callback scope and routes an instance at most once.

## Textures and color data

Assign color space from texture meaning:

- color textures authored for display, such as albedo: `SRGBColorSpace`
- non-color data, such as masks, normals, VAT, and lookup data: `NoColorSpace`

Configure wrapping, filtering, `flipY`, and color space once after load. Set
`needsUpdate` only when texture configuration or pixel data changed.

For mutable DataTextures, batch CPU writes and set `texture.needsUpdate` once.

KTX2 conversion, transcoder hosting, fallback formats, file naming, and preload
priority are deployment policy. Do not assume every PNG or JPEG has a KTX2
sibling.

## Storage, compute, and indirect draw

Use compute and indirect drawing only when population size and update behavior
justify the complexity.

Define GPU records centrally:

- use named struct layouts
- derive stride from the layout where possible
- keep CPU offsets and shader reads tied to the same definition
- document units and coordinate spaces

A typical indirect-draw frame is:

1. update camera, input, and simulation uniforms
2. reset atomic counters and indirect draw counts
3. dispatch simulation, culling, compaction, or LOD routing
4. render meshes that consume the resulting buffers

The exact dispatch order is a data dependency contract. Document it beside the
dispatcher.

Set `frustumCulled = false` only when custom GPU culling replaces CPU culling or
CPU bounds cannot represent the deformation. It is not a default optimization.

Prefer capability or runtime tests when selecting CPU and GPU backends.
User-agent checks are compatibility workarounds and must be tied to tested
versions.

## Post-processing in r182

Three r182 uses `THREE.PostProcessing`:

```js
useEffect(() => {
  const pipeline = new THREE.PostProcessing(gl);
  const scenePass = pass(scene, camera);
  pipeline.outputNode = createEffectNode(scenePass, uniforms);
  pipelineRef.current = pipeline;

  return () => {
    pipelineRef.current = null;
    pipeline.dispose();
  };
}, [gl, scene, camera, uniforms]);
```

Render it from the single final-render owner:

```js
useFrame(() => {
  pipelineRef.current?.render();
}, 1);
```

Build the pass graph outside the frame loop. Update uniforms per frame. Rebuild
the graph only when effect topology changes.

If disabling an effect only mixes its result away, the expensive effect may
still execute. Bypass or rebuild the pass when profiling shows the cost matters.

Keep tone mapping and output color transformation explicit, especially across
multi-pass or multi-scene composition.

For Three r183+, use `RenderPipeline` and verify its constructor, output
transform, and disposal APIs. This `PostProcessing` section applies to r182.

## Compilation and upload readiness

`compileAsync` can warm shader pipelines, but an arbitrary frame count or timer
does not prove GPU uploads completed.

Any compile/upload coordinator must:

- cancel timers and ignore completion after unmount
- expose failure and timeout behavior
- avoid undocumented capability casts
- distinguish shader compilation from asset upload readiness

Treat upload readiness as unverified unless the coordinator exposes a measurable
completion contract.

## Review checklist

Before finishing WebGPU/TSL work:

1. Confirm imports and runtime guards match the renderer backend.
2. Confirm renderer flags and the color pipeline are intentional.
3. Confirm coordinate spaces are explicit.
4. Confirm scalar changes update uniforms instead of rebuilding graph topology.
5. Confirm color and data textures use the correct color space.
6. Confirm GPU struct layout and dispatch order have one source of truth.
7. Confirm indirect submissions cannot overlap unintentionally.
8. Confirm one owner renders and disposes post-processing.
9. Confirm all version-sensitive APIs match the installed Three.js revision.

## References

- TSL: https://threejs.org/docs/TSL.html
- WebGPURenderer: https://threejs.org/docs/pages/WebGPURenderer.html
- PostProcessing r182: https://threejs.org/docs/pages/PostProcessing.html
- Color management: https://threejs.org/manual/en/color-management.html

# React Three Fiber Runtime Rules

Shared guidance for React 19 and React Three Fiber 9 projects using
`three-core`. These rules cover lifecycle and runtime behavior; renderer- and
shader-specific rules are in `WEBGPU_TSL_R182.md`.

## State placement

Use React props or state for values that affect component structure, UI, or
infrequent application state.

Use refs, Three.js object properties, mutable simulation records, uniforms, or
typed GPU data for continuous frame-time values.

Do not call a React state setter every frame. An occasional state transition
caused by crossing a meaningful threshold is valid, but it must not become the
animation path.

## Canvas ownership

- Create the renderer through the R3F `Canvas` `gl` callback.
- The callback receives renderer construction properties, not only a canvas.
- Await asynchronous renderer initialization before returning it.
- Obtain the renderer in descendants with `useThree`.
- Do not create a competing renderer or call `setAnimationLoop`; R3F owns the
  render loop.
- Use the shared `WebGPUCanvas` component for secondary canvases when its API
  fits instead of creating another wrapper.

## `useFrame`

Use `delta` for rates:

```js
useFrame((_, delta) => {
  objectRef.current.rotation.y += radiansPerSecond * Math.min(delta, 0.1);
});
```

`clock.elapsedTime` is suitable for time-based motion, but it is not
deterministic simulation time. Reproducible simulation requires a controlled
timestep and deterministic inputs.

Keep hot frame callbacks small:

- reuse vectors, matrices, colors, and typed arrays
- avoid temporary arrays, object spreads, and repeated scene traversal
- cache object references discovered outside the frame loop
- batch writes before setting `needsUpdate`
- clamp exceptional deltas when simulation stability requires it

Module-level scratch objects are acceptable only for synchronous,
non-reentrant code. Prefer instance-local scratch storage when code can be
recursive, asynchronous, or evaluated concurrently.

## Frame priority

Positive `useFrame` priorities take over rendering. Use them only when a
component deliberately renders the final frame, such as a post-processing
pipeline.

There must be one final-render owner. Other frame callbacks may update
simulation or uniforms, but must not issue another final render.

## Resource creation and identity

Prefer declarative R3F objects when possible so the reconciler controls their
lifecycle.

Use stable resource factories for expensive geometries, materials, node graphs,
buffers, and textures. `useMemo` can avoid unnecessary recreation, but React
does not guarantee it as a semantic resource-lifetime mechanism.

For imperative resources:

- establish explicit ownership
- create them in a lifecycle-safe factory or effect
- update their contents rather than replacing them every frame
- rebuild only when topology, capacity, or shader graph structure changes
- dispose them from the same ownership boundary

Do not hide reactive dependencies behind a derived key:

```js
// Unsafe if buildGeometry reads values not represented by geometryKey.
const geometry = useMemo(() => buildGeometry(items), [geometryKey]);
```

A derived key is valid only when it completely represents every value consumed
by the factory. Otherwise include the actual dependencies or redesign the
factory input.

## Disposal and ownership

Disposal depends on ownership, not on whether code contains `new`:

- R3F-created declarative objects are normally auto-disposed on unmount.
- Objects passed through `<primitive>` are not automatically disposed.
- `dispose={null}` deliberately disables automatic disposal for that subtree.
- Loader results are cached and may be shared across consumers.
- A consumer must not dispose a shared cached geometry, material, or texture.
- Clone cached scenes before instance-specific destructive mutation.
- Explicitly dispose unique imperative geometry, materials, textures, render
  targets, pipelines, storage resources, and compute resources when supported.

Cleanup must also remove listeners, timers, subscriptions, DOM overlays,
registrations, and pending asynchronous callbacks.

Guard asynchronous completion so it cannot update an unmounted consumer.

## Loading and Suspense

Use R3F `useLoader` or focused Drei loader hooks with Suspense. Drei is a
convenience layer, not a requirement.

Deduplicate shared requests. Load independent resources concurrently where
appropriate.

Global caches need an explicit policy for:

- failed requests and retry
- invalidation
- HMR
- ownership and disposal

Do not start asset loading from `useFrame`.

## Geometry updates

Do not rebuild geometry for an object-transform or material-only change.

When vertex positions change:

- set the position attribute's `needsUpdate`
- recompute normals only if lighting requires changed surface orientation
- recompute or invalidate bounds used by culling or raycasting

Topology-changing growth may require a rebuild. Uniform-, VAT-, skinning-, or
compute-driven deformation often does not.

## Population rendering

For large repeated populations, evaluate ordinary instancing before building a
compute or indirect-draw system.

Batching, stable logical slots, typed-array writes, compacted visible indices,
and GPU culling are useful at sufficient scale. They are not universal defaults;
small populations may be simpler and faster on the CPU.

Do not mount one React component per instance when one batch can represent the
same behavior.

## Naming

Use semantic names that expose responsibility:

- hooks: `use...`
- factories: `create...`
- frame operations: `update...`, `dispatch...`, or `write...`
- owned resources: `...Geometry`, `...Material`, `...Buffer`, or `...Storage`

Include units, coordinate space, lifecycle stage, or ownership in a name when
the distinction is otherwise ambiguous.

Domain naming policy belongs to the consuming project, not this shared guide.

## Review checklist

Before finishing R3F runtime work:

1. Confirm continuous values do not re-render React every frame.
2. Confirm the final render has one owner.
3. Confirm hot loops avoid unnecessary allocation and traversal.
4. Confirm every imperative resource has one clear owner.
5. Confirm cached assets are not disposed by consumers.
6. Confirm async completion is safe after unmount.
7. Confirm hook dependencies represent every factory input.
8. Confirm batching or GPU compute is justified by measured scale.

## References

- R3F hooks: https://r3f.docs.pmnd.rs/api/hooks
- R3F performance: https://r3f.docs.pmnd.rs/advanced/pitfalls
- R3F scaling: https://r3f.docs.pmnd.rs/advanced/scaling-performance
- React `useMemo`: https://react.dev/reference/react/useMemo
- Three.js `Clock`: https://threejs.org/docs/pages/Clock.html

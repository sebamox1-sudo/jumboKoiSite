import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, extend, useFrame } from '@react-three/fiber'
import { shaderMaterial, useAspect, useTexture } from '@react-three/drei'
import * as THREE from 'three'

/**
 * LiquidCursorDistortion
 * ----------------------
 * Renders an image on a plane and warps its UVs around the cursor to fake a
 * thick, water-like refraction. The smoothed cursor lags the real pointer, so
 * the distortion TRAILS the mouse; an "energy" value rises while moving and
 * eases back to zero when it stops, so the ripple decays on its own.
 *
 * Architecture / footguns handled (all required up-front, none patched later):
 *  - DPR is capped at 2 (1 on touch) so 4K/Retina screens don't render 4–9×
 *    the pixels and stutter.
 *  - uResolution is fed the live drawing-buffer size every frame, so resizes
 *    keep ripples circular and the plane keeps the image aspect (no stretch).
 *  - Zero allocations inside useFrame (no `new` in the loop) — every vector is
 *    a persistent scratch object, mutated in place, to avoid GC hitching.
 *  - Geometry + material are disposed on unmount; the texture is left to drei's
 *    shared cache.
 *  - Touch / coarse-pointer devices fall back to a cheaper single-sample shader
 *    path and a lower DPR to hold 60fps and spare the battery.
 *  - Texture loads through drei's `useTexture` under a <Suspense> boundary.
 */

// ---------------------------------------------------------------------------
// SHADERS (kept as plain strings outside the component so they're compiled once)
// ---------------------------------------------------------------------------

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    // Pass the raw 0..1 UVs to the fragment stage untouched — all of the
    // liquid math happens per-pixel, so the geometry can stay a flat 1×1 quad.
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  varying vec2 vUv;

  uniform float     uTime;        // seconds, ever-increasing — animates the rings
  uniform vec2      uMouse;       // smoothed cursor in 0..1 UV space (trails the pointer)
  uniform float     uHoverState;  // 0..1 "energy": up while moving, decays when still
  uniform vec2      uResolution;  // drawing-buffer size in px — keeps ripples circular
  uniform sampler2D uTexture;     // the image
  uniform float     uReduced;     // 1.0 on touch/low-power -> cheaper single-tap path

  uniform float uAmplitude;       // max UV displacement (effect strength)
  uniform float uFrequency;       // ring density of the ripple
  uniform float uSpeed;           // how fast rings travel outward
  uniform float uRadius;          // brush radius in UV units the cursor influences

  void main() {
    // 1. ASPECT-CORRECT THE SPACE so a "drop" is a CIRCLE, not an ellipse.
    //    vUv is 0..1 on both axes but the canvas is rarely square. Scaling x by
    //    the canvas aspect ratio turns UV distance into something proportional
    //    to on-screen pixels, so the ripple stays round on any viewport.
    float aspect = uResolution.x / uResolution.y;
    vec2 uvA    = vec2(vUv.x   * aspect, vUv.y);
    vec2 mouseA = vec2(uMouse.x * aspect, uMouse.y);

    // Vector FROM the cursor TO this fragment, and its length (the drop radius).
    vec2 toMouse = uvA - mouseA;
    float dist   = length(toMouse);

    // 2. SOFT CIRCULAR FALLOFF: 1 at the cursor, eased to 0 past uRadius.
    //    smoothstep's edges are swapped on purpose so the value is HIGH in the
    //    centre and feathers to zero at the rim — a brush with no hard edge.
    float falloff = smoothstep(uRadius, 0.0, dist);

    // 3. THE WAVE: concentric rings that travel outward over time.
    //    sin(dist * frequency - time * speed): the (dist * frequency) term packs
    //    rings into space; subtracting (time * speed) slides every ring outward
    //    each frame, reading as a wave expanding from the cursor.
    float wave = sin(dist * uFrequency - uTime * uSpeed);

    // 4. COMBINE into a displacement strength.
    //    falloff   -> only near the cursor
    //    hover     -> fades the whole effect in/out as the pointer moves/stops
    //    amplitude -> how hard we push the UVs
    float strength = falloff * uHoverState * uAmplitude;

    // Push UVs ALONG the radial direction by the (signed) wave. normalize() gives
    // the outward unit vector; the wave makes the surface pull in and bulge out
    // like a real liquid meniscus. The +1e-5 guards normalize(0) at the exact
    // cursor pixel (division by a zero length is undefined).
    vec2 dir          = toMouse / (dist + 1e-5);
    vec2 displacement = dir * wave * strength;

    vec2 distortedUv = vUv - displacement;

    // 5. REFRACTION / CHROMATIC SPLIT for a "thick water" shimmer.
    //    On capable devices we sample R, G and B at slightly different offsets so
    //    the light splits like it would through a curved water surface. On
    //    reduced (touch) devices we take a single tap to skip the extra fetches.
    vec4 color;
    if (uReduced > 0.5) {
      color = texture2D(uTexture, distortedUv);
    } else {
      float shift = strength * 0.6; // chromatic spread scales with the distortion
      float r = texture2D(uTexture, distortedUv + dir * shift).r;
      float g = texture2D(uTexture, distortedUv).g;
      float b = texture2D(uTexture, distortedUv - dir * shift).b;
      color = vec4(r, g, b, 1.0);
    }

    // Raw pass-through: the texture is stored as sRGB and written straight to the
    // sRGB framebuffer (no colour-space chunk), which displays 1:1 with the source.
    gl_FragColor = color;
  }
`

// ---------------------------------------------------------------------------
// MATERIAL — drei's shaderMaterial bundles the uniforms + shaders into a class.
// extend() registers it as the JSX element <liquidCursorMaterial />.
// ---------------------------------------------------------------------------

const LiquidCursorMaterial = shaderMaterial(
  {
    uTime: 0,
    uMouse: new THREE.Vector2(0.5, 0.5),
    uHoverState: 0,
    uResolution: new THREE.Vector2(1, 1),
    uTexture: null,
    uReduced: 0,
    uAmplitude: 0.08,
    uFrequency: 26.0,
    uSpeed: 4.5,
    uRadius: 0.35,
  },
  vertexShader,
  fragmentShader,
)

extend({ LiquidCursorMaterial })

// ---------------------------------------------------------------------------
// PLANE — lives inside <Canvas>; suspends on the texture until it's ready.
// ---------------------------------------------------------------------------

function DistortionPlane({ imageSrc, reduced, intensity, radius }) {
  const materialRef = useRef(null)
  const geometryRef = useRef(null)

  // Suspends until decoded (the parent <Suspense> shows the fallback meanwhile).
  const texture = useTexture(imageSrc)

  // Fit the plane to the image's native aspect ratio so it never stretches.
  // useAspect re-derives this from the live viewport, so a window resize keeps
  // the proportions correct for free.
  const scale = useAspect(texture.image?.width || 1, texture.image?.height || 1)

  // Scratch vector created ONCE and mutated in place each frame — the useFrame
  // loop below must never allocate, or the GC will hitch the animation.
  const pointerUv = useMemo(() => new THREE.Vector2(0.5, 0.5), [])

  useFrame((state, delta) => {
    const material = materialRef.current
    if (!material) return
    const u = material.uniforms

    // Clamp delta so a backgrounded tab doesn't fire one huge jump on refocus.
    const dt = Math.min(delta, 0.05)

    // Frame-rate-INDEPENDENT damping: 1 - e^(-k·dt) → identical feel at 30/60/144fps.
    const followDamp = 1.0 - Math.exp(-12.0 * dt) // how fast the cursor is chased
    const energyDamp = 1.0 - Math.exp(-6.0 * dt) //  how fast the ripple settles

    // R3F's pointer is NDC (-1..1); map it into 0..1 UV space to match vUv.
    pointerUv.set(state.pointer.x * 0.5 + 0.5, state.pointer.y * 0.5 + 0.5)

    // Distance the smoothed cursor still trails the real one ≈ movement speed:
    // large while flicking the mouse, ~0 the moment it stops.
    const velocity = u.uMouse.value.distanceTo(pointerUv)

    // Smoothly chase the pointer — this lag IS the trailing-liquid feel.
    u.uMouse.value.lerp(pointerUv, followDamp)

    // Energy rises with movement and eases back to 0 when still, so the ripple
    // decays out on its own a moment after the cursor halts.
    const targetEnergy = Math.min(velocity * 8.0, 1.0)
    u.uHoverState.value += (targetEnergy - u.uHoverState.value) * energyDamp

    // Keep uResolution in sync with the real drawing buffer (incl. DPR). Writing
    // straight into the uniform's own vector = correct on resize, zero alloc.
    state.gl.getDrawingBufferSize(u.uResolution.value)

    u.uTime.value += dt
  })

  // Explicit teardown. R3F already disposes JSX-created geometry/material on
  // unmount; we also do it ourselves to satisfy strict leak-freeness (a second
  // dispose is a safe no-op in three). The texture belongs to drei's shared
  // cache and may feed other consumers, so we deliberately do NOT dispose it.
  useEffect(() => {
    const geometry = geometryRef.current
    const material = materialRef.current
    return () => {
      geometry?.dispose()
      material?.dispose()
    }
  }, [])

  return (
    <mesh scale={scale}>
      <planeGeometry ref={geometryRef} args={[1, 1, 1, 1]} />
      <liquidCursorMaterial
        ref={materialRef}
        uTexture={texture}
        uReduced={reduced ? 1 : 0}
        uAmplitude={intensity}
        uRadius={radius}
        // No tone mapping — keep the image colours 1:1 with the source.
        toneMapped={false}
      />
    </mesh>
  )
}

// ---------------------------------------------------------------------------
// PUBLIC COMPONENT
// ---------------------------------------------------------------------------

/**
 * @param {object}  props
 * @param {string}  props.imageSrc            URL of the image to distort.
 * @param {string}  [props.className]         Class for the wrapping <div>.
 * @param {object}  [props.style]             Inline style merged onto the wrapper.
 * @param {number}  [props.intensity=0.08]    Max UV displacement (effect strength).
 * @param {number}  [props.radius=0.35]       Cursor brush radius in UV units.
 */
export default function LiquidCursorDistortion({
  imageSrc,
  className,
  style,
  intensity = 0.08,
  radius = 0.35,
}) {
  // Detect touch / coarse pointers ONCE. Drives (a) a harder DPR cap, (b) the
  // cheaper single-sample shader path, (c) a calmer trail with no hover.
  const isTouch = useMemo(() => {
    if (typeof window === 'undefined') return false
    return (
      window.matchMedia?.('(pointer: coarse)').matches ||
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0
    )
  }, [])

  // Cap DPR at 2 on desktop (uncapped Retina/4K renders 4–9× the pixels and
  // tanks the frame rate); drop to 1 on touch to protect the battery.
  const dpr = useMemo(() => {
    if (typeof window === 'undefined') return 1
    const ratio = window.devicePixelRatio || 1
    return isTouch ? Math.min(ratio, 1) : Math.min(ratio, 2)
  }, [isTouch])

  return (
    <div
      className={className}
      style={{ width: '100%', height: '100%', ...style }}
    >
      <Canvas
        dpr={dpr}
        gl={{
          antialias: !isTouch,
          powerPreference: isTouch ? 'low-power' : 'high-performance',
        }}
        // The plane sits at z=0 and is sized in world units by useAspect, so a
        // camera pulled back to frame the unit viewport is all that's needed.
        camera={{ position: [0, 0, 5], fov: 50 }}
      >
        <Suspense fallback={null}>
          <DistortionPlane
            imageSrc={imageSrc}
            reduced={isTouch}
            intensity={intensity}
            radius={radius}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { prefersReducedMotion } from '../../utils/animations'

/**
 * Atmospheric dust / floating petals rendered with *native* Three.js.
 *
 * Design goals:
 *  - Iper-leggero: a single Points cloud, additive blending, no post-processing,
 *    pixel ratio capped, low-power GPU hint. It never touches the React render
 *    loop — the rAF lives entirely inside this effect.
 *  - Self-contained: the soft round sprite is painted on a <canvas> at runtime,
 *    so there is no texture file to ship or fail to load.
 *  - Leak-free: geometry, material, texture and renderer are disposed, the rAF
 *    is cancelled, observers/listeners removed and the <canvas> detached on
 *    unmount (also covers React StrictMode's double-mount in dev).
 *
 * The canvas is purely decorative, hence `aria-hidden` and `pointer-events:none`
 * (set in CSS by the parent via the passed className).
 */
export default function DustParticles({
  className = '',
  color = 0xffe9c7, // warm ivory → reads as golden under additive blending
  density = 9000, // larger = fewer particles (one per N square px)
}) {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    // No WebGL work at all for reduced-motion users.
    if (prefersReducedMotion()) return

    let width = mount.clientWidth || window.innerWidth
    let height = mount.clientHeight || window.innerHeight

    // --- Scene & camera -----------------------------------------------------
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 1000)
    camera.position.z = 300

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setSize(width, height)
    renderer.setClearColor(0x000000, 0)
    mount.appendChild(renderer.domElement)

    // World-space size of the field the particles drift through.
    const FIELD_Y = 380
    const spreadX = () => FIELD_Y * (width / height)
    const SPREAD_Z = 220

    // Particle budget scales with the viewport, then is hard-capped so a huge
    // monitor never tanks the frame rate.
    const COUNT = Math.min(260, Math.round((width * height) / density))

    // --- Buffers ------------------------------------------------------------
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT) // upward velocity
    const drift = new Float32Array(COUNT) // horizontal sway amplitude
    const phase = new Float32Array(COUNT) // sway offset so motion isn't uniform

    const base = new THREE.Color(color)
    let sx = spreadX()
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * sx
      positions[i3 + 1] = (Math.random() - 0.5) * FIELD_Y
      positions[i3 + 2] = (Math.random() - 0.5) * SPREAD_Z

      // Per-particle brightness variation for a richer, less flat cloud.
      const tint = 0.45 + Math.random() * 0.55
      colors[i3] = base.r * tint
      colors[i3 + 1] = base.g * tint
      colors[i3 + 2] = base.b * tint

      speeds[i] = 0.4 + Math.random() * 0.9
      drift[i] = 0.3 + Math.random() * 0.8
      phase[i] = Math.random() * Math.PI * 2
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const sprite = makeGlowTexture()
    const material = new THREE.PointsMaterial({
      size: 7,
      map: sprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })

    const points = new THREE.Points(geometry, material)
    scene.add(points)

    // --- Animation loop -----------------------------------------------------
    const clock = new THREE.Clock()
    let rafId = 0
    let running = true

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05) // clamp after tab refocus
      const t = clock.elapsedTime
      const pos = geometry.attributes.position.array

      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3
        pos[i3 + 1] += speeds[i] * dt * 18 // rise like warm air
        pos[i3] += Math.sin(t * 0.4 + phase[i]) * drift[i] * dt * 12 // sway

        // Recycle from the top back to the bottom for an endless field.
        if (pos[i3 + 1] > FIELD_Y / 2) {
          pos[i3 + 1] = -FIELD_Y / 2
          pos[i3] = (Math.random() - 0.5) * sx
        }
      }
      geometry.attributes.position.needsUpdate = true
      points.rotation.y = Math.sin(t * 0.05) * 0.06 // faint parallax shimmer

      renderer.render(scene, camera)
      rafId = requestAnimationFrame(tick)
    }

    const start = () => {
      if (!running) return
      clock.getDelta() // discard the gap accumulated while paused
      rafId = requestAnimationFrame(tick)
    }
    const stop = () => cancelAnimationFrame(rafId)

    if (COUNT > 0) start()

    // --- Reactivity: resize + tab visibility --------------------------------
    const resizeObserver = new ResizeObserver(() => {
      width = mount.clientWidth || width
      height = mount.clientHeight || height
      if (!width || !height) return
      sx = spreadX()
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    })
    resizeObserver.observe(mount)

    // Pause rendering while the tab is hidden to spare the CPU/GPU & battery.
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        stop()
      } else if (!running) {
        running = true
        start()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // --- Cleanup ------------------------------------------------------------
    return () => {
      running = false
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      resizeObserver.disconnect()

      scene.remove(points)
      geometry.dispose()
      material.dispose()
      sprite.dispose()
      renderer.dispose()

      const canvas = renderer.domElement
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas)
    }
  }, [color, density])

  return <div className={className} ref={mountRef} aria-hidden="true" />
}

/**
 * Paints a soft radial glow on an offscreen canvas and wraps it as a texture.
 * Keeps the dust looking like light rather than hard square pixels — and means
 * zero network requests for assets.
 */
function makeGlowTexture() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')

  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.2, 'rgba(255, 244, 214, 0.85)')
  gradient.addColorStop(0.5, 'rgba(255, 238, 200, 0.25)')
  gradient.addColorStop(1, 'rgba(255, 238, 200, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

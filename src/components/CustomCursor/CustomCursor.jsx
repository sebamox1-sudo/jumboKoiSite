import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import './CustomCursor.css'

gsap.registerPlugin(useGSAP)

// How much the ring blooms over an interactive target.
const HOVER_SCALE = 1.5

// What counts as "clickable". Anchors and buttons are covered natively; any other
// element can opt in with data-cursor="hover" (e.g. a custom card or media tile).
// role="button" is included so ARIA buttons read the same as real <button>s.
const HOVER_SELECTOR = 'a, button, [role="button"], [data-cursor="hover"]'

/**
 * CursorCore — the actual cursor. Only ever mounted on fine-pointer devices, so
 * every hook below is allowed to assume a real mouse exists.
 *
 * Architecture (zero React re-renders on move)
 * --------------------------------------------
 * Two layers — a tiny solid dot (the true pointer) and a larger trailing ring
 * (the silk aura). The mouse position NEVER touches React state. On `mousemove`
 * we call GSAP `quickTo` setters that write straight to each node's GPU transform,
 * so the whole thing rides the compositor at the display's native refresh rate.
 *
 * The dot is tuned near-instant; the ring trails with a longer eased follow, which
 * is what reads as "liquid". A single `quickTo` owns each animatable property
 * (x, y, scale, opacity) per node, so the hover and window enter/leave states route
 * their targets through the same setter and can never spawn competing tweens.
 *
 * All GSAP work lives inside `useGSAP`; on unmount its context reverts (killing
 * every quickTo tween) and the returned cleanup detaches the listeners — leak-free.
 */
function CursorCore() {
  const dotRef = useRef(null)
  const ringRef = useRef(null)

  useGSAP(
    () => {
      const dot = dotRef.current
      const ring = ringRef.current

      // Anchor each layer on its own centre so x/y point at the middle, not the
      // top-left corner. Born invisible: no stray cursor parked at 0,0.
      gsap.set([dot, ring], { xPercent: -50, yPercent: -50, opacity: 0 })

      // The only setters touched on every frame. Dot ≈ instant, ring = trailing silk.
      const xDot = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' })
      const yDot = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' })
      const xRing = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' })
      const yRing = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' })

      // State-driven setters — reused so each property has exactly one live tween.
      const scaleDot = gsap.quickTo(dot, 'scale', { duration: 0.45, ease: 'power3' })
      const scaleRing = gsap.quickTo(ring, 'scale', { duration: 0.45, ease: 'power3' })
      const fadeDot = gsap.quickTo(dot, 'opacity', { duration: 0.4, ease: 'power2' })
      const fadeRing = gsap.quickTo(ring, 'opacity', { duration: 0.4, ease: 'power2' })

      const state = { hovering: false, inside: false, seen: false }

      // Single source of truth: translate the current state into the two layers.
      const render = () => {
        const visible = state.inside && state.seen
        fadeDot(visible ? 1 : 0)
        fadeRing(visible ? 1 : 0)
        // Dot shrinks to nothing when the cursor is away; the ring blooms on hover.
        scaleDot(visible ? 1 : 0)
        scaleRing(!visible ? 0 : state.hovering ? HOVER_SCALE : 1)
        // The frosted/blurred fill is appearance only, so CSS owns it.
        ring.classList.toggle('cursor__ring--hover', visible && state.hovering)
      }

      // --- Movement -----------------------------------------------------------
      const onMove = (e) => {
        if (!state.seen) {
          // First sighting: snap into place (no slide in from the corner), reveal.
          state.seen = true
          state.inside = true
          gsap.set([dot, ring], { x: e.clientX, y: e.clientY })
          render()
        }
        xDot(e.clientX)
        yDot(e.clientY)
        xRing(e.clientX)
        yRing(e.clientY)
      }

      // --- Contextual hover (event delegation, survives dynamic content) -------
      const onOver = (e) => {
        if (e.target.closest(HOVER_SELECTOR) && !state.hovering) {
          state.hovering = true
          render()
        }
      }
      const onOut = (e) => {
        if (!e.target.closest(HOVER_SELECTOR) || !state.hovering) return
        // Stay engaged while gliding between children of the same interactive
        // element (or straight onto another one); only release into "dead" space.
        const to = e.relatedTarget
        if (to && to.closest && to.closest(HOVER_SELECTOR)) return
        state.hovering = false
        render()
      }

      // --- Leaving / re-entering the browser window ---------------------------
      const onWindowLeave = () => {
        state.inside = false
        render()
      }
      const onWindowEnter = (e) => {
        state.inside = true
        state.seen = true
        gsap.set([dot, ring], { x: e.clientX, y: e.clientY })
        render()
      }

      window.addEventListener('mousemove', onMove)
      document.addEventListener('mouseover', onOver)
      document.addEventListener('mouseout', onOut)
      document.addEventListener('mouseleave', onWindowLeave)
      document.addEventListener('mouseenter', onWindowEnter)

      // useGSAP reverts the GSAP context (killing the quickTo tweens) on unmount;
      // we only need to detach the DOM listeners ourselves.
      return () => {
        window.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseover', onOver)
        document.removeEventListener('mouseout', onOut)
        document.removeEventListener('mouseleave', onWindowLeave)
        document.removeEventListener('mouseenter', onWindowEnter)
      }
    },
    { scope: ringRef },
  )

  return (
    <>
      <div className="cursor__ring" ref={ringRef} aria-hidden="true" />
      <div className="cursor__dot" ref={dotRef} aria-hidden="true" />
    </>
  )
}

/**
 * CustomCursor — public entry point.
 *
 * Touch / coarse-pointer devices render NOTHING (a faux cursor there is pure UX
 * debt: no pointer to track, ghost taps, stuck states). The check sits above any
 * hook, and the outer component holds no hooks of its own, so this early return is
 * fully rules-of-hooks safe.
 */
export default function CustomCursor() {
  const isFinePointer =
    typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches

  if (!isFinePointer) return null

  return <CursorCore />
}

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { prefersReducedMotion } from '../utils/animations'
import { TransitionContext } from './transitionContext'
import './transitions.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * TransitionProvider — the centralized "sink into the void" page-transition engine.
 *
 * WHY THIS LIVES AT THE ROOT
 * --------------------------
 * Two things have to be owned in ONE place for the cinematic route change to work:
 *
 *   1. The Lenis smooth-scroll instance. The exit has to *freeze* scrolling
 *      (`lenis.stop()`) the instant the button is clicked and *thaw* it
 *      (`lenis.start()`) only once the new page has emerged. Lenis therefore can't
 *      hide inside App's effect any more — it's lifted here and shared.
 *   2. The fixed "void" overlay (#0a0908). A single element, mounted once above
 *      every route, that darkens + blurs the outgoing page and then dissolves to
 *      reveal the incoming one. Because it never unmounts, the fade-in (exit) and
 *      the fade-out (entrance) are two halves of one continuous gesture.
 *
 * THE GESTURE (full motion)
 * -------------------------
 *   click → lenis.stop() → overlay autoAlpha 0▸1, scale 1.08▸1, backdrop-blur
 *   0▸10px (the live page genuinely sinks away behind the closing dark) → on
 *   complete, navigate() swaps the route → the route-change effect resets scroll,
 *   refreshes ScrollTrigger, then fades the overlay 1▸0 while the new page plays
 *   its own entrance → lenis.start().
 *
 * WHY BLUR VIA `backdrop-filter`, NOT `transform: scale` ON THE PAGE
 * -----------------------------------------------------------------
 * The button sits at the end of the Collection's *pinned* horizontal scroll, so at
 * click time the Collection is `position: fixed` (ScrollTrigger pin). Putting a
 * `transform` on any ancestor of a fixed element re-bases that fixed element to the
 * transformed box and yanks it across the screen — a hard, ugly jump. So the blur
 * and darkening are painted by the FIXED overlay itself (`backdrop-filter` reads
 * the live page with zero transform on it), and the "sink" depth comes from the
 * overlay scaling inward. Result: the spec's blur(10px) + fade-to-void, flawlessly
 * jump-free regardless of which pinned section the visitor launches from.
 *
 * ACCESSIBILITY
 * -------------
 * `prefers-reduced-motion` skips the freeze, the overlay and the delay entirely and
 * navigates instantly. Touch devices (no Lenis) are scroll-locked for the ~0.8s of
 * the gesture via an `is-transitioning` class instead.
 */

// One timing language for the whole gesture (seconds).
const EXIT = 0.72 // page sinks into the void
const ENTER = 0.86 // void dissolves, page emerges
const MAX_BLUR = 10 // px — matches the brief's blur(10px)

export function TransitionProvider({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const lenisRef = useRef(null)
  const overlayRef = useRef(null)

  // True from the moment the exit starts until the entrance has fully resolved.
  // Guards against double-clicks spawning two overlapping timelines, and tells the
  // route-change effect that it owns the "fade the void back out" half.
  const busyRef = useRef(false)
  // The live exit/entrance timeline, so we can kill it cleanly on unmount.
  const tlRef = useRef(null)

  // --- Smooth scrolling (Lenis ⇄ GSAP ticker ⇄ ScrollTrigger) ----------------
  // Lifted verbatim from App so the instance can be shared with the transition.
  // Same guards: native scroll under reduced-motion and on touch/phones.
  useEffect(() => {
    if (prefersReducedMotion()) return

    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        window.innerWidth < 768)
    if (isTouch) return

    const lenis = new Lenis({
      anchors: {
        offset: 0,
        duration: 1.6,
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      },
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    const tick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  // Animate the overlay's backdrop blur through a proxy object: GSAP can't tween
  // the string `blur(Npx)` reliably across browsers, but it can tween a number and
  // write the filter every frame. One helper, reused by exit (0▸10) and entrance.
  const tweenBlur = useCallback((from, to, vars) => {
    const overlay = overlayRef.current
    const proxy = { v: from }
    return gsap.to(proxy, {
      v: to,
      ...vars,
      onUpdate: () => {
        const blur = `blur(${proxy.v}px)`
        overlay.style.backdropFilter = blur
        overlay.style.webkitBackdropFilter = blur
      },
    })
  }, [])

  // --- The public API: navigate, but sink into the void first ----------------
  const navigateWithTransition = useCallback(
    (to) => {
      if (!to || to === location.pathname) return

      // Reduced motion: no freeze, no overlay, no delay — just go.
      if (prefersReducedMotion()) {
        navigate(to)
        return
      }

      // A gesture is already mid-flight — ignore the second click.
      if (busyRef.current) return
      busyRef.current = true

      // Freeze the world. Desktop: stop Lenis. Touch (no Lenis): CSS scroll-lock.
      lenisRef.current?.stop()
      document.documentElement.classList.add('is-transitioning')

      const overlay = overlayRef.current
      tlRef.current?.kill()

      // EXIT — the page sinks away behind the closing dark void.
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        onComplete: () => navigate(to), // route swaps only when fully dark
      })
      tl.set(overlay, {
        // The void closes IN from slightly oversized — depth, not a flat fade.
        scale: 1.08,
        transformOrigin: '50% 50%',
        pointerEvents: 'auto',
      })
        .to(overlay, { autoAlpha: 1, scale: 1, duration: EXIT }, 0)
        .add(tweenBlur(0, MAX_BLUR, { duration: EXIT, ease: 'power2.inOut' }), 0)

      tlRef.current = tl
    },
    [location.pathname, navigate, tweenBlur],
  )

  // --- Route change: reset scroll, re-measure, and emerge from the void ------
  // A plain layout effect (NOT useGSAP) on purpose: useGSAP reverts its context
  // when the dep changes, which would claw back the overlay's autoAlpha that the
  // exit timeline just set and blink the void off the instant the route swaps.
  // Here the timelines are owned manually (tlRef) and killed by hand, so nothing
  // reverts mid-gesture. Runs after the incoming page mounts (its ScrollTriggers
  // already exist — child layout effects fire before this parent one), before paint.
  useLayoutEffect(
    () => {
      const lenis = lenisRef.current
      const overlay = overlayRef.current

      // Always land at the top of the new page, never mid-scroll. `force` lets the
      // reset land even while Lenis is stopped from the exit.
      lenis?.scrollTo(0, { immediate: true, force: true })
      window.scrollTo(0, 0)

      // Let the new DOM commit a frame, then re-measure every pinned/scrubbed
      // section for the page we just landed on.
      const raf = requestAnimationFrame(() => ScrollTrigger.refresh())

      if (busyRef.current) {
        // ENTRANCE — dissolve the void to reveal the page emerging beneath it.
        tlRef.current?.kill()
        const tl = gsap.timeline({
          onComplete: () => {
            overlay.style.pointerEvents = 'none'
            overlay.style.backdropFilter = 'blur(0px)'
            overlay.style.webkitBackdropFilter = 'blur(0px)'
            document.documentElement.classList.remove('is-transitioning')
            lenis?.start()
            busyRef.current = false
          },
        })
        tl.to(overlay, { autoAlpha: 0, duration: ENTER, ease: 'power2.out' }, 0)
          .add(tweenBlur(MAX_BLUR, 0, { duration: ENTER, ease: 'power2.out' }), 0)
        tlRef.current = tl
      } else {
        // Fresh load / deep-link: the void was never raised. Make sure it's down.
        gsap.set(overlay, { autoAlpha: 0, pointerEvents: 'none' })
      }

      return () => cancelAnimationFrame(raf)
    },
    [location.pathname, tweenBlur],
  )

  // Kill any in-flight timeline if the whole app tears down.
  useEffect(() => () => tlRef.current?.kill(), [])

  return (
    <TransitionContext.Provider value={{ navigate: navigateWithTransition }}>
      {children}
      <div className="transition-void" ref={overlayRef} aria-hidden="true" />
    </TransitionContext.Provider>
  )
}

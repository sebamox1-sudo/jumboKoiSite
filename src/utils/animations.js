import gsap from 'gsap'

/**
 * Reusable GSAP logic for the jumboKoi experience.
 *
 * The philosophy here is "water, not clicks": every easing is long and soft so
 * nothing ever snaps. We expose small, composable helpers instead of one giant
 * timeline so each section of the site can sequence reveals in its own way.
 *
 * All tweens are created *inside* a `useGSAP()` scope on the consumer side, so
 * cleanup (revert) is handled automatically by @gsap/react. These helpers never
 * attach global listeners, which keeps them leak-free by construction.
 */

// Signature easings — kept in one place so the whole site breathes the same way.
export const EASE = {
  reveal: 'expo.out', // masked text sliding into view
  soft: 'power4.out', // opacity / position settles
  drift: 'sine.inOut', // slow, tidal, infinite loops
}

/**
 * Infinite, almost-imperceptible "Ken Burns" zoom.
 * Applied to the photographic background layer so the page feels alive even
 * when the visitor is perfectly still. yoyo + repeat:-1 means it never resets
 * with a jump — it simply breathes in and out forever.
 */
export function kenBurns(target, vars = {}) {
  return gsap.to(target, {
    scale: 1.2,
    xPercent: -2,
    yPercent: -2,
    duration: 30,
    ease: EASE.drift,
    repeat: -1,
    yoyo: true,
    ...vars,
  })
}

/**
 * Masked "slide up" reveal. Each target is expected to live inside an
 * `overflow: hidden` mask, so translating it from 120% to 0% wipes it into
 * view from below — the classic editorial reveal.
 *
 * Adds to a provided timeline (rather than returning a standalone tween) so the
 * caller controls sequencing with position parameters.
 */
export function addMaskReveal(tl, targets, vars = {}, position) {
  return tl.fromTo(
    targets,
    { yPercent: 120 },
    {
      yPercent: 0,
      duration: 1.8,
      ease: EASE.reveal,
      stagger: 0.1,
      ...vars,
    },
    position,
  )
}

/**
 * Gentle fade + rise for secondary UI (eyebrow, scroll cue, header).
 * Softer and shorter than the headline reveal so it never competes with it.
 */
export function addFadeRise(tl, targets, vars = {}, position) {
  return tl.fromTo(
    targets,
    { autoAlpha: 0, y: 24 },
    {
      autoAlpha: 1,
      y: 0,
      duration: 1.4,
      ease: EASE.soft,
      stagger: 0.1,
      ...vars,
    },
    position,
  )
}

/** Respect visitors who asked the OS to reduce motion. */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

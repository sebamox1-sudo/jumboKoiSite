import { useRef, useMemo } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import './Preloader.css'

gsap.registerPlugin(useGSAP)

/* ── SVG canvas ────────────────────────────────────────────────────────── *
 *  200 × 480 gives a tall, vertical proportion that mirrors traditional
 *  Japanese tategaki (top-to-bottom) writing and the columnar format of
 *  a hanging scroll (kakemono).
 * ─────────────────────────────────────────────────────────────────────── */
const W = 200
const H = 480

/**
 * Preloader — "Sipario" (curtain), Zen & Water edition.
 *
 * A dark void with vertical Kanji (錦鯉 — Nishikigoi) that slowly
 * materialises from bottom to top as assets load — like sumi ink soaking
 * upward into washi paper, or dark water rising in a Kyoto garden pond.
 * Warm fog drifts silently through the background.
 *
 * When loading completes the calligraphy blooms outward and dissolves into
 * blur, like a single drop of ink dispersing in still water — the moment
 * of *satori* before the site reveals itself.
 *
 * ── Prop contract (unchanged) ────────────────────────────────────────── *
 * @param {number}     progress     Real load fraction, 0 → 1.
 * @param {boolean}    isComplete   Assets ready (or timed out) — begin exit.
 * @param {number}     failedCount  Failed asset count (on-screen debug).
 * @param {() => void} onExited     Fire when the exit animation has finished.
 */
export default function Preloader({
  progress = 0,
  isComplete = false,
  failedCount = 0,
  onExited,
}) {
  /* ── Refs ──────────────────────────────────────────────────────────── */
  const root = useRef(null)
  const markRef = useRef(null)
  const maskRectRef = useRef(null)
  const breathRef = useRef(null)
  const reducedMotion = useRef(false)

  /* Unique SVG IDs per mount — safe in StrictMode & concurrent rendering. */
  const uid = useMemo(() => Math.random().toString(36).slice(2, 10), [])
  const filterId = `sumi-edge-${uid}`
  const maskId = `sumi-mask-${uid}`

  /* ── 0 · Reduced-motion gate ────────────────────────────────────────── *
   *  Checked once on mount.  If the user prefers reduced motion we skip
   *  every animation: the Kanji is revealed instantly and the component
   *  exits the moment `isComplete` flips, with no timelines to fight.
   * ──────────────────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      reducedMotion.current =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches

      if (reducedMotion.current) {
        gsap.set(maskRectRef.current, { attr: { y: 0, height: H } })
      }
    },
    { scope: root },
  )

  /* ── 1 · Breathing — a meditative pulse while we wait ───────────────── *
   *  The mark gently swells and recedes like a slow breath, keeping the
   *  curtain feeling alive rather than frozen.  Killed the instant the
   *  exit sequence begins so it can never fight the bloom.
   * ──────────────────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      if (reducedMotion.current) return

      breathRef.current = gsap.to(markRef.current, {
        scale: 1.025,
        duration: 3.4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        transformOrigin: 'center 55%',
      })
    },
    { scope: root },
  )

  /* ── 2 · Progress → ink / water mask reveal (bottom → top) ──────────── *
   *  The mask rect's y and height are tweened toward each new progress
   *  value so the ring of ink *glides* upward (assets often arrive in
   *  bursts) instead of snapping.
   * ──────────────────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      if (reducedMotion.current) return

      const p = Math.min(progress, 1)
      gsap.to(maskRectRef.current, {
        attr: {
          y: H * (1 - p),
          height: Math.max(H * p, 0.5), // ≥ 0.5 avoids zero-height blink
        },
        duration: 0.8,
        ease: 'power2.out',
        overwrite: 'auto',
      })
    },
    { dependencies: [progress], scope: root },
  )

  /* ── 3 · Exit — "The Awakening" ─────────────────────────────────────── *
   *  1. Finish any remaining ink reveal.                              *
   *  2. A breath of stillness — the moment before the drop breaks.    *
   *  3. Bloom: scale + blur — ink disperses into the void.            *
   *  4. The ground itself dissolves, revealing the hero beneath.       *
   *                                                              → onExited
   * ──────────────────────────────────────────────────────────────────── */
  useGSAP(
    () => {
      if (!isComplete) return

      /* Reduced motion: vanish instantly and hand back. */
      if (reducedMotion.current) {
        gsap.set(root.current, { autoAlpha: 0 })
        onExited?.()
        return
      }

      /* Kill breathing so it never fights the exit. */
      breathRef.current?.kill()

      const tl = gsap.timeline({
        defaults: { ease: 'expo.inOut' },
        onComplete: () => onExited?.(),
      })

      /* Finish any remaining ink reveal */
      tl.to(maskRectRef.current, {
        attr: { y: 0, height: H },
        duration: 0.45,
        ease: 'power2.out',
      })

      /* A breath of stillness — the circle closes */
      .to({}, { duration: 0.2 })

      /* Bloom: the calligraphy disperses like a drop of ink in water */
      .to(
        markRef.current,
        {
          scale: 5,
          filter: 'blur(40px) brightness(1.4)',
          autoAlpha: 0,
          duration: 1.5,
          transformOrigin: 'center 55%',
        },
        '-=0.05',
      )

      /* The void itself dissolves, revealing the site beneath */
      .to(root.current, { autoAlpha: 0, duration: 1.0 }, '<0.35')
    },
    { dependencies: [isComplete], scope: root },
  )

  /* ── Render ────────────────────────────────────────────────────────── */
  return (
    <div
      className="preloader"
      ref={root}
      role="status"
      aria-live="polite"
      aria-label="Caricamento"
    >
      {/* ── Atmosphere: warm fog drifting through the void ──────────── */}
      <div className="preloader__fog preloader__fog--a" aria-hidden="true" />
      <div className="preloader__fog preloader__fog--b" aria-hidden="true" />
      <div className="preloader__fog preloader__fog--c" aria-hidden="true" />

      {/* ── Central calligraphy mark ────────────────────────────────── */}
      <div className="preloader__mark" ref={markRef}>
        <svg
          className="preloader__svg"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            {/* ── Sumi-bleed filter ─────────────────────────────────── *
             *  Warps the mask edge with fractal noise so it reads as
             *  ink fibres soaking into washi paper rather than a hard
             *  geometric line.  scale=14 gives visible but not extreme
             *  organic distortion.
             * ─────────────────────────────────────────────────────── */}
            <filter
              id={filterId}
              x="-20%"
              y="-5%"
              width="140%"
              height="110%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.025 0.05"
                numOctaves={3}
                seed={7}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={14}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>

            {/* ── Water-ink mask ───────────────────────────────────── *
             *  White = visible, black = hidden.  The white rect grows
             *  upward from the bottom as assets load.  Its top edge is
             *  distorted by the sumi-bleed filter above, creating the
             *  organic ink-soak effect.
             *
             *  Width is 3× the canvas and shifted left by 1× so the
             *  feDisplacementMap only noticeably warps the *top*
             *  edge (the waterline) — the sides are safely clipped by
             *  the SVG viewport.
             * ─────────────────────────────────────────────────────── */}
            <mask id={maskId}>
              {/* Everything concealed by default */}
              <rect x="0" y="0" width={W} height={H} fill="black" />
              {/* Visible region — grows upward from the bottom */}
              <rect
                ref={maskRectRef}
                x={-W}
                y={H}
                width={W * 3}
                height={0}
                fill="white"
                filter={`url(#${filterId})`}
              />
            </mask>
          </defs>

          {/* ── Sumi-e brush accent ────────────────────────────────── *
           *  A single, quiet horizontal stroke beneath the Kanji —
           *  like the artist's seal or a stray ink wash, grounding the
           *  composition the way a signature grounds a hanging scroll.
           * ───────────────────────────────────────────────────────── */}
          <path
            className="preloader__brush"
            d="M42 432 Q72 425 100 428 T158 426"
            mask={`url(#${maskId})`}
          />

          {/* ── 錦 (Nishiki — brocade / ornamental) ───────────────── */}
          <text
            className="preloader__kanji"
            x={W / 2}
            y={178}
            textAnchor="middle"
            dominantBaseline="central"
            mask={`url(#${maskId})`}
          >
            錦
          </text>

          {/* ── 鯉 (Koi — the living jewel) ───────────────────────── */}
          <text
            className="preloader__kanji"
            x={W / 2}
            y={340}
            textAnchor="middle"
            dominantBaseline="central"
            mask={`url(#${maskId})`}
          >
            鯉
          </text>
        </svg>
      </div>

      {/* ── Debug readout ──────────────────────────────────────────── *
       *  Fades into the dark like a whisper; visible on close inspection
       *  but never intrudes on the zen composition.  Remove once the
       *  boot sequence is confirmed stable in production.
       * ───────────────────────────────────────────────────────────── */}
      <div className="preloader__debug" aria-hidden="true">
        {Math.round(Math.min(progress, 1) * 100)}%
        {failedCount > 0 && (
          <span className="preloader__debug-warn">
            {' '}· ⚠ {failedCount} asset mancante/i (caricamento fallito)
          </span>
        )}
      </div>
    </div>
  )
}
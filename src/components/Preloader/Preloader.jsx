import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import './Preloader.css'

gsap.registerPlugin(useGSAP)

// SVG geometry. A single thin ring, drawn from the top, that "inks" itself in as
// the real assets load. r and the viewBox are paired so the stroke never clips.
const SIZE = 160
const R = 70
const CIRCUMFERENCE = 2 * Math.PI * R

/**
 * Preloader — the silent "sipario" (curtain).
 *
 * A near-black ground with one minimalist gold ring (an Enso / rising-sun nod)
 * that delineates itself like ink on the void as the heavy assets load. There
 * are no cold percentages — only the slow, calming closure of the circle.
 *
 * Ownership split: App owns the *loading* (it warms the assets and reports real
 * `progress`); this component owns only the *visual* — translating progress into
 * the arc, and, once `isComplete` flips true, playing the exit (the ring closes,
 * blooms outward and dissolves) before signalling `onExited` so App can unmount it.
 *
 * @param {object}   props
 * @param {number}   props.progress     Real load fraction, 0 → 1.
 * @param {boolean}  props.isComplete   Assets ready (or timed out) — start the exit.
 * @param {number}   props.failedCount  How many assets failed (for on-screen debug).
 * @param {() => void} props.onExited   Called when the exit animation has finished.
 */
export default function Preloader({ progress = 0, isComplete = false, failedCount = 0, onExited }) {
  const root = useRef(null)
  const markRef = useRef(null)
  const arcRef = useRef(null)
  const breathRef = useRef(null)

  // Gentle breathing while we wait — the curtain feels alive, not frozen.
  // Created once; killed at the start of the exit so it never fights the bloom.
  useGSAP(
    () => {
      breathRef.current = gsap.to(markRef.current, {
        scale: 1.04,
        duration: 2.6,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
        transformOrigin: 'center center',
      })
    },
    { scope: root },
  )

  // Drive the arc from REAL progress. We tween toward each new target so the ring
  // glides closed (assets settle in bursts) instead of snapping between values.
  useGSAP(
    () => {
      gsap.to(arcRef.current, {
        strokeDashoffset: CIRCUMFERENCE * (1 - Math.min(progress, 1)),
        duration: 0.6,
        ease: 'power2.out',
        overwrite: 'auto',
      })
    },
    { dependencies: [progress], scope: root },
  )

  // Exit: close the ring, bloom it outward, dissolve the ground, then hand back.
  useGSAP(
    () => {
      if (!isComplete) return

      breathRef.current?.kill()

      const tl = gsap.timeline({
        defaults: { ease: 'power3.inOut' },
        onComplete: () => onExited?.(),
      })

      tl.to(arcRef.current, {
        strokeDashoffset: 0,
        duration: 0.45,
        ease: 'power2.out',
        overwrite: 'auto',
      })
        .to(
          markRef.current,
          { scale: 1.5, autoAlpha: 0, duration: 0.9, transformOrigin: 'center center' },
          '-=0.05',
        )
        .to(root.current, { autoAlpha: 0, duration: 0.8 }, '<0.25')
    },
    { dependencies: [isComplete], scope: root },
  )

  return (
    <div className="preloader" ref={root} role="status" aria-live="polite" aria-label="Caricamento">
      <div className="preloader__mark" ref={markRef}>
        <svg
          className="preloader__ring"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          aria-hidden="true"
        >
          {/* Faint guide — the void on which the gold ink delineates. */}
          <circle
            className="preloader__track"
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
          />
          {/* The progress arc: starts fully "empty" (offset = full circumference)
              and closes toward 0 as real assets load. Rotated -90° (CSS) so it
              draws from the top like a rising sun. */}
          <circle
            className="preloader__arc"
            ref={arcRef}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>
      </div>

      {/* TEMP / DEBUG — on-screen failure readout so issues are visible on mobile
          without attaching a remote console. Remove once the boot is confirmed
          stable in production. Shows live progress + any failed assets. */}
      <div
        style={{
          position: 'fixed',
          bottom: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '11px',
          fontFamily: 'monospace',
          letterSpacing: '0.04em',
          color: failedCount > 0 ? '#ff6b6b' : 'rgba(255,255,255,0.45)',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        {Math.round(Math.min(progress, 1) * 100)}%
        {failedCount > 0 && (
          <span> · ⚠ {failedCount} asset mancante/i (caricamento fallito)</span>
        )}
      </div>
    </div>
  )
}

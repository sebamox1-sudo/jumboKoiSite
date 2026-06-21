import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../../utils/animations'
import './BezelButton.css'

gsap.registerPlugin(useGSAP)

/**
 * Ultra-light line glyphs (Phosphor/Remix-tier hairlines, never thick Lucide).
 * `currentColor` + a 1.25 stroke so they read as drawn, not iconographic.
 */
const ICONS = {
  'up-right': (
    <>
      <path d="M8 16 16 8" />
      <path d="M9 8h7v7" />
    </>
  ),
  left: (
    <>
      <path d="M18 12H7" />
      <path d="m11 7-5 5 5 5" />
    </>
  ),
  right: (
    <>
      <path d="M6 12h11" />
      <path d="m13 7 5 5-5 5" />
    </>
  ),
}

/**
 * BezelButton — the house "machined hardware" CTA.
 *
 * Implements the two haptic patterns from the design system:
 *   • DOUBLE-BEZEL (Doppelrand): an outer shell (subtle ground + hairline ring +
 *     padding + full radius) cradling a distinct inner core (its own ground + an
 *     inset top highlight + a concentric, tighter radius). It reads like a glass
 *     plate seated in an aluminium tray, never a flat pill on the page.
 *   • BUTTON-IN-BUTTON trailing icon: the arrow is never naked — it lives in its
 *     own circular well flush with the core's right edge, and on hover translates
 *     diagonally + blooms while the core presses in. Internal kinetic tension.
 *
 * MAGNETISM (pointer devices, motion allowed): the OUTER shell drifts toward the
 * cursor via GSAP `quickTo` (x/y), while the press-scale lives on the INNER core —
 * deliberately split across two elements so the CSS `scale` and the GSAP translate
 * never write the same `transform` and fight. Touch / reduced-motion get neither.
 *
 * All GSAP is scoped to the shell, so @gsap/react reverts every quickTo on unmount.
 */
export default function BezelButton({
  label,
  onClick,
  arrow = 'up-right',
  tone = 'gold', // 'gold' (filled accent) | 'ghost' (quiet outline)
  magnetic = true,
  className = '',
  ariaLabel,
}) {
  const shellRef = useRef(null)

  useGSAP(
    () => {
      const shell = shellRef.current
      if (!shell || !magnetic) return
      if (prefersReducedMotion()) return
      if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return

      const xTo = gsap.quickTo(shell, 'x', { duration: 0.5, ease: 'power3' })
      const yTo = gsap.quickTo(shell, 'y', { duration: 0.5, ease: 'power3' })
      const STRENGTH = 0.35 // how hard the shell leans into the cursor

      const onMove = (e) => {
        const r = shell.getBoundingClientRect()
        xTo((e.clientX - (r.left + r.width / 2)) * STRENGTH)
        yTo((e.clientY - (r.top + r.height / 2)) * STRENGTH)
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }

      shell.addEventListener('mousemove', onMove)
      shell.addEventListener('mouseleave', onLeave)
      return () => {
        shell.removeEventListener('mousemove', onMove)
        shell.removeEventListener('mouseleave', onLeave)
      }
    },
    { scope: shellRef, dependencies: [magnetic] },
  )

  return (
    <button
      type="button"
      ref={shellRef}
      onClick={onClick}
      aria-label={ariaLabel || label}
      className={`bezel-btn bezel-btn--${tone} ${className}`.trim()}
    >
      <span className="bezel-btn__core">
        <span className="bezel-btn__label">{label}</span>
        <span className="bezel-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[arrow]}
          </svg>
        </span>
      </span>
    </button>
  )
}

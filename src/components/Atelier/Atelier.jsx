import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '../../utils/animations'
import './Atelier.css'

// Self-contained registration — idempotent, mirrors Hero/Collection/Philosophy.
gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Resolve a `/public` asset against Vite's base URL — the same idiom every other
 * section uses. When the Python backend goes live, swap this single line for the
 * CDN/API origin and the view stays untouched.
 */
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

// The two faces of one place. `blueprint` is the technical CAD drawing (white
// lines on architect's blue); `final-pond` is the finished, living ecosystem
// shot from the SAME viewpoint so the reveal reads as the project "becoming
// real". Both live in /public/assets as .webp; until they exist the layers
// degrade to the calm paper ground (see .atelier__layer background).
const MEDIA_BLUEPRINT = 'assets/blueprint.png'
const MEDIA_REALITY = 'assets/final-pond.png'

/**
 * Atelier — "Precisione e Vita".
 *
 * The trust-builder: it shows, without a single before/after handle, how a
 * rigorous technical drawing turns into a living pond. No slider — a reveal.
 *
 * THE MORPH REVEAL
 * ----------------
 * The blueprint is fixed. The finished-pond photo lies directly on top of it,
 * hidden behind a soft-edged radial mask whose radius (`--reveal`, a CSS custom
 * property) is scrubbed from 0% to past the corners as the section is pinned.
 * The photograph therefore appears to "light up" out of the drawing, spreading
 * from the centre of the water outward — the project becoming reality.
 *
 * Four behaviours, all inside ONE `useGSAP` scope so @gsap/react reverts the
 * tweens and kills the ScrollTriggers on unmount (no manual cleanup, no leaks):
 *
 *   1. PIN + REVEAL — the stage pins to the viewport; over that pinned travel
 *      `--reveal` scrubs 0 → 160%, expanding the radial mask on the reality
 *      layer. The blueprint shows through everywhere the mask hasn't reached yet.
 *   2. BLUEPRINT DRAW — the SVG technical overlay (frame, crosshair, dimension
 *      lines, depth circle) draws itself in via stroke-dashoffset when the stage
 *      enters, giving the CAD "being plotted" feel. Each path uses pathLength=1
 *      so one normalized offset drives every stroke — no DrawSVG plugin needed.
 *   3. CAPTION CROSSFADE — the "Progetto" label fades out and the "Opera" label
 *      fades in, tied to the same scrub, so the wording tracks the transformation.
 *   4. INK-BLUR TEXT — eyebrow/title/lead resolve from blur+transparent to sharp,
 *      staggered, mirroring Philosophy so the two light sections feel of a piece.
 *
 * Everything is gated by prefers-reduced-motion: those visitors get the finished
 * pond fully revealed, the overlay fully drawn, sharp text — no pin, no motion.
 */
export default function Atelier() {
  const root = useRef(null)
  const stageRef = useRef(null)

  useGSAP(
    () => {
      const section = root.current
      const stage = stageRef.current
      if (!section || !stage) return

      const reality = stage.querySelector('.atelier__layer--reality')
      const strokes = gsap.utils.toArray('.atelier__draw', stage)
      const labelPlan = stage.querySelector('.atelier__caption--plan')
      const labelReal = stage.querySelector('.atelier__caption--real')
      const reveals = gsap.utils.toArray('[data-ink]', section)

      // Accessibility / no-JS-motion: land on the finished state immediately.
      // Reality fully revealed, overlay fully drawn, captions on "Opera", text
      // sharp — and crucially NO pin, so the page scrolls naturally.
      if (prefersReducedMotion()) {
        gsap.set(reality, { '--reveal': '160%' })
        gsap.set(strokes, { strokeDashoffset: 0 })
        gsap.set(labelPlan, { autoAlpha: 0 })
        gsap.set(labelReal, { autoAlpha: 1 })
        gsap.set(reveals, { autoAlpha: 1, filter: 'blur(0px)', y: 0 })
        return
      }

      // 1 — PIN + REVEAL.  Desktop and touch are deliberately split with
      // gsap.matchMedia() rather than a few inline ternaries, because the two
      // experiences need genuinely different MECHANICS, not just different numbers
      // — and matchMedia cleanly reverts/rebuilds the right one when the viewport
      // crosses the breakpoint (rotate, devtools resize, …). Desktop is preserved
      // byte-for-byte; everything new lives in the touch branch.
      const mm = gsap.matchMedia()

      // ---- DESKTOP (unchanged) ------------------------------------------------
      // The unhurried, water-like settle. Long-ish scrub, color-stop mask reveal,
      // ground-truth values that were already perfect — left exactly as they were.
      mm.add('(min-width: 901px)', () => {
        const revealTl = gsap.timeline({
          scrollTrigger: {
            trigger: stage,
            start: 'center center',
            end: '+=120%',
            pin: true,
            scrub: 1.2,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })

        revealTl
          .fromTo(reality, { '--reveal': '0%' }, { '--reveal': '160%', ease: 'none' }, 0)
          .to(labelPlan, { autoAlpha: 0, ease: 'none', duration: 0.35 }, 0.15)
          .to(labelReal, { autoAlpha: 1, ease: 'none', duration: 0.4 }, 0.45)
      })

      // ---- TOUCH / MOBILE (rebuilt) ------------------------------------------
      // Three things were starving the reveal on phones; all three are fixed here.
      //
      //  • RUNWAY.  `end:"+=85%"` means "pin for 0.85 × viewport-height of scroll"
      //    (in ScrollTrigger a relative `+=%` is a percentage of the SCROLLER/
      //    viewport, not of the trigger). On a ~750px-tall phone that's only
      //    ~640px — a single thumb-flick with momentum clears it in a fraction of
      //    a second, so the mask never had room to finish opening. We give it a
      //    long 200%-of-viewport runway so the gesture has somewhere to go.
      //
      //  • SCRUB LAG.  scrub:0.6 over that tiny runway meant the animation was
      //    permanently ~0.6s behind the finger and the pin un-stuck before it
      //    could catch up — the reveal got chopped mid-bloom. With the long runway
      //    a near-instant scrub (0.3) tracks the thumb yet still resolves fully.
      //
      //  • THE WHOLE TIMELINE drives the reveal (duration 1), so every pixel of
      //    that runway opens the mask — it completes with just a small breath at
      //    the end on the finished pond, never a hard cut.
      //
      // The mask itself also switches technique on touch — see Atelier.css
      // (`@media (max-width: 900px)`): instead of animating a color-stop inside
      // the gradient (which forces Safari to regenerate + re-raster the gradient
      // every frame), `--reveal` drives `mask-size` of a FIXED gradient. The
      // square (1:1) stage keeps the circle perfectly centred (zero focal drift),
      // 0% → 165% takes the soft-edged core just past the corners, and the layer
      // is isolated (translateZ + contain:paint) so its repaint can't touch the
      // rest of the page.
      mm.add('(max-width: 900px)', () => {
        const revealTl = gsap.timeline({
          scrollTrigger: {
            trigger: stage,
            start: 'center center',
            end: '+=200%', // long thumb runway so the bloom always completes
            pin: true,
            pinSpacing: true, // push following content down naturally (no dead gap)
            scrub: 0.3, // tracks the finger; tiny enough to fully resolve in-runway
            anticipatePin: 0, // touch velocity is erratic — pre-pin causes a jump
            invalidateOnRefresh: true,
          },
        })

        revealTl
          .fromTo(
            reality,
            { '--reveal': '0%' },
            { '--reveal': '165%', ease: 'none', duration: 1 },
            0,
          )
          .to(labelPlan, { autoAlpha: 0, ease: 'none', duration: 0.25 }, 0.15)
          .to(labelReal, { autoAlpha: 1, ease: 'none', duration: 0.3 }, 0.45)
      })

      // 2 — BLUEPRINT DRAW. Plays once as the stage settles in, before the reveal
      // really gets going, so the visitor sees the drawing "plotted" first and
      // then watches it come alive. strokeDashoffset 1 → 0 with pathLength=1.
      gsap.fromTo(
        strokes,
        { strokeDashoffset: 1 },
        {
          strokeDashoffset: 0,
          duration: 1.6,
          ease: 'power2.inOut',
          stagger: 0.12,
          scrollTrigger: {
            trigger: stage,
            start: 'top 75%',
            once: true,
          },
        },
      )

      // 4 — INK-BLUR TEXT. Same recipe as Philosophy: blurred + transparent →
      // sharp, staggered eyebrow → title → lead, on a long power curve.
      gsap.fromTo(
        reveals,
        { autoAlpha: 0, filter: 'blur(12px)', y: 26 },
        {
          autoAlpha: 1,
          filter: 'blur(0px)',
          y: 0,
          duration: 1.8,
          ease: 'power3.out',
          stagger: 0.22,
          scrollTrigger: {
            trigger: '.atelier__text',
            start: 'top 80%',
            once: true,
          },
        },
      )

      // Tear down the matchMedia contexts (and their ScrollTriggers/pin-spacing)
      // on unmount or before re-running. useGSAP reverts what it owns, but the
      // tweens born inside matchMedia branches are owned by `mm` — revert it too.
      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section className="atelier" id="atelier" ref={root}>
      <div className="atelier__inner">
        {/* Text column — narrow, adrift in whitespace on the left. */}
        <div className="atelier__text">
          <p className="atelier__eyebrow" data-ink>
            生態系 · ECOSISTEMI
          </p>

          <h2 className="atelier__title" data-ink>
            Precisione e Vita.
          </h2>

          <p className="atelier__lead" data-ink>
            Ogni progetto nasce da un calcolo rigoroso e si completa
            nell&apos;equilibrio naturale. Traduciamo la complessità tecnica in
            un ecosistema in cui l&apos;acqua ritrova il suo corso naturale.
          </p>
        </div>

        {/* Visual stage — the morph reveal lives here. Pinned while scrolling. */}
        <figure className="atelier__stage" ref={stageRef}>
          {/* Fixed base: the technical drawing. */}
          <img
            className="atelier__layer atelier__layer--blueprint"
            src={asset(MEDIA_BLUEPRINT)}
            alt="Disegno tecnico del laghetto — progetto in stile blueprint"
            loading="lazy"
            draggable="false"
          />

          {/* SVG technical overlay — drawn in on enter, sits over the blueprint
              to amplify the CAD character. Decorative, hence aria-hidden. */}
          <svg
            className="atelier__grid"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {/* Outer dimension frame */}
            <rect
              className="atelier__draw"
              x="4"
              y="4"
              width="92"
              height="92"
              pathLength="1"
            />
            {/* Crosshair through the basin */}
            <line
              className="atelier__draw"
              x1="50"
              y1="8"
              x2="50"
              y2="92"
              pathLength="1"
            />
            <line
              className="atelier__draw"
              x1="8"
              y1="55"
              x2="92"
              y2="55"
              pathLength="1"
            />
            {/* Depth / radius circle around the water */}
            <circle
              className="atelier__draw"
              cx="50"
              cy="55"
              r="26"
              pathLength="1"
            />
            {/* Corner dimension ticks */}
            <path
              className="atelier__draw"
              d="M4 16 H12 M16 4 V12"
              pathLength="1"
            />
            <path
              className="atelier__draw"
              d="M96 84 H88 M84 96 V88"
              pathLength="1"
            />
          </svg>

          {/* Reveal layer: the finished pond, masked by an expanding radial
              gradient whose radius is the GSAP-driven `--reveal` custom prop. */}
          <img
            className="atelier__layer atelier__layer--reality"
            src={asset(MEDIA_REALITY)}
            alt="Il laghetto finito — ecosistema vivente realizzato"
            loading="lazy"
            draggable="false"
          />

          {/* Captions crossfade plan → reality with the scrub. */}
          <figcaption className="atelier__caption atelier__caption--plan">
            <span className="atelier__caption-num">01</span> Progetto
          </figcaption>
          <figcaption className="atelier__caption atelier__caption--real">
            <span className="atelier__caption-num">02</span> Opera Vivente
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

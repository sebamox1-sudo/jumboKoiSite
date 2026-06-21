import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '../../utils/animations'
import './Bonsai.css'
import LiquidCursorDistortion from '../LiquidCursorDistortion/LiquidCursorDistortion'

// Self-contained registration — idempotent, mirrors every other section.
gsap.registerPlugin(useGSAP, ScrollTrigger)

/** Resolve a `/public` asset against Vite's base URL — the project-wide idiom. */
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

// REQUIRED cut-out asset (transparent background, high-res, .webp/.png). Drop the
// file at /public/assets/bonsai.webp. Until it exists the portal still composes
// on its own (dark slit + red sun + haze); only the foreground tree is missing.
const BONSAI_IMAGE = 'assets/Bonsai.avif'

/**
 * Bonsai — "Mille Anni in un Vaso" · the Out-of-Bounds Parallax.
 *
 * Sits BETWEEN Philosophy and Atelier and is, on purpose, indistinguishable from
 * the end of Philosophy: same warm washi-paper ground, no curved top edge, no
 * shadow lip — one continuous sheet of paper you keep descending. The drama is
 * entirely about DEPTH, not a background change.
 *
 * THREE PARALLAX LAYERS (one scrubbed timeline)
 * ---------------------------------------------
 *   L1 — the paper page itself: the anchor, never moves.
 *   L2 — the slit INTERIOR (red sun + haze), clipped inside the dark portal:
 *        drifts slowly, WITH the scroll → reads as "far away".
 *   L3 — the cut-out bonsai in front: drifts faster and OPPOSITE, and is NOT
 *        clipped — its canopy and roots spill out of the slit onto the bright
 *        page, with a drop-shadow cast on the paper. The big differential
 *        between L3 and L2 is what fabricates the 3D pop.
 *
 * Entrance is the project's signature ink-blur reveal (blur→sharp + fade + rise,
 * staggered), coherent with Philosophy/Atelier. Everything is created inside one
 * useGSAP scope so @gsap/react reverts the tweens and kills the ScrollTriggers on
 * unmount. prefers-reduced-motion lands on a composed, static still.
 */
export default function Bonsai() {
  const root = useRef(null)

  useGSAP(
    () => {
      const section = root.current
      if (!section) return

      const intro = section.querySelector('.bonsai__intro')
      const frame = section.querySelector('.bonsai__frame')
      const interior = section.querySelector('[data-bonsai="interior"]')
      const tree = section.querySelector('[data-bonsai="tree"]')
      const cards = gsap.utils.toArray('.bonsai__card', section)

      // ====================================================================
      //  PARALLAX TUNING — the only two numbers you need for fine-tuning.
      //  --------------------------------------------------------------------
      //  Each value is a yPercent AMPLITUDE (% of the element's OWN height)
      //  applied symmetrically across the section's full travel: the layer goes
      //  from +value (when the section enters at the bottom) to -value (when it
      //  leaves at the top). Symmetry means every layer is perfectly centred when
      //  the section is centred, so the composition is "correct" mid-scroll and
      //  only the DIFFERENCE between layers reads as depth.
      //
      //    • Bigger |value|  = faster apparent motion = feels CLOSER to camera.
      //    • OPPOSITE signs between INTERIOR and TREE maximise the separation.
      //    • The illusion's strength ≈ (TREE_Y + INTERIOR_Y). Keep TREE_Y the
      //      larger of the two (the foreground should always out-run the bg).
      //
      //  Good starting feel: interior slow (~14), tree fast & opposite (~24).
      //  Want a more aggressive "leap off the screen"? Push TREE_Y toward ~32.
      // ====================================================================
      const INTERIOR_Y = 14 // L2 — slit interior (sun/haze): SLOW
      const TREE_Y = 24 // L3 — cut-out bonsai: FAST, opposite direction

      // --- Reduced motion: composed, static, no transforms --------------------
      // Everything visible and at rest. We do NOT touch the tree's `filter` so its
      // CSS drop-shadow (depth cue) survives; we only neutralise the parallax.
      if (prefersReducedMotion()) {
        gsap.set([intro, frame, ...cards], { autoAlpha: 1, filter: 'blur(0px)', y: 0 })
        gsap.set(tree, { autoAlpha: 1 })
        gsap.set([interior, tree], { yPercent: 0, clearProps: 'transform' })
        return
      }

      // --- ENTRANCE: ink-blur reveal (plays once on enter) --------------------
      // Note: the TREE only fades (no blur). Animating `filter: blur()` on a huge
      // cut-out would (a) be expensive on mobile and (b) clobber its CSS
      // drop-shadow. Frame + cards are small, so their blur reveal is cheap.
      const reveal = gsap.timeline({
        defaults: { ease: 'power3.out' },
        scrollTrigger: { trigger: section, start: 'top 72%', once: true },
      })
      reveal
        .fromTo(
          intro,
          { autoAlpha: 0, filter: 'blur(12px)', y: 26 },
          { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 1.4 },
        )
        .fromTo(
          frame,
          { autoAlpha: 0, filter: 'blur(16px)', yPercent: 6 },
          { autoAlpha: 1, filter: 'blur(0px)', yPercent: 0, duration: 1.5 },
          '-=1.15',
        )
        .fromTo(tree, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.5 }, '-=1.2')
        .fromTo(
          cards,
          { autoAlpha: 0, filter: 'blur(12px)', y: 30 },
          { autoAlpha: 1, filter: 'blur(0px)', y: 0, duration: 1.2, stagger: 0.18 },
          '-=1.1',
        )

      // --- PARALLAX: one scrub:true timeline over the whole passage -----------
      // start 'top bottom'  → t=0 the instant the section's top enters the viewport
      // end   'bottom top'  → t=1 the instant its bottom leaves past the top
      // …so the section's entire on-screen life maps linearly to progress 0→1.
      const plx = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
          invalidateOnRefresh: true,
        },
      })

      // L2 — interior drifts DOWN as we scroll down (slower than the page = far).
      plx.fromTo(
        interior,
        { yPercent: -INTERIOR_Y },
        { yPercent: INTERIOR_Y, ease: 'none' },
        0,
      )
      // L3 — bonsai drifts UP, faster and OPPOSITE → it lifts off the slit toward
      //      the viewer. (L1, the paper, is intentionally never animated.)
      plx.fromTo(
        tree,
        { yPercent: TREE_Y + 15 },
        { yPercent: -TREE_Y + 15, ease: 'none' },
        0,
      )
    },
    { scope: root },
  )

  return (
    <section className="bonsai" ref={root}>
      <div className="bonsai__inner">
        {/* Editorial heading — sumi ink on paper (top-left on desktop). */}
        <div className="bonsai__intro">
          <p className="bonsai__eyebrow">盆栽 · BONSAI</p>
          <h2 className="bonsai__title">
            Mille Anni
            <br />
            in un Vaso.
          </h2>
        </div>

        {/* The portal. `overflow: visible` so the tree can exondate; the dark
            slit itself is clipped by .bonsai__frame, not by the portal. */}
        <div className="bonsai__portal">
          {/* L2 — the dark slit + its clipped, parallaxing interior. */}
          <div className="bonsai__frame">
            <div className="bonsai__interior" data-bonsai="interior">
              <span className="bonsai__sun" aria-hidden="true" />
              <span className="bonsai__haze" aria-hidden="true" />
            </div>
          </div>

          {/* L3 — the foreground bonsai. The wrap owns the horizontal centring
              (translateX) so GSAP is free to own the vertical parallax on the
              <img> itself without the two transforms fighting. */}
          <div className="bonsai__tree-wrap">
            <div 
              className="bonsai__tree" 
              data-bonsai="tree"
              style={{ 
                position: 'relative', 
                width: '100%', 
                height: '80vh', /* Il WebGL ha bisogno di un'altezza esplicita */
                cursor: 'crosshair' /* Dà un tocco premium */
              }}
            >
              <LiquidCursorDistortion 
                imageSrc={asset(BONSAI_IMAGE)} 
                intensity={0.08} 
                radius={0.35} 
              />
            </div>
          </div>
        </div>

        {/* Liquid-glass description cards — same frosted spec as the Hero. They
            straddle the slit edges so the blur picks up the dark portal behind. */}
        <article className="bonsai__card bonsai__card--one">
          <span className="bonsai__card-kicker">樹齢 · Età</span>
          <h3 className="bonsai__card-title">Antichità Vivente</h3>
          <p className="bonsai__card-text">
            Alcuni di questi esemplari respirano da prima delle nostre città. Ogni
            piega del tronco è un decennio di pazienza, scolpito dal vento e dalla
            mano dell&apos;uomo in egual misura.
          </p>
        </article>

        <article className="bonsai__card bonsai__card--two">
          <span className="bonsai__card-kicker">間 · Ma</span>
          <h3 className="bonsai__card-title">Lo Spazio Negativo</h3>
          <p className="bonsai__card-text">
            Il vuoto attorno all&apos;albero non è assenza, è respiro. La fessura
            buia incornicia la vita e le dà profondità: è il silenzio che fa
            risuonare la forma.
          </p>
        </article>
      </div>
    </section>
  )
}

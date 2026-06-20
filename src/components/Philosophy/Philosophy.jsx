import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '../../utils/animations'
import './Philosophy.css'

// Self-contained registration — idempotent, mirrors Collection/Hero.
gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Resolve a `/public` asset against Vite's base URL — the same idiom Collection
 * and Hero use. When the Python backend goes live, swap this single line for the
 * CDN/API origin and nothing in the view changes.
 */
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

// The two stones of this composition. They live in /public/assets as .webp.
// `tsukubai` (the stone water basin) is the large, hero-style asymmetric image;
// `zen-garden` (raked gravel) is the smaller plate that overlaps it. The wrappers
// clip with overflow:hidden so the slow parallax never spills past their edges.
const MEDIA_MAIN = 'assets/tsukubai.png'
const MEDIA_SUB = 'assets/zen-garden.png'

/**
 * Philosophy — "Il Tempo dell'Acqua".
 *
 * The breath between the dark Collection and whatever comes next. Its whole job
 * is to slow the pulse: the page exhales from the black sumi-e void into a warm
 * washi-paper light, and a single editorial thought appears the way ink bleeds
 * into wet paper — softly, out of focus, then sharp.
 *
 * Three independent, scrubbed/triggered behaviours, all created inside ONE
 * `useGSAP` scope so @gsap/react reverts the tweens and kills the ScrollTriggers
 * on unmount — no manual cleanup, no leaks:
 *
 *   1. BACKGROUND EXHALE — as the section rises, its ground colour scrubs from
 *      the Collection's near-black (--color-bg) to ricepaper (--color-paper).
 *      The section is opaque and last in flow, so tweening its OWN background is
 *      enough; we never have to touch <body> and risk leaving it stuck on ivory.
 *   2. SLOW-MOTION PARALLAX — each image, pre-scaled to 1.1 inside its clipped
 *      wrapper, drifts vertically across the whole section scroll. Long, tidal,
 *      barely-there: dilated time, not movement.
 *   3. INK-BLUR REVEAL — eyebrow, title and paragraph resolve from blur(12px)+
 *      opacity 0 to blur(0)+opacity 1 with a stagger, like brush ink settling.
 *
 * Everything is gated by `prefers-reduced-motion`: those visitors get the final
 * paper-light layout, sharp text and still images — nothing hidden, nothing moving.
 */
export default function Philosophy() {
  const root = useRef(null)

  useGSAP(
    () => {
      const section = root.current
      if (!section) return

      const reveals = gsap.utils.toArray('[data-ink]', section)
      const media = gsap.utils.toArray('.philosophy__media-img', section)

      // Accessibility: paper ground, text in focus, images at rest. Bail before
      // creating a single ScrollTrigger so there is genuinely no motion.
      if (prefersReducedMotion()) {
        gsap.set(section, { backgroundColor: 'var(--color-paper)' })
        gsap.set(reveals, { autoAlpha: 1, filter: 'blur(0px)', y: 0 })
        gsap.set(media, { scale: 1, yPercent: 0 })
        return
      }

      // Read the palette tokens so the colour exhale stays in sync with the CSS
      // variables (no hard-coded hexes drifting out of step with index.css).
      const styles = getComputedStyle(document.documentElement)
      const dark = styles.getPropertyValue('--color-bg').trim()
      const paper = styles.getPropertyValue('--color-paper').trim()

      // 1 — BACKGROUND EXHALE. Scrubbed over the section's approach so the black
      // dissolves into paper exactly as the panel climbs into view, then holds.
      gsap.fromTo(
        section,
        { backgroundColor: dark },
        {
          backgroundColor: paper,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom', // section's top enters from the bottom edge
            end: 'top center', // …fully paper by the time it reaches mid-screen
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      )

      // 2 — SLOW-MOTION PARALLAX. Pre-scaled 1.1 (the clip wrapper hides the
      // overflow), each image glides on Y across the full section travel. The
      // two stones move different amounts so they never feel mechanically locked.
      media.forEach((img, i) => {
        const drift = i === 0 ? 12 : -9 // main sinks, sub rises — gentle counterplay
        gsap.fromTo(
          img,
          { yPercent: -drift, scale: 1.1 },
          {
            yPercent: drift,
            scale: 1.1,
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.4, // extra lag = that dilated, underwater slowness
              invalidateOnRefresh: true,
            },
          },
        )
      })

      // 3 — INK-BLUR REVEAL. Plays once when the text block is well into view.
      // blur(12px)+transparent → sharp+opaque, staggered eyebrow → title → para,
      // on a long power-curve so it reads as ink soaking in, not a UI fade.
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
            trigger: '.philosophy__text',
            start: 'top 78%',
            once: true,
          },
        },
      )
    },
    { scope: root },
  )

  return (
    <section className="philosophy" id="philosophy" ref={root}>
      <div className="philosophy__inner">
        {/* Text column — sits to the left in a sea of whitespace. */}
        <div className="philosophy__text">
          <p className="philosophy__eyebrow" data-ink>
            和 · L&apos;EQUILIBRIO
          </p>

          <h2 className="philosophy__title" data-ink>
            Il Tempo dell&apos;Acqua.
          </h2>

          <p className="philosophy__lead" data-ink>
            Allevare una Nishikigoi non è un processo, è un dialogo continuo con
            la natura. Nei nostri giardini, la pietra guida il flusso, il muschio
            trattiene il tempo e l&apos;acqua modella la forma. Non forziamo la
            crescita, assecondiamo l&apos;armonia.
          </p>
        </div>

        {/* Media column — a large stone basin with a smaller raked-gravel plate
            sliding out of its lower-left, breaking into the text's whitespace.
            Each wrapper clips its own slow-parallax image. */}
        <div className="philosophy__media">
          <figure className="philosophy__media-main">
            <img
              className="philosophy__media-img"
              src={asset(MEDIA_MAIN)}
              alt="Tsukubai — bacino di pietra in un giardino zen"
              loading="lazy"
              draggable="false"
            />
          </figure>

          <figure className="philosophy__media-sub">
            <img
              className="philosophy__media-img"
              src={asset(MEDIA_SUB)}
              alt="Ghiaia rastrellata di un giardino secco karesansui"
              loading="lazy"
              draggable="false"
            />
          </figure>
        </div>
      </div>
    </section>
  )
}

import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '../../utils/animations'
import './Bespoke.css'

// Self-contained registration — idempotent, mirrors every other section.
gsap.registerPlugin(useGSAP, ScrollTrigger)

/** Resolve a `/public` asset against Vite's base URL — the project-wide idiom. */
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

// The koi that bleeds off the card's bottom-left, seen through the frosted glass.
// (Files in /public/assets are .png in this project — not .webp.)
const INQUIRY_KOI = 'assets/inquiry-koi.png'

// Intent chips. `value` is the machine token sent to the API; `label` is shown.
const INTENTS = [
  { value: 'koi', label: 'Desidero una Koi' },
  { value: 'pond', label: 'Voglio creare un Laghetto' },
  { value: 'both', label: 'Entrambi' },
]

// Pond volumes — only asked when the intent involves a pond. `value` is what the
// backend receives; `label` is the elegant on-screen text.
const VOLUMES = [
  { value: '5000', label: '5.000 L' },
  { value: '10000', label: '10.000 L' },
  { value: '20000', label: '20.000 L' },
  { value: '20000+', label: 'Oltre 20.000 L' },
]

/**
 * Bespoke — "Progetta il tuo Silenzio" · the closing luxury CTA / inquiry form.
 *
 * THE "SUMI INK DROP" TRANSITION
 * ------------------------------
 * The page has been a warm sheet of paper since Philosophy. Here it flips to a
 * nocturnal ink theme — but not by fading. A pinned curtain holds the light paper
 * in place, then a single drop of black ink (a clip-path circle) blooms up from
 * the bottom-centre and swallows the whole screen, uncovering the dark form world
 * beneath. After the ink fully covers, the pin releases into the (already dark)
 * form panel, where the liquid-glass card staggers in.
 *
 * Three GSAP scopes, all via @gsap/react (auto-cleanup):
 *   1. root  — the pinned ink-drop reveal + the staggered entrance of the card.
 *   2. form  — the conditional pond-volume sub-section (animated height).
 *   3. magnetic — the submit button drifting toward the cursor (pointer devices).
 *
 * The form is pure UX (no AI): it packages { name, email, intent, volume } into a
 * JSON payload shaped for a Python/FastAPI REST backend and logs it on submit.
 * prefers-reduced-motion skips the ink/pin/magnetic entirely and shows the dark
 * form immediately.
 */
export default function Bespoke() {
  const root = useRef(null)
  const formScope = useRef(null)
  const conditionalRef = useRef(null)
  const buttonRef = useRef(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [intent, setIntent] = useState('')
  const [volume, setVolume] = useState('')
  const [sent, setSent] = useState(false)

  // Pond size is only relevant when a pond is part of the request.
  const needsVolume = intent === 'pond' || intent === 'both'

  // --- 1. INK-DROP REVEAL + card entrance ----------------------------------
  useGSAP(
    () => {
      const section = root.current
      if (!section) return

      const ink = section.querySelector('.bespoke__ink')
      const layout = section.querySelector('.bespoke__layout')
      const reveals = gsap.utils.toArray('[data-bespoke-reveal]', section)

      // The ink drop's two clip-path states. GSAP interpolates the numbers inside
      // the matching `circle(...)` template, so radius AND centre travel together
      // (a drop rising from the bottom and spreading past the corners).
      const INK_DROP = { clipPath: 'circle(0% at 50% 100%)', webkitClipPath: 'circle(0% at 50% 100%)' }
      const INK_OPEN = { clipPath: 'circle(150% at 50% 50%)', webkitClipPath: 'circle(150% at 50% 50%)' }

      const mm = gsap.matchMedia()

      // DESKTOP — pinned "sumi ink drop" that reveals the form IN PLACE. The stage
      // is exactly one viewport tall and stacked (paper ◂ ink ◂ form), so the
      // clip-path bloom uncovers the form already sitting there. Nothing lives
      // below the pin, so the pin-spacer can't push an empty panel down: no gap.
      mm.add('(min-width: 861px) and (prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: '.bespoke__stage',
            start: 'top top',
            end: '+=110%',
            pin: true,
            scrub: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })
        tl.fromTo(ink, INK_DROP, { ...INK_OPEN, ease: 'power2.inOut', duration: 0.62 }, 0)
          // The form fades up once the ink has mostly covered the paper.
          .fromTo(layout, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.25 }, 0.5)
          .fromTo(
            reveals,
            { y: 28, filter: 'blur(10px)' },
            { y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'power3.out', stagger: 0.08 },
            0.55,
          )
      })

      // MOBILE — the stacked form is taller than the viewport, so pinning would
      // clip/trap it. No pin: the dark ground is simply present and the card + its
      // fields fade up on enter. Fully scrollable, and still zero dead space.
      mm.add('(max-width: 860px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.set(ink, INK_OPEN)
        gsap
          .timeline({
            defaults: { ease: 'power3.out' },
            scrollTrigger: { trigger: '.bespoke__glass', start: 'top 82%', once: true },
          })
          .fromTo(layout, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 0)
          .fromTo(
            reveals,
            { y: 24, filter: 'blur(8px)' },
            { y: 0, filter: 'blur(0px)', duration: 0.5, stagger: 0.08 },
            0.1,
          )
      })

      // REDUCED MOTION — no ink drop, no pin: the dark form is simply there, sharp.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(ink, INK_OPEN)
        gsap.set([layout, ...reveals], { autoAlpha: 1, y: 0, filter: 'blur(0px)' })
      })

      return () => mm.revert()
    },
    { scope: root },
  )

  // --- 2. CONDITIONAL pond-volume sub-section (animated height) -------------
  useGSAP(
    () => {
      const el = conditionalRef.current
      if (!el) return

      if (prefersReducedMotion()) {
        gsap.set(el, { height: needsVolume ? 'auto' : 0, autoAlpha: needsVolume ? 1 : 0 })
        return
      }

      // fromTo (immediateRender) sets the start state synchronously, so toggling
      // never flashes the opposite height between useGSAP's revert and re-run.
      if (needsVolume) {
        gsap.fromTo(
          el,
          { height: 0, autoAlpha: 0 },
          { height: 'auto', autoAlpha: 1, duration: 0.5, ease: 'power2.out' },
        )
      } else {
        gsap.fromTo(
          el,
          { height: 'auto', autoAlpha: 1 },
          { height: 0, autoAlpha: 0, duration: 0.4, ease: 'power2.in' },
        )
      }
    },
    { dependencies: [needsVolume], scope: formScope },
  )

  // --- 3. MAGNETIC submit button (pointer devices only) --------------------
  useGSAP(
    () => {
      const btn = buttonRef.current
      if (!btn) return
      if (prefersReducedMotion()) return
      // Touch has no hover/cursor to chase — leave it be.
      if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return

      const xTo = gsap.quickTo(btn, 'x', { duration: 0.45, ease: 'power3' })
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.45, ease: 'power3' })
      const STRENGTH = 0.4 // how hard the button leans toward the cursor

      const onMove = (e) => {
        const r = btn.getBoundingClientRect()
        xTo((e.clientX - (r.left + r.width / 2)) * STRENGTH)
        yTo((e.clientY - (r.top + r.height / 2)) * STRENGTH)
      }
      const onLeave = () => {
        xTo(0)
        yTo(0)
      }

      btn.addEventListener('mousemove', onMove)
      btn.addEventListener('mouseleave', onLeave)
      return () => {
        btn.removeEventListener('mousemove', onMove)
        btn.removeEventListener('mouseleave', onLeave)
      }
    },
    { scope: root },
  )

  // --- Submit: package the payload for the (future) FastAPI backend ---------
  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      name: name.trim(),
      email: email.trim(),
      intent, // 'koi' | 'pond' | 'both'
      volume: needsVolume ? volume || null : null, // null when not applicable
    }
    // Proof the structured JSON is ready to be POSTed as-is.
    console.log('[bespoke] inquiry payload →', JSON.stringify(payload, null, 2))
    setSent(true)
  }

  return (
    <section className="bespoke" ref={root}>
      {/* ONE stacked stage. The light paper, the dark ink ground and the form all
          occupy the SAME space (absolute layers), so the ink-drop reveals the form
          that is ALREADY there — there is no separate panel for the pin-spacer to
          push down, hence no empty black scroll between Atelier and the form. */}
      <div className="bespoke__stage">
        <div className="bespoke__paper" aria-hidden="true" />
        <div className="bespoke__ink" aria-hidden="true" />

        <div className="bespoke__layout">
          {/* card-wrap is sized to the card, so the koi can be anchored to the
              CARD's bottom-left (not the whole stage). */}
          <div className="bespoke__card-wrap">
            {/* Koi: a SIBLING behind the glass (z-index 1 < 2) so the frosted
                backdrop-filter blurs the part it overlaps; the rest spills out the
                card's bottom-left onto the dark ground. */}
            <img
              className="bespoke__koi"
              src={asset(INQUIRY_KOI)}
              alt=""
              aria-hidden="true"
              draggable="false"
            />

            <div className="bespoke__glass">
            {/* LEFT — editorial */}
            <div className="bespoke__editorial">
              <p className="bespoke__eyebrow" data-bespoke-reveal>
                誂え · SU MISURA
              </p>
              <h2 className="bespoke__title" data-bespoke-reveal>
                Progetta la tua armonia.
              </h2>
              <p className="bespoke__lead" data-bespoke-reveal>
                Ogni commissione inizia con un dialogo. Raccontaci la tua visione —
                un singolo gioiello vivente o un intero ecosistema d&apos;acqua — e
                daremo forma alla quiete che cerchi.
              </p>
            </div>

            {/* RIGHT — the inquiry form (or the thank-you state) */}
            {sent ? (
              <div className="bespoke__thanks" role="status" data-bespoke-reveal>
                <p className="bespoke__thanks-kicker">ありがとう</p>
                <h3 className="bespoke__thanks-title">Richiesta ricevuta.</h3>
                <p className="bespoke__thanks-text">
                  Ti risponderemo personalmente entro due giorni lavorativi.
                </p>
              </div>
            ) : (
              <form className="bespoke__form" ref={formScope} onSubmit={handleSubmit} noValidate>
                <div className="bespoke__field" data-bespoke-reveal>
                  <label className="bespoke__label" htmlFor="bespoke-name">
                    Nome
                  </label>
                  <input
                    id="bespoke-name"
                    className="bespoke__input"
                    type="text"
                    autoComplete="name"
                    placeholder="Il tuo nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="bespoke__field" data-bespoke-reveal>
                  <label className="bespoke__label" htmlFor="bespoke-email">
                    Email
                  </label>
                  <input
                    id="bespoke-email"
                    className="bespoke__input"
                    type="email"
                    autoComplete="email"
                    placeholder="nome@esempio.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {/* Intent chips (custom-styled radios) */}
                <fieldset className="bespoke__group" data-bespoke-reveal>
                  <legend className="bespoke__label">Il tuo desiderio</legend>
                  <div className="bespoke__chips">
                    {INTENTS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`bespoke__chip${intent === opt.value ? ' is-selected' : ''}`}
                      >
                        <input
                          className="bespoke__chip-input"
                          type="radio"
                          name="intent"
                          value={opt.value}
                          checked={intent === opt.value}
                          onChange={() => setIntent(opt.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* Conditional pond-volume — height animates open/closed */}
                <div className="bespoke__conditional" ref={conditionalRef}>
                  <fieldset className="bespoke__group bespoke__group--nested">
                    <legend className="bespoke__label">Volume del laghetto</legend>
                    <div className="bespoke__chips">
                      {VOLUMES.map((opt) => (
                        <label
                          key={opt.value}
                          className={`bespoke__chip${volume === opt.value ? ' is-selected' : ''}`}
                        >
                          <input
                            className="bespoke__chip-input"
                            type="radio"
                            name="volume"
                            value={opt.value}
                            checked={volume === opt.value}
                            onChange={() => setVolume(opt.value)}
                            // Not focusable/submittable while collapsed.
                            tabIndex={needsVolume ? 0 : -1}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>

                <div className="bespoke__actions" data-bespoke-reveal>
                  <button className="bespoke__submit" type="submit" ref={buttonRef}>
                    <span className="bespoke__submit-label">Invia Richiesta</span>
                  </button>
                </div>
              </form>
            )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '../../utils/animations'
import { useTransitionNavigate } from '../../transitions/transitionContext'
import BezelButton from '../ui/BezelButton'
import './Collection.css'

// ScrollTrigger drives the pin; registering here keeps the component self-contained.
// gsap.registerPlugin is idempotent, so registering in more than one module is safe.
gsap.registerPlugin(useGSAP, ScrollTrigger)

/**
 * Resolve a path that lives in `/public` against Vite's configured base URL —
 * the exact same idiom the Hero uses for its frame sequence. When the Python
 * backend goes live, swap this for the CDN/API origin (e.g. `${API}/media/...`)
 * and nothing else in the view has to change.
 */
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

/**
 * @typedef {Object} KoiSpecimen
 * @property {string} id       Stable primary key — mirrors the backend row id.
 * @property {string} variety  Classification (Kohaku, Sanke, Showa…). Drawn as the gold chip.
 * @property {string} name     Display name: variety + originating farm.
 * @property {string} breeder  Niigata bloodline / breeder, shown as the placard subtitle.
 * @property {string} kanji    The variety in kanji — pure typographic texture behind the fish.
 * @property {string} image    Transparent PNG/WebP path relative to /public (resolved via `asset`).
 */

/**
 * MOCK_DATA — placeholder catalogue shaped exactly like the future API payload.
 *
 * The Python backend will eventually return this same `KoiSpecimen[]` contract,
 * so the view stays untouched when the static array is swapped for an async
 * fetch. Images are LOCAL, cut-out koi (transparent background) dropped into
 * `public/assets/` — no external URLs. Each fish is treated as a living jewel
 * suspended in the black void, with its variety's kanji glowing faintly behind.
 *
 * @type {KoiSpecimen[]}
 */
const MOCK_DATA = [
  {
    id: 'kohaku-yamamatsu',
    variety: 'Kohaku',
    name: 'Kohaku Yamamatsu',
    breeder: 'Yamamatsu Farm · Niigata',
    kanji: '紅白',
    image: 'assets/Kohaku.avif',
  },
  {
    id: 'sanke-omosako',
    variety: 'Sanke',
    name: 'Sanke Omosako',
    breeder: 'Omosako Farm · Hiroshima',
    kanji: '三色',
    image: 'assets/taisho sanke.avif',
  },
  {
    id: 'showa-dainichi',
    variety: 'Showa',
    name: 'Showa Dainichi',
    breeder: 'Dainichi Farm · Niigata',
    kanji: '昭和',
    image: 'assets/Showa.avif',
  },
  {
    id: 'tancho-sakai',
    variety: 'Tancho',
    name: 'Tancho Sakai',
    breeder: 'Sakai Fish Farm · Hiroshima',
    kanji: '丹頂',
    image: 'assets/tancho.avif',
  },
  {
    id: 'asagi-ogata',
    variety: 'Asagi',
    name: 'Yamabuki Ogon',
    breeder: 'Ogata Koi Farm · Kumamoto',
    kanji: '浅黄',
    image: 'assets/Yamabuki Ogon.avif',
  },
]

/**
 * Collection — "Living Jewels", a horizontal art-gallery of cut-out koi.
 *
 * Mechanics:
 *   1. The wrapper pins to the top of the viewport (`pin: true`).
 *   2. Vertical wheel/scroll input is translated into a horizontal slide of the
 *      `.collection__track` (`x: -(scrollWidth - innerWidth)`), tied to the
 *      scrollbar via `scrub` so it feels physically connected to the wheel.
 *   3. Inside each card two layers drift at different speeds and OPPOSITE
 *      directions on X (`containerAnimation`): the koi glides gently one way
 *      while its giant background kanji slides further the other way. That
 *      multi-parallax is the depth cue that sells the whole section.
 *
 * Everything is created inside one `useGSAP` scope, so @gsap/react reverts the
 * tweens *and* kills the ScrollTriggers on unmount — no manual cleanup, no leaks.
 * Distances are read inside `invalidateOnRefresh` callbacks, so the section
 * re-measures correctly on resize.
 */
export default function Collection() {
  const root = useRef(null)
  const wrapperRef = useRef(null)
  const trackRef = useRef(null)

  // Route into the 200-year history through the cinematic "void" transition.
  const navigate = useTransitionNavigate()

  useGSAP(
    () => {
      const track = trackRef.current
      const wrapper = wrapperRef.current
      if (!track || !wrapper) return

      // The exact horizontal travel: everything past the first viewport-width.
      const getScrollDistance = () => track.scrollWidth - window.innerWidth

      // Accessibility: no pin, no scrub. Fall back to a plain, natively
      // scrollable horizontal strip and leave the fish centred & still.
      if (prefersReducedMotion()) {
        wrapper.classList.add('collection__wrapper--static')
        return
      }

      // 1 + 2 — pin the wrapper and slide the track sideways with the scroll.
      const horizontal = gsap.to(track, {
        x: () => -getScrollDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: wrapper,
          start: 'top top',
          end: () => `+=${getScrollDistance()}`,
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // 3 — internal multi-parallax. Both layers ride the horizontal tween
      // (not the vertical scrollbar) via `containerAnimation`, re-based onto the
      // card's journey across the viewport.
      const ride = (target, from, to) =>
        gsap.fromTo(
          target,
          { xPercent: from },
          {
            xPercent: to,
            ease: 'none',
            scrollTrigger: {
              trigger: target.closest('.card'),
              containerAnimation: horizontal,
              start: 'left right', // card's left edge enters from the right
              end: 'right left', // card's right edge exits to the left
              scrub: true,
            },
          },
        )

      const cards = gsap.utils.toArray('.card', track)
      cards.forEach((card) => {
        const image = card.querySelector('.card__image')
        const kanji = card.querySelector('.card__kanji')

        // The koi drifts gently with the travel…
        if (image) ride(image, -6, 6)
        // …while the kanji slides further and the OPPOSITE way — depth.
        if (kanji) ride(kanji, 20, -20)
      })
    },
    { scope: root },
  )

  return (
    <section className="collection" id="collection" ref={root}>
      {/* Editorial intro — sits in normal flow above the pinned gallery. */}
      <div className="collection__intro">
        <p className="collection__eyebrow">コレクション · THE COLLECTION</p>
        <h2 className="collection__heading">Gioielli Viventi</h2>
        <p className="collection__lead">
          Kohaku, Sanke, Showa. Esemplari scelti uno a uno nelle farm storiche
          del Giappone, sospesi nel vuoto come gemme che respirano.
        </p>
      </div>

      {/* Pin target: holds the over-wide track inside the viewport frame. */}
      <div className="collection__wrapper" ref={wrapperRef}>
        <div className="collection__track" ref={trackRef}>
          {MOCK_DATA.map((koi, index) => (
            <article className="card" key={koi.id}>
              {/* Giant variety kanji — faint typographic texture behind the koi. */}
              <span className="card__kanji" aria-hidden="true">
                {koi.kanji}
              </span>

              {/* The fish itself: cut-out, contained, oversized so it bleeds
                  past the card's invisible side edges into the black void. */}
              <img
                className="card__image"
                src={asset(koi.image)}
                alt={`${koi.name} — ${koi.variety}`}
                loading="lazy"
                draggable="false"
              />

              {/* Gallery placard, centred in the clear space beneath the fish. */}
              <div className="card__content">
                <span className="card__category">{koi.variety}</span>
                <h3 className="card__title">{koi.name}</h3>
                <p className="card__subtitle">{koi.breeder}</p>
              </div>

              <span className="card__index" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
                <span className="card__index-total">
                  {' / '}
                  {String(MOCK_DATA.length).padStart(2, '0')}
                </span>
              </span>
            </article>
          ))}

          {/* Closing slot — the invitation the horizontal scroll finally delivers.
              A placard floating in the same void as the koi: an eyebrow, the
              machined Double-Bezel CTA, and a whispered subtitle. Clicking it does
              NOT jump routes — it plays the exit timeline and sinks the page into
              the void before /storia is reached (see useTransitionNavigate). */}
          <div className="collection__cta-slot">
            <span className="collection__cta-kicker">二百年 · DAL 1820</span>
            <BezelButton
              label="Scopri la Storia"
              arrow="up-right"
              tone="gold"
              onClick={() => navigate('/storia')}
              ariaLabel="Scopri la storia dei Nishikigoi"
            />
            <span className="collection__cta-note">
              Due secoli di Nishikigoi, dalle risaie di Niigata a oggi.
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

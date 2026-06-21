import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useTransitionNavigate } from '../../transitions/transitionContext'
import { prefersReducedMotion } from '../../utils/animations'
import BezelButton from '../../components/ui/BezelButton'
import './Storia.css'

gsap.registerPlugin(useGSAP, ScrollTrigger)

/** Resolve a `/public` asset against Vite's base URL — the project-wide idiom. */
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

/**
 * Hero plate. Swap for a high-res historical photograph or koi painting; the
 * `.storia__image-wrap` markup and motion stay exactly as-is.
 */
const HERO_IMAGE = 'assets/koiFishPortrait.avif'

/**
 * CHAPTERS — the exhibition, one era per "room", media and text alternating sides
 * (Editorial Split). Each `image` is a placeholder stand-in drawn from the site's
 * existing assets; replace with the period painting/photo when available. Bodies
 * use backticks so Italian apostrophes need no escaping.
 */
const CHAPTERS = [
  {
    id: 'origine',
    index: '01',
    era: '1820 · NIIGATA',
    kicker: `起源 · L'ORIGINE`,
    title: 'Una mutazione tra le risaie',
    body: `Nelle valli innevate di Yamakoshi, i contadini di Niigata allevavano carpe nere — magoi — come riserva di cibo per i lunghi inverni. Tra il 1820 e il 1830 alcune iniziarono a tingersi di rosso e di bianco. Quei guizzi di colore, un capriccio della natura, furono conservati e incrociati con cura. Era nato il Nishikigoi.`,
    image: 'assets/collineInnevate.avif',
    alt: 'Le acque ferme delle risaie di Niigata, dove nacque il Nishikigoi',
    align: 'media-left',
  },
  {
    id: 'taisho',
    index: '02',
    era: '1914 · TŌKYŌ',
    kicker: '大正 · L’ERA TAISHŌ',
    title: 'Il giorno della rivelazione',
    body: `All'Esposizione di Tōkyō del 1914, Niigata presentò le sue carpe colorate all'intero Giappone. L'imperatore ne ricevette alcune per il laghetto del Palazzo Imperiale. Da curiosità contadina, il koi divenne simbolo nazionale — e una varietà, il Taishō Sanke, prese il nome proprio da quell'era.`,
    image: 'assets/BenkeiPortrait.avif',
    alt: 'Taishō Sanke — bianco, rosso e nero, la varietà nata nell’era Taishō',
    align: 'media-right',
  },
  {
    id: 'gosanke',
    index: '03',
    era: '1950 — 1970',
    kicker: '御三家 · IL GOSANKE',
    title: 'Le tre famiglie nobili',
    body: `Nel dopoguerra la selezione si fece arte. Si fissarono le tre stirpi che ancora oggi definiscono l'eccellenza — il Gosanke: Kohaku, Sanke e Showa. Non semplici pesci, ma linee di sangue: ogni allevatore custodiva la propria, tramandata di generazione in generazione come un segreto di bottega.`,
    image: 'assets/doubleKoiPortrait.avif',
    alt: 'Kohaku — bianco neve e rosso profondo, la più pura delle varietà',
    align: 'media-left',
  },
  {
    id: 'oggi',
    index: '04',
    era: 'OGGI · NEL MONDO',
    kicker: '世界 · SENZA CONFINI',
    title: 'Acqua senza confini',
    body: `Oggi un singolo esemplare può attraversare gli oceani e raggiungere cifre da capolavoro d'asta. I jumbo koi superano il metro di lunghezza, frutto di acque perfette e di una pazienza lunga decenni. Eppure il gesto resta quello del 1820: scegliere, attendere, assecondare. Il dialogo con l'acqua non è mai finito.`,
    image: 'assets/artigianoKoi.avif',
    alt: 'Un laghetto contemporaneo: l’arte del koi nel mondo di oggi',
    align: 'media-right',
  },
]

/**
 * GALLERY — the closing "atlas" of varieties, laid out as an Asymmetrical Bento.
 * `span` drives the grid footprint (see Storia.css).
 */
const GALLERY = [
  { id: 'kohaku', image: 'assets/kohakuV.avif', label: 'Kohaku · 紅白', alt: 'Kohaku', span: 'wide' },
  { id: 'sanke', image: 'assets/sankeV.avif', label: 'Taishō Sanke · 三色', alt: 'Taishō Sanke', span: 'tall' },
  { id: 'showa', image: 'assets/showaV.avif', label: 'Showa · 昭和', alt: 'Showa', span: 'std' },
  { id: 'tancho', image: 'assets/tanchoV.avif', label: 'Tanchō · 丹頂', alt: 'Tanchō', span: 'std' },
  { id: 'yamabuki', image: 'assets/yamabukiOgonV.avif', label: 'Yamabuki Ōgon · 山吹黄金', alt: 'Yamabuki Ōgon', span: 'wide' },
]

/**
 * Storia — "Due Secoli di Gioielli Viventi".
 *
 * A continuous, immersive vertical scroll built like a night-lit museum
 * exhibition (dark sumi-e ground, gold placards, heavy macro-whitespace). No
 * horizontal scroll: the visitor simply descends through 200 years.
 *
 * One `useGSAP` scope owns three behaviours, so @gsap/react reverts every tween
 * and kills every ScrollTrigger when the route unmounts (flawless cleanup):
 *   1. ENTRANCE — on mount the hero emerges from the dark void: eyebrow ▸ title ▸
 *      lead fade up from blur with a stagger, and the hero plate unmasks. This
 *      plays as the transition's void overlay dissolves above it.
 *   2. SCROLL REVEALS — each chapter / gallery group resolves from blur as it
 *      enters, its lines staggered.
 *   3. PARALLAX — every editorial plate's image drifts at its own pace inside its
 *      clipped wrap (ScrollTrigger scrub), so media and text move at different
 *      speeds down the page.
 *
 * prefers-reduced-motion gets the final, sharp, still layout — nothing hidden.
 */
export default function Storia() {
  const root = useRef(null)
  const navigate = useTransitionNavigate()

  useGSAP(
    () => {
      const section = root.current
      if (!section) return

      const heroBits = gsap.utils.toArray('[data-storia-hero]', section)
      const heroPlate = section.querySelector('.storia__hero-media .storia__image-wrap')
      const groups = gsap.utils.toArray('[data-storia-group]', section)
      const items = gsap.utils.toArray('[data-storia-item]', section)
      const parallax = gsap.utils.toArray('[data-parallax]', section)

      // --- Accessibility: land on the finished page, sharp and still ----------
      if (prefersReducedMotion()) {
        gsap.set([...heroBits, ...items], { autoAlpha: 1, y: 0, filter: 'blur(0px)' })
        if (heroPlate) gsap.set(heroPlate, { autoAlpha: 1, clipPath: 'inset(0%)' })
        parallax.forEach((wrap) => {
          const img = wrap.querySelector('img')
          if (img) gsap.set(img, { scale: 1, yPercent: 0 })
        })
        return
      }

      // --- 1. ENTRANCE — emerge from the void --------------------------------
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
      intro.fromTo(
        heroBits,
        { y: 42, autoAlpha: 0, filter: 'blur(14px)' },
        { y: 0, autoAlpha: 1, filter: 'blur(0px)', duration: 1.5, stagger: 0.14 },
        0.15,
      )
      if (heroPlate) {
        intro.fromTo(
          heroPlate,
          { autoAlpha: 0, clipPath: 'inset(14% 14% 14% 14% round 18px)' },
          { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0% round 18px)', duration: 1.7, ease: 'expo.out' },
          0.3,
        )
      }

      // --- 3. PARALLAX (created first so reveals layer cleanly on top) --------
      // Image pre-scaled 1.18 inside an overflow-hidden wrap; it glides on Y
      // across the full section travel — a different speed from the text.
      parallax.forEach((wrap, i) => {
        const img = wrap.querySelector('img')
        if (!img) return
        
        const drift = i % 2 === 0 ? 5 : -5 // DIMEZZATO IL MOVIMENTO
        gsap.fromTo(
          img,
          { yPercent: -drift, scale: 1.08 }, // ZOOM ABBASSATO AL 8%
          {
            yPercent: drift,
            scale: 1.08, // ZOOM ABBASSATO AL 8%
            ease: 'none',
            scrollTrigger: {
              trigger: wrap,
              start: 'top bottom',
              end: 'bottom top',
              scrub: 1.2,
              invalidateOnRefresh: true,
            },
          },
        )
      })

      // --- 2. SCROLL REVEALS — each group's items stagger in on enter --------
      groups.forEach((group) => {
        const groupItems = group.querySelectorAll('[data-storia-item]')
        gsap.fromTo(
          groupItems,
          { y: 32, autoAlpha: 0, filter: 'blur(10px)' },
          {
            y: 0,
            autoAlpha: 1,
            filter: 'blur(0px)',
            duration: 1.2,
            ease: 'power3.out',
            stagger: 0.12,
            scrollTrigger: { trigger: group, start: 'top 78%', once: true },
          },
        )
      })
    },
    { scope: root },
  )

  return (
    <article className="storia" ref={root}>
      {/* Fixed film-grain + vignette, pointer-events-none — texture without cost
          to any scrolling layer (per the performance guardrails). */}
      <div className="storia__grain" aria-hidden="true" />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header className="storia__hero">
        <div className="storia__hero-head">
          <div className="storia__back" data-storia-hero>
            <BezelButton
              label="Collezione"
              arrow="left"
              tone="ghost"
              onClick={() => navigate('/')}
              ariaLabel="Torna alla collezione"
            />
          </div>

          <p className="storia__eyebrow" data-storia-hero>
            錦鯉 · 1820 — OGGI
          </p>
          <h1 className="storia__title" data-storia-hero>
            Due Secoli di
            <br />
            <em>Gioielli Viventi</em>
          </h1>
          <p className="storia__lead" data-storia-hero>
            La storia del Nishikigoi è la storia di una mutazione diventata arte:
            duecento anni di pazienza, di acqua e di selezione, dalle risaie di
            Niigata alle vasche dei collezionisti di tutto il mondo.
          </p>
          <span className="storia__scroll-cue" data-storia-hero aria-hidden="true">
            Scorri per scendere nel tempo
          </span>
        </div>

        <figure className="storia__hero-media">
          <div className="storia__plate storia__plate--hero">
            <div className="storia__image-wrap" data-parallax>
              <img
                src={asset(HERO_IMAGE)}
                alt="L’acqua quieta di un laghetto di koi all’imbrunire"
                loading="eager"
                draggable="false"
              />
              <span className="storia__plate-label">1820 · NIIGATA</span>
            </div>
          </div>
        </figure>
      </header>

      {/* ── CHAPTERS (Editorial Split, alternating sides) ─────────────────── */}
      <div className="storia__chapters">
        {CHAPTERS.map((c) => (
          <section
            className={`storia__chapter storia__chapter--${c.align}`}
            key={c.id}
            data-storia-group
          >
            <figure className="storia__chapter-media">
              <div className="storia__plate">
                <div className="storia__image-wrap" data-parallax data-storia-item>
                  <img src={asset(c.image)} alt={c.alt} loading="lazy" draggable="false" />
                  <span className="storia__plate-label">{c.era}</span>
                </div>
              </div>
            </figure>

            <div className="storia__chapter-text">
              <span className="storia__chapter-index" data-storia-item>
                {c.index}
              </span>
              <p className="storia__chapter-kicker" data-storia-item>
                {c.kicker}
              </p>
              <h2 className="storia__chapter-title" data-storia-item>
                {c.title}
              </h2>
              <p className="storia__chapter-body" data-storia-item>
                {c.body}
              </p>
            </div>
          </section>
        ))}
      </div>

      {/* ── GALLERY (Asymmetrical Bento) ──────────────────────────────────── */}
      <section className="storia__gallery" data-storia-group>
        <div className="storia__gallery-head">
          <p className="storia__eyebrow" data-storia-item>
            図譜 · L’ATLANTE
          </p>
          <h2 className="storia__gallery-title" data-storia-item>
            Le varietà che hanno fatto la storia
          </h2>
        </div>

        <div className="storia__bento">
          {GALLERY.map((g) => (
            <figure
              className={`storia__bento-cell storia__bento-cell--${g.span}`}
              key={g.id}
              data-storia-item
            >
              <div className="storia__plate storia__plate--fill">
                <div className="storia__image-wrap">
                  <img src={asset(g.image)} alt={g.alt} loading="lazy" draggable="false" />
                  <figcaption className="storia__plate-label">{g.label}</figcaption>
                </div>
              </div>
            </figure>
          ))}
        </div>
      </section>

      {/* ── CLOSING ───────────────────────────────────────────────────────── */}
      <footer className="storia__closing" data-storia-group>
        <p className="storia__closing-kicker" data-storia-item>
          続く · IL DIALOGO CONTINUA
        </p>
        <h2 className="storia__closing-title" data-storia-item>
          Ogni nostra Koi porta con sé
          <br />
          duecento anni di pazienza.
        </h2>
        <div className="storia__closing-actions" data-storia-item>
          <BezelButton
            label="Torna alla Collezione"
            arrow="left"
            tone="gold"
            onClick={() => navigate('/')}
            ariaLabel="Torna alla collezione"
          />
        </div>
      </footer>
    </article>
  )
}

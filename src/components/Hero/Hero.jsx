import { Fragment, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  EASE,
  addFadeRise,
  addMaskReveal,
  prefersReducedMotion,
} from '../../utils/animations'
import { getFrameIndices, frameUrl, isMobileViewport } from '../../utils/frames'
import './Hero.css'

gsap.registerPlugin(useGSAP, ScrollTrigger)

const TITLE = 'jumboKoi'
const SUBTITLE = "L'arte dell'equilibrio, forma e respiro."

const GLASS_CARDS = [
  {
    id: 'water',
    kicker: '水 · Acqua',
    title: "L'Arte dell'Acqua",
    text: 'Ogni laghetto è un quadro vivente: specchi liquidi dove luce e movimento diventano contemplazione.',
    position: 'hero__glass-card--one',
  },
  {
    id: 'lineage',
    kicker: '血統 · Lignaggio',
    title: 'Genealogia Selezionata',
    text: 'Linee di sangue Nishikigoi tramandate per generazioni, scelte per portamento, colore ed equilibrio.',
    position: 'hero__glass-card--two',
  },
  {
    id: 'ecosystem',
    kicker: '庭 · Giardino',
    title: 'Ecosistemi su Misura',
    text: 'Habitat progettati come paesaggi in miniatura, in armonia silenziosa tra pietra, acqua e respiro.',
    position: 'hero__glass-card--three',
  },
]

// NB: the *length* of the scroll experience is owned by CSS, not JS.
// `.hero` is `(1 + --hero-track) * 100svh` tall and `.hero__sticky` is held in
// place by pure `position: sticky`. Keep `--hero-track` (Hero.css) in sync if you
// change how many screens of scrubbing you want. No GSAP pin is involved.
//
// The frame plan (full 192 on desktop, strided ~64 on mobile) lives in
// utils/frames and is shared with the preloader — see that file for why the
// mobile subset is non-negotiable (1080×1920 → ~7.9 MB decoded per frame).

export default function Hero() {
  const root = useRef(null)
  const stageRef = useRef(null)
  const canvasRef = useRef(null)

  useGSAP(
    () => {
      const isMobile = isMobileViewport()
      const canvas = canvasRef.current
      const stage = stageRef.current
      const ctx = canvas.getContext('2d')

      let viewW = 0
      let viewH = 0

      const sizeCanvas = () => {
        const dpr = window.devicePixelRatio || 1
        viewW = stage.clientWidth
        viewH = stage.clientHeight
        canvas.width = Math.round(viewW * dpr)
        canvas.height = Math.round(viewH * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }

      const drawCover = (img) => {
        if (!img || !img.complete || !img.naturalWidth) return
        const imgRatio = img.naturalWidth / img.naturalHeight
        const viewRatio = viewW / viewH
        let w, h, x, y
        if (viewRatio > imgRatio) {
          w = viewW
          h = viewW / imgRatio
          x = 0
          y = (viewH - h) / 2
        } else {
          h = viewH
          w = viewH * imgRatio
          x = (viewW - w) / 2
          y = 0
        }
        ctx.clearRect(0, 0, viewW, viewH)
        ctx.drawImage(img, x, y, w, h)
      }

      sizeCanvas()

      if (prefersReducedMotion()) {
        gsap.set('[data-reveal]', { yPercent: 0 })
        gsap.set('[data-fade]', { autoAlpha: 1, y: 0 })

        const still = new Image()
        still.onload = () => drawCover(still)
        still.src = frameUrl(0, isMobile)

        const onResizeStatic = () => {
          sizeCanvas()
          drawCover(still)
        }
        window.addEventListener('resize', onResizeStatic)

        return () => {
          window.removeEventListener('resize', onResizeStatic)
          still.onload = null
          still.src = ''
        }
      }

      // Strided frame set: every frame on desktop, ~64 of 192 on mobile. The
      // dense `frames` array is indexed 0…frameCount-1 and the scrub playhead
      // runs over THAT range, so the mapping stays correct no matter how many
      // frames were actually loaded. No `.decode()` — see utils/preloader.
      const indices = getFrameIndices(isMobile)
      const frameCount = indices.length
      const frames = new Array(frameCount)
      for (let n = 0; n < frameCount; n++) {
        const img = new Image()
        img.src = frameUrl(indices[n], isMobile)
        frames[n] = img
      }

      const playhead = { frame: 0 }
      const render = () => drawCover(frames[Math.round(playhead.frame)])

      if (frames[0].complete) render()
      else frames[0].addEventListener('load', render, { once: true })

      // --- Intro (plays once on load, NOT scrubbed) -------------------------
      const intro = gsap.timeline({ delay: 0.3, defaults: { ease: EASE.reveal } })
      addFadeRise(intro, '[data-fade="top"]', { duration: 1.6 })
      addMaskReveal(intro, '.hero__title [data-reveal]', { duration: 2, stagger: 0.06 }, '-=1.2')
      addMaskReveal(intro, '.hero__subtitle [data-reveal]', { duration: 1.6, stagger: 0.08 }, '-=1.5')
      addFadeRise(intro, '[data-fade="bottom"]', { duration: 1.3, stagger: 0.15 }, '-=1.1')

      // ---------------------------------------------------------------------
      //  ONE scrubbed master timeline. No GSAP pin: the hero is held in the
      //  viewport by pure CSS `position: sticky` (.hero__sticky). The whole
      //  `.hero` block is tall (see --hero-track), so scrolling through it maps
      //  1:1 onto this timeline's progress 0 → 1. Because there is no pin and
      //  no second trigger, the video scrub and the 3D push-back are simply two
      //  segments of the SAME timeline — they can never fight over concatenation.
      // ---------------------------------------------------------------------
      const master = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root.current,
          start: 'top top',          // hero top reaches viewport top
          end: 'bottom bottom',      // hero bottom reaches viewport bottom
          scrub: 1.2,                // = exactly the full sticky travel
          invalidateOnRefresh: true,
        },
      })

      // 1) Frame sequence — unrolls over the first half of the scroll. Targets
      //    the loaded-frame count (not the raw 192), so the strided mobile set
      //    still scrubs from the first to the true last frame.
      master.to(
        playhead,
        { frame: frameCount - 1, duration: 0.5, onUpdate: render },
        0,
      )

      // 2) Hero UI clears almost instantly as soon as the wheel moves.
      master.to(
        ['.hero__topbar', '.hero__content'],
        {
          autoAlpha: 0,
          yPercent: -18,
          ease: 'power2.in',
          duration: 0.05,
          immediateRender: false,
        },
        0,
      )

      // 3) Glass cards drift in, slightly delayed.
      master.fromTo(
        '.hero__glass-card',
        { autoAlpha: 0, y: 100 },
        {
          autoAlpha: 1,
          y: 0,
          ease: 'power3.out',
          duration: 0.22,
          stagger: 0.05,
          immediateRender: false,
        },
        0.1,
      )

      // 4) 3D PUSH-BACK — the hero sinks into the dark and the Collection
      //    (next sibling, higher z-index, solid bg, pulled up by -100svh)
      //    slides over it. Ends at progress 1, i.e. the exact instant the
      //    sticky element un-sticks and the Collection has fully risen. No gap,
      //    no premature blackout: the darkening is *synchronised* to the cover.
      master.fromTo(
        stage,
        { scale: 1, yPercent: 0, filter: 'brightness(1)', borderRadius: '0px' },
        {
          scale: 0.9,
          yPercent: 40,
          filter: 'brightness(0.2)',
          borderRadius: '32px',
          ease: 'power2.inOut',
          duration: 0.38,
          immediateRender: false,
        },
        0.62,
      )

      const onResize = () => {
        sizeCanvas()
        render()
      }
      window.addEventListener('resize', onResize)

      return () => {
        window.removeEventListener('resize', onResize)
        // Release every frame so the bitmaps are eligible for GC the instant the
        // Hero unmounts (critical on memory-tight phones): drop the load handler,
        // blank the src, then null the reference.
        frames[0]?.removeEventListener?.('load', render)
        for (let i = 0; i < frames.length; i++) {
          if (frames[i]) {
            frames[i].onload = null
            frames[i].src = ''
          }
          frames[i] = null
        }
      }
    },
    { scope: root },
  )

  return (
    <section className="hero" id="home" ref={root}>
      <div className="hero__sticky">
        <div className="hero__stage" ref={stageRef}>
          <canvas className="hero__canvas" ref={canvasRef} aria-hidden="true" />

          <div className="hero__glass">
            {GLASS_CARDS.map((card) => (
              <article key={card.id} className={`hero__glass-card ${card.position}`}>
                <span className="hero__glass-kicker">{card.kicker}</span>
                <h2 className="hero__glass-title">{card.title}</h2>
                <p className="hero__glass-text">{card.text}</p>
              </article>
            ))}
          </div>

          <header className="hero__topbar" data-fade="top">
            <span className="hero__brand">jumboKoi</span>
            <span className="hero__meta">錦鯉 · NISHIKIGOI &amp; BONSAI</span>
          </header>

          <div className="hero__content">
            <p className="hero__eyebrow" data-fade="top">
              京都 — Collezione 2026
            </p>

            <h1 className="hero__title">
              <SplitText text={TITLE} by="char" reveal="title" />
            </h1>

            <p className="hero__subtitle">
              <SplitText text={SUBTITLE} by="word" reveal="subtitle" />
            </p>

            <div className="hero__cue" data-fade="bottom">
              <span className="hero__cue-line" />
              <span className="hero__cue-label">Scorri</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function SplitText({ text, by = 'word', reveal }) {
  const tokens = by === 'char' ? Array.from(text) : text.split(' ')

  return (
    <span className="split" aria-label={text}>
      {tokens.map((token, i) => (
        <Fragment key={`${token}-${i}`}>
          <span className="mask" aria-hidden="true">
            <span className="mask__inner" data-reveal={reveal}>
              {token}
            </span>
          </span>
          {by === 'word' && i < tokens.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </span>
  )
}

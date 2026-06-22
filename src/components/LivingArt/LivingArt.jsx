import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './LivingArt.css'

// Self-contained registration — idempotent, mirrors every other section.
gsap.registerPlugin(useGSAP, ScrollTrigger)

/** Resolve a `/public` asset against Vite's base URL — the project-wide idiom.
 *  When the Python backend / CDN goes live, swap this single line and nothing in
 *  the view changes. */
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

/* ---------------------------------------------------------------------------
   CLIENT MEDIA — swap these two constants for the real villa footage.
   ---------------------------------------------------------------------------
   VILLA_MEDIA  — the hero clip the aperture opens onto. Drop a high-res, muted,
                  loop-friendly .mp4 (or .webm) into /public/assets and point here.
   VILLA_POSTER — the first frame shown until the video can play (and the still
                  that remains if the .mp4 isn't present yet). It is wired to an
                  existing pond image so the aperture is NEVER an empty black slit
                  before the client supplies their own footage — replace with a
                  poster frame of the villa when available.
   ------------------------------------------------------------------------- */
const VILLA_MEDIA_DESKTOP = 'assets/KoiArchitect.mp4'
const VILLA_MEDIA_MOBILE = 'assets/KoiArchitect-mobile.mp4';
const VILLA_POSTER = 'assets/VILLAKOI.avif'

/* ---------------------------------------------------------------------------
   THE APERTURE VOCABULARY (clip-path on the media wrapper)

   Two `inset()` rectangles with an IDENTICAL token structure, so GSAP's core
   interpolates the four numbers number-for-number — exactly the contract the
   route-transition curtain and Bespoke's `circle()` ink-drop already rely on
   (no MorphSVG / no plugin). Top+bottom start deeper (34%) than left+right (26%),
   so the resting state is a wide cinematic SLIT that irises OUT to a full bleed.
   ------------------------------------------------------------------------- */
const SLIT = 'inset(34% 26% 34% 26%)' // a heavily-cropped letterbox window
const OPEN = 'inset(0% 0% 0% 0%)' //      the media has swallowed the screen

// How far the section stays PINNED while the aperture opens, the title leaves and
// the copy resolves (in % of the viewport height). Generous, so nothing snaps.
const PIN_LENGTH = '170%'

/**
 * LivingArt — "The Cinematic Aperture".
 *
 * The emotional climax that sits between the technical Atelier (warm washi paper)
 * and the closing Bespoke CTA: the lights dim for the film. A 100svh dark theatre
 * holds a giant serif "Living Art" with a single cropped SLIT of the villa footage
 * glowing at its centre. As the visitor scrolls, the section PINS and the slit
 * irises open — purely via `clip-path` (NEVER width/height, so zero layout
 * thrashing) — until the footage fills the screen. The giant title then lifts
 * away and the editorial copy resolves over the full-bleed image, before the
 * section unpins into the inquiry CTA.
 *
 * ZERO-LAG ARCHITECTURE
 * ---------------------
 *   · Only `clip-path` (+ a settling `scale` on the inner video) animates — both
 *     paint/composite ops, no reflow. The media wrapper rides its OWN compositor
 *     layer (`will-change: clip-path, transform; translateZ(0)`; see the CSS), so
 *     re-clipping never repaints the page beneath it.
 *   · GSAP interpolates the `inset()` numbers directly — the proven in-repo idiom.
 *   · `invalidateOnRefresh: true` so the pin re-measures when TransitionProvider
 *     calls `ScrollTrigger.refresh()` after every route change, and on resize.
 *
 * ACCESSIBILITY
 * -------------
 * `prefers-reduced-motion` disables the pin AND the clip-path iris entirely: the
 * footage is simply shown full-bleed with the title + copy laid calmly over it.
 */
export default function LivingArt() {
  const root = useRef(null)
  const frameRef = useRef(null)
  const mediaRef = useRef(null)
  const videoRef = useRef(null)
  const titleRef = useRef(null)
  const scrimRef = useRef(null)

  useGSAP(
    () => {
      const frame = frameRef.current
      const media = mediaRef.current
      const video = videoRef.current
      const title = titleRef.current
      const scrim = scrimRef.current
      if (!frame || !media) return

      // The copy lines resolve together (kicker → lead) once the image is full.
      const copyItems = gsap.utils.toArray('[data-living-reveal]', frame)

      // React can drop the `muted` DOM property; force it so autoplay is allowed,
      // then nudge playback (a no-op if it's already running / harmless if the
      // placeholder .mp4 isn't there yet).
      if (video) {
        video.muted = true
        video.play?.().catch(() => {})
      }

      const mm = gsap.matchMedia()

      // MOTION — the pinned cinematic aperture.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: frame,
            start: 'top top',
            end: `+=${PIN_LENGTH}`,
            pin: true,
            scrub: 1, // a touch of lag → the heavy, liquid "silk" feel of the site
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        })

        tl
          // 1 — the slit irises out to a full bleed (clip-path ONLY)…
          .fromTo(
            media,
            { clipPath: SLIT, webkitClipPath: SLIT },
            { clipPath: OPEN, webkitClipPath: OPEN, ease: 'power2.inOut', duration: 0.6 },
            0,
          )
          // …while the footage settles from a slow push-in (compositor transform).
          .fromTo(video, { scale: 1.2 }, { scale: 1, ease: 'power2.out', duration: 0.62 }, 0)
          // 2 — the giant title leans in as the aperture opens…
          .fromTo(title, { scale: 1 }, { scale: 1.06, ease: 'sine.inOut', duration: 0.54 }, 0)
          // …then lifts away once the image owns the screen.
          .to(
            title,
            { autoAlpha: 0, yPercent: -12, filter: 'blur(10px)', ease: 'power2.in', duration: 0.18 },
            0.54,
          )
          // 3 — the legibility scrim breathes in under the incoming copy…
          .fromTo(scrim, { autoAlpha: 0 }, { autoAlpha: 1, ease: 'none', duration: 0.3 }, 0.5)
          // …and the editorial lines resolve out of a soft blur, gently staggered.
          .fromTo(
            copyItems,
            { autoAlpha: 0, y: 36, filter: 'blur(12px)' },
            {
              autoAlpha: 1,
              y: 0,
              filter: 'blur(0px)',
              ease: 'power3.out',
              duration: 0.3,
              stagger: 0.07,
            },
            0.64,
          )
      })

      // REDUCED MOTION — no pin, no iris: the footage is simply full-bleed and the
      // title + copy rest over it, sharp and still.
      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set(media, { clipPath: OPEN, webkitClipPath: OPEN })
        gsap.set(video, { scale: 1 })
        gsap.set(scrim, { autoAlpha: 1 })
        gsap.set(title, { autoAlpha: 1 })
        gsap.set(copyItems, { autoAlpha: 1, y: 0, filter: 'blur(0px)' })
      })

      return () => mm.revert()
    },
    { scope: root },
  )

  return (
    <section className="living" id="living-art" ref={root}>
      {/* The pinned 100svh theatre. Everything inside is layered absolutely so the
          aperture (clip-path) reveals the copy that is ALREADY composited above it. */}
      <div className="living__frame" ref={frameRef}>
        {/* The aperture: a clipped wrapper (clip-path animates HERE) around the
            footage. aria-hidden — it is pure atmosphere. */}
        <div className="living__media" ref={mediaRef} aria-hidden="true">
          <video
            className="living__video"
            ref={videoRef}
            src={window.innerWidth < 768 ? asset(VILLA_MEDIA_MOBILE) : asset(VILLA_MEDIA_DESKTOP)}
            poster={asset(VILLA_POSTER)}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        </div>

        {/* Legibility scrim — invisible during the slit phase, breathes in to seat
            the copy over the full-bleed footage. */}
        <div className="living__scrim" ref={scrimRef} aria-hidden="true" />

        {/* The giant serif centrepiece — present from the first frame, lifts away
            once the footage owns the screen. */}
        <h2 className="living__title" ref={titleRef} aria-label="Living Art">
          <span className="living__title-word" aria-hidden="true">
            Living
          </span>
          <span className="living__title-word living__title-word--accent" aria-hidden="true">
            Art
          </span>
        </h2>

        {/* The editorial payoff — resolves over the full footage. */}
        <div className="living__copy">
          <span className="living__rule" data-living-reveal aria-hidden="true" />
          <p className="living__kicker" data-living-reveal>
            山水 · Architettura e Natura
          </p>
          <p className="living__lead" data-living-reveal>
            Dove l&apos;acqua incontra l&apos;architettura, ogni dimora si fa
            paesaggio. Disegniamo laghetti e giardini d&apos;acqua su misura per le
            residenze più esclusive — il lusso silenzioso di custodire un frammento
            di natura viva.
          </p>
        </div>
      </div>
    </section>
  )
}

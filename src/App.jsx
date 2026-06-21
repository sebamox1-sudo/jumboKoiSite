import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import Preloader from './components/Preloader/Preloader'
import Hero from './components/Hero/Hero'
import Collection from './components/Collection/Collection'
import Philosophy from './components/Philosophy/Philosophy'
import Bonsai from './components/Bonsai/Bonsai'
import Atelier from './components/Atelier/Atelier'
import Bespoke from './components/Bespoke/Bespoke'
import Footer from './components/Footer/Footer'
import CustomCursor from './components/CustomCursor/CustomCursor'
import { prefersReducedMotion } from './utils/animations'
import { collectCriticalAssets, preloadAll } from './utils/preloader'
import { Analytics } from '@vercel/analytics/react';

// Registered once at the app root so every section's ScrollTrigger shares the
// same instance (registerPlugin is idempotent if a section registers it too).
gsap.registerPlugin(useGSAP, ScrollTrigger)

// Hard ceiling on the curtain: if the network drags (or an asset 404s in a way
// that somehow stalls), never hold the visitor hostage — reveal the site anyway.
const LOAD_TIMEOUT_MS = 10000

/**
 * App shell. Intentionally thin and presentational — the backend will be Python,
 * so the frontend stays fully decoupled and API-ready. New sections (Storia,
 * Atelier…) drop in below as they're built.
 *
 * Boot sequence
 * -------------
 * 1. A Preloader "curtain" is shown first and warms the heavy assets (the 192
 *    Hero frames, the Collection koi, the Atelier morph layers) — see
 *    utils/preloader. It reports REAL progress; nothing is faked.
 * 2. When the assets are ready (or the 10s timeout fires) `loaded` flips true:
 *    the site mounts and GSAP fades the whole wrapper in, while the curtain plays
 *    its own dissolve and then unmounts itself (`curtainGone`).
 * 3. prefers-reduced-motion skips the curtain and the fade entirely — the site
 *    appears immediately.
 *
 * Smooth scrolling is owned here, at the root, so every pinned/scrubbed section
 * shares one momentum model. Lenis is driven off GSAP's ticker (rather than its
 * own rAF loop) and reports every frame to `ScrollTrigger.update`, so Lenis and
 * ScrollTrigger advance in perfect lockstep — without this, pinned sections jitter.
 */
function App() {
  const [reduced] = useState(prefersReducedMotion)
  const [loaded, setLoaded] = useState(reduced)
  const [progress, setProgress] = useState(0)
  const [curtainGone, setCurtainGone] = useState(reduced)
  const [failedCount, setFailedCount] = useState(0)

  // Wrapper the entrance fade animates. MUST be declared — it's referenced by the
  // useGSAP below and by <main ref={mainRef}>; without it the app throws as soon
  // as `loaded` flips true.
  const mainRef = useRef(null)

  // Aggiungi questo stato per scaglionare il montaggio
  const [mounted, setMounted] = useState(false);

  // --- Warm the heavy assets, then lift the curtain --------------------------
  // THIS is the step that was missing: nothing ever started the preload or set
  // `loaded`, so the curtain hung forever. We start the real preload on mount,
  // report fractional progress, and ALWAYS finish — either when every asset has
  // settled (load or error) or when the 10s hard ceiling fires. `finish()` is
  // idempotent so the timeout and the natural completion can't double-fire.
  useEffect(() => {
    if (reduced) return // reduced-motion already booted with loaded = true

    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timeoutId)
      setLoaded(true)
    }

    // Safety net: never hold the visitor hostage if the network drags.
    const timeoutId = setTimeout(() => {
      console.warn(`[preloader] LOAD_TIMEOUT_MS (${LOAD_TIMEOUT_MS}ms) reached — revealing site anyway`)
      finish()
    }, LOAD_TIMEOUT_MS)

    const assets = collectCriticalAssets()
    console.log(`[preloader] warming ${assets.length} assets…`)

    preloadAll(assets, (p, loadedN, total, failed) => {
      setProgress(p)
      setFailedCount(failed)
    })
      .then(() => {
        console.log('[preloader] all assets settled — lifting curtain')
        finish()
      })
      .catch((err) => {
        // preloadAll never rejects, but stay defensive: a throw here must NOT
        // strand the curtain. Reveal the site regardless.
        console.error('[preloader] unexpected error — revealing site anyway', err)
        finish()
      })

    return () => clearTimeout(timeoutId)
  }, [reduced])

  useEffect(() => {
    if (loaded) {
      // Aspetta 200ms dopo che il preloader è finito prima di montare i componenti pesanti
      const timer = setTimeout(() => setMounted(true), 200);
      return () => clearTimeout(timer);
    }
  }, [loaded]);

  // --- Site entrance: fade the whole wrapper in once it mounts ---------------
  useGSAP(
    () => {
      if (!loaded || !mainRef.current) return
      if (reduced) {
        gsap.set(mainRef.current, { autoAlpha: 1 })
        return
      }
      gsap.fromTo(
        mainRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 1.2, ease: 'power2.out' },
      )
    },
    { dependencies: [loaded, reduced] },
  )

  // --- Smooth scrolling (Lenis ⇄ GSAP ticker ⇄ ScrollTrigger) ----------------
  useEffect(() => {
    // Honour reduced-motion: skip smooth scrolling entirely and let the browser
    // scroll natively (ScrollTrigger falls back to the native scroll position).
    if (reduced) return

    // MOBILE / TOUCH: do NOT run Lenis. It installs a permanent rAF + transform
    // layer and, on iOS, competes with the OS's own momentum and rubber-band
    // (and with the address-bar show/hide that resizes the viewport). That fight
    // is a re-layout/jank source we don't want on phones. Touch devices get pure
    // native scrolling; ScrollTrigger reads the native scroll position directly,
    // so every pinned/scrubbed section keeps working — just without Lenis.
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(pointer: coarse)').matches ||
        window.innerWidth < 768)
    if (isTouch) return

    // `anchors` makes Lenis itself intercept in-page links (the Footer sitemap)
    // and smooth-scroll to them with its own momentum, instead of the browser's
    // instant jump. Empty-hash links (`href="#"`, e.g. the legal placeholders)
    // have no target hash, so Lenis ignores them. expo.out easing = a calm,
    // water-like settle consistent with the rest of the site.
    const lenis = new Lenis({
      anchors: {
        offset: 0,
        duration: 1.6,
        easing: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
      },
    })

    // Keep ScrollTrigger's cached positions in sync with Lenis on every scroll.
    lenis.on('scroll', ScrollTrigger.update)

    // Drive Lenis from GSAP's ticker (gsap time is seconds → Lenis wants ms).
    const tick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    // Lenis manages its own smoothing; GSAP's lag smoothing would fight it.
    gsap.ticker.lagSmoothing(0)

    return () => {
      gsap.ticker.remove(tick)
      gsap.ticker.lagSmoothing(500, 33) // restore GSAP's default
      lenis.destroy()
    }
  }, [reduced])

  return (
    <>
      {/* Global liquid-silk cursor. Self-disables on touch devices and lives above
          every layer (sections, Lenis, the preloader curtain), so it's present from
          the very first frame. */}
      <CustomCursor />

      {!curtainGone && (
        <Preloader
          progress={progress}
          isComplete={loaded}
          failedCount={failedCount}
          onExited={() => setCurtainGone(true)}
        />
      )}

      {/* Monta solo quando mounted è true */}
      {mounted && (
        <main ref={mainRef}>
          <Hero />
          <Collection />
          <Philosophy />
          <Bonsai />
          <Atelier />
          <Bespoke />
          <Footer />
        </main>
      )}

      <Analytics />
    </>
  )
}

export default App

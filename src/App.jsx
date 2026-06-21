import { useEffect, useRef, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Preloader from './components/Preloader/Preloader'
import CustomCursor from './components/CustomCursor/CustomCursor'
import { TransitionProvider } from './transitions/TransitionProvider'
import Home from './pages/Home'
import Storia from './pages/Storia/Storia'
import { prefersReducedMotion } from './utils/animations'
import { collectCriticalAssets, preloadAll } from './utils/preloader'
import { Analytics } from '@vercel/analytics/react'

// Registered once at the app root so every section's ScrollTrigger shares the
// same instance (registerPlugin is idempotent if a section registers it too).
gsap.registerPlugin(useGSAP, ScrollTrigger)

// Hard ceiling on the curtain: if the network drags (or an asset 404s in a way
// that somehow stalls), never hold the visitor hostage — reveal the site anyway.
const LOAD_TIMEOUT_MS = 10000

/**
 * App shell. Intentionally thin and presentational — the backend will be Python,
 * so the frontend stays fully decoupled and API-ready.
 *
 * It now owns three things only:
 *   1. The Preloader "curtain" + the real asset warm-up (unchanged).
 *   2. The router: `/` → Home (the original scroll experience), `/storia` → Storia.
 *   3. The TransitionProvider, which owns Lenis + the cinematic "void" route
 *      transition (see transitions/TransitionContext). Smooth scrolling moved
 *      there so the exit timeline can freeze and thaw it.
 *
 * Boot sequence
 * -------------
 * 1. A Preloader curtain warms the heavy assets (Hero frames, Collection koi…).
 * 2. When ready (or the 10s timeout fires) `loaded` flips: the routes mount and
 *    GSAP fades the wrapper in while the curtain dissolves (`curtainGone`).
 * 3. prefers-reduced-motion skips the curtain and the fade entirely.
 */
function App() {
  const [reduced] = useState(prefersReducedMotion)
  const [loaded, setLoaded] = useState(reduced)
  const [progress, setProgress] = useState(0)
  const [curtainGone, setCurtainGone] = useState(reduced)
  const [failedCount, setFailedCount] = useState(0)

  // Wrapper the entrance fade animates.
  const mainRef = useRef(null)

  // Stagger the heavy mount one frame past the curtain lift.
  const [mounted, setMounted] = useState(false)

  // --- Warm the heavy assets, then lift the curtain --------------------------
  useEffect(() => {
    if (reduced) return // reduced-motion already booted with loaded = true

    let done = false
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timeoutId)
      setLoaded(true)
    }

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
        console.error('[preloader] unexpected error — revealing site anyway', err)
        finish()
      })

    return () => clearTimeout(timeoutId)
  }, [reduced])

  useEffect(() => {
    if (loaded) {
      const timer = setTimeout(() => setMounted(true), 200)
      return () => clearTimeout(timer)
    }
  }, [loaded])

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

  return (
    <TransitionProvider>
      {/* Global liquid-silk cursor — present from the very first frame. */}
      <CustomCursor />

      {!curtainGone && (
        <Preloader
          progress={progress}
          isComplete={loaded}
          failedCount={failedCount}
          onExited={() => setCurtainGone(true)}
        />
      )}

      {/* Mount the routed app only once the curtain is lifting. */}
      {mounted && (
        <main ref={mainRef}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/storia" element={<Storia />} />
          </Routes>
        </main>
      )}

      <Analytics />
    </TransitionProvider>
  )
}

export default App

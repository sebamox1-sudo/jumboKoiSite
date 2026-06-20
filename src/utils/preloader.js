/**
 * Real asset preloading for the jumboKoi "curtain".
 *
 * The Preloader doesn't fake progress with a timer — it warms the exact images
 * the first screens need, so by the time the curtain lifts the Hero frame
 * sequence, the Collection koi and the Atelier morph are already in the browser
 * HTTP cache and paint without a flash. The frame plan (count, folders, names,
 * mobile subset) is imported from utils/frames so it can NEVER drift from what
 * the Hero actually draws — every `new Image()` the sections make is a cache hit.
 *
 * ⚠️ MEMORY DISCIPLINE — read before touching this file
 * -----------------------------------------------------
 * We deliberately DO NOT call `img.decode()` here. `.decode()` forces the browser
 * to allocate the full uncompressed RGBA bitmap (~7.9 MB per 1080×1920 frame) and
 * keep it resident. Doing that across all 192 frames in parallel = ~1.48 GB, which
 * instantly OOM-kills the iOS Safari tab and triggers the "A problem repeatedly
 * occurred" reload loop. Warming the *bytes* into the HTTP cache (what `onload`
 * signals) is all we need; the browser decodes each frame lazily, one at a time,
 * when the Hero canvas actually draws it. Keep it that way.
 */

import { getFrameIndices, frameUrl, isMobileViewport } from './frames'

// Mirror of each section's `asset()` idiom (Collection/Atelier/Philosophy).
const asset = (path) => `${import.meta.env.BASE_URL}${path}`

// The five cut-out koi (Collection.jsx) and the two Atelier morph layers.
const COLLECTION_IMAGES = [
  'assets/Kohaku.png',
  'assets/taisho sanke.png',
  'assets/Showa.png',
  'assets/tancho.png',
  'assets/Yamabuki Ogon.png',
]

const ATELIER_IMAGES = ['assets/blueprint.png', 'assets/final-pond.png']

/**
 * The full list of heavy assets to warm before lifting the curtain, in priority
 * order (Hero frames first — they're what the visitor sees the instant the
 * curtain lifts). On mobile we warm ONLY the strided frame subset the Hero will
 * actually draw (see utils/frames), so we never download or hold ~190 frames a
 * phone can't afford.
 */
export function collectCriticalAssets() {
  const isMobile = isMobileViewport()

  const frames = getFrameIndices(isMobile).map((i) => frameUrl(i, isMobile))

  return [...frames, ...COLLECTION_IMAGES.map(asset), ...ATELIER_IMAGES.map(asset)]
}

/**
 * Load one image. Resolves on load AND on error — a single 404 must never stall
 * the curtain. Resolves with `{ src, ok }` so the caller can count failures
 * without ever rejecting. No `.decode()` (see the memory note at the top).
 */
function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image()
    let settled = false
    const settle = (ok) => {
      if (settled) return
      settled = true
      if (!ok) console.warn('[preloader] ✗ FAILED (asset mancante / 404?):', src)
      // Detach handlers and drop the src so the Image isn't kept alive by the
      // event wiring after it has done its job (helps GC on memory-tight phones).
      img.onload = null
      img.onerror = null
      resolve({ src, ok })
    }
    img.onload = () => settle(true)
    img.onerror = () => settle(false)
    img.src = src
  })
}

/**
 * Run `preloadImage` over every URL with a hard cap on how many are in flight at
 * once. Unbounded parallelism (199 simultaneous requests + Image objects) is its
 * own mobile hazard — this keeps the network and the live-object count sane while
 * still being plenty fast. Never rejects.
 */
async function preloadPool(urls, concurrency, onSettle) {
  let cursor = 0
  const worker = async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++]
      const res = await preloadImage(url)
      onSettle(res)
    }
  }
  const lanes = Math.max(1, Math.min(concurrency, urls.length))
  await Promise.all(Array.from({ length: lanes }, worker))
}

/**
 * Warm every URL, reporting fractional progress (0 → 1) as each settles.
 * Resolves once they have all settled. NEVER rejects and NEVER hangs.
 *
 * @param {string[]} urls
 * @param {(progress: number, loaded: number, total: number, failed: number) => void} [onProgress]
 * @returns {Promise<void>}
 */
export function preloadAll(urls, onProgress) {
  const total = urls.length
  if (total === 0) {
    onProgress?.(1, 0, 0, 0)
    return Promise.resolve()
  }

  let settled = 0
  let failed = 0

  // Fewer parallel sockets on phones (typically a single shared Wi-Fi link to
  // the dev box), a few more on desktop where bandwidth and CPU are plentiful.
  const concurrency = isMobileViewport() ? 4 : 8

  return preloadPool(urls, concurrency, (res) => {
    settled += 1
    if (res && res.ok === false) failed += 1
    onProgress?.(settled / total, settled, total, failed)
  }).then(() => {
    if (failed > 0) {
      console.warn(`[preloader] done — ${failed}/${total} asset(s) failed to load (proceeding anyway)`)
    } else {
      console.log(`[preloader] done — all ${total} assets loaded`)
    }
    return undefined
  })
}

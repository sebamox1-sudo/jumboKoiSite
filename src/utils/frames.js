/**
 * Single source of truth for the Hero frame sequence.
 *
 * Both the Preloader (which WARMS the frames) and the Hero (which DRAWS them)
 * import from here, so the URLs warmed are byte-for-byte the URLs drawn — every
 * `new Image()` the Hero creates is therefore a guaranteed cache hit, and we can
 * never accidentally warm 192 desktop frames while the Hero draws a mobile subset.
 *
 * WHY A MOBILE SUBSET EXISTS
 * --------------------------
 * Each frame is 1080×1920. Decoded to an uncompressed bitmap that is
 * 1080 * 1920 * 4 ≈ 7.9 MB. Holding all 192 resident at once ≈ 1.48 GB — far past
 * the point where iOS Safari kills the tab's web-content process (the dreaded
 * "A problem repeatedly occurred" reload loop). On phones we therefore load a
 * strided subset (every 3rd frame ≈ 64 frames); the scrub still reads smoothly
 * because the canvas only ever shows one frame at a time.
 */

export const FRAME_COUNT = 192

// Every Nth frame on phones. 3 → 64 frames → ~64 × 7.9 MB worst-case decode
// budget instead of ~1.48 GB. Tune up (smoother) / down (lighter) here only.
export const MOBILE_FRAME_STEP = 3

// One breakpoint, used everywhere, so "mobile" means the same thing in the
// preloader, the Hero canvas and the frame plan.
export const MOBILE_BREAKPOINT = 768

export const isMobileViewport = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT

/**
 * The exact, ordered list of frame indices to load and draw on this device.
 * Desktop → all 192. Mobile → every Nth, with the final frame always appended so
 * the very end of the scroll scrub lands on the true last frame (no visual snap).
 *
 * @param {boolean} isMobile
 * @returns {number[]}
 */
export function getFrameIndices(isMobile) {
  const step = isMobile ? MOBILE_FRAME_STEP : 1
  const indices = []
  for (let i = 0; i < FRAME_COUNT; i += step) indices.push(i)
  if (indices[indices.length - 1] !== FRAME_COUNT - 1) indices.push(FRAME_COUNT - 1)
  return indices
}

/**
 * Resolve a single frame's URL the same way every section resolves `/public`
 * assets (`import.meta.env.BASE_URL`). Point BASE_URL at the CDN when the Python
 * backend goes live and the frames keep resolving with no other change.
 */
export const frameUrl = (i, isMobile) => {
  const folder = isMobile ? 'camera-frames-mobile' : 'camera-frames-desktop'
  return `${import.meta.env.BASE_URL}${folder}/ezgif-frame-${String(i + 1).padStart(3, '0')}.webp`
}

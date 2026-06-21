import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { prefersReducedMotion } from '../../utils/animations'
import './Footer.css'

// Self-contained registration — idempotent, mirrors every other section.
gsap.registerPlugin(useGSAP, ScrollTrigger)

// In-page anchors. The matching ids live on each section's <section> element.
const SITEMAP = [
  { label: 'Home', href: '#home' },
  { label: 'Collection', href: '#collection' },
  { label: 'Philosophy', href: '#philosophy' },
  { label: 'Atelier', href: '#atelier' },
]

const LEGAL = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Cookie Policy', href: '#' },
]

/**
 * Footer — the site's slow exhale into the dark.
 *
 * Deliberately the SAME nocturnal ink ground as Bespoke (#12100F = --bespoke-ink),
 * so there is no seam: the visitor simply keeps sliding to the bottom of the page.
 * Pure typography + negative space (Sumi-e calm), one hairline divider, and the
 * developer signature as the final flourish. On enter, the text blocks emerge
 * from the dark with a slow upward stagger (honouring prefers-reduced-motion).
 */
export default function Footer() {
  const root = useRef(null)
  const year = new Date().getFullYear()

  useGSAP(
    () => {
      const reveals = gsap.utils.toArray('[data-footer-reveal]', root.current)

      // Reduced motion: everything present and still, no emergence.
      if (prefersReducedMotion()) {
        gsap.set(reveals, { autoAlpha: 1, y: 0 })
        return
      }

      // Slow "emersione dal buio": y:20 + fade → settle, gently staggered.
      gsap.fromTo(
        reveals,
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 1.1,
          ease: 'power3.out',
          stagger: 0.12,
          scrollTrigger: { trigger: root.current, start: 'top 85%', once: true },
        },
      )
    },
    { scope: root },
  )

  return (
    <footer className="footer" ref={root}>
      <div className="footer__inner">
        {/* Main area — big typographic logo + tagline | navigation grid. */}
        <div className="footer__top">
          <div className="footer__brand">
            <p className="footer__logo" data-footer-reveal>
              jumboKoi
            </p>
            <p className="footer__tagline" data-footer-reveal>
              L&apos;arte del silenzio in acqua.
            </p>
          </div>

          <nav className="footer__nav" aria-label="Navigazione del sito">
            <div className="footer__col" data-footer-reveal>
              <h2 className="footer__col-title">Sitemap</h2>
              <ul className="footer__list">
                {SITEMAP.map((link) => (
                  <li key={link.label}>
                    <a className="footer__link" href={link.href}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="footer__col" data-footer-reveal>
              <h2 className="footer__col-title">Note Legali</h2>
              <ul className="footer__list">
                {LEGAL.map((link) => (
                  <li key={link.label}>
                    <a className="footer__link" href={link.href}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>

        {/* Copyright area — hairline divider, copyright | developer signature. */}
        <div className="footer__bottom">
          <p className="footer__copy" data-footer-reveal>
            © {year} jumboKoi. Tutti i diritti riservati.
          </p>

          <p className="footer__signature" data-footer-reveal>
            Design by{' '}
            <a
              className="footer__signature-link"
              href="https://sebamox.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              sebamox
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}

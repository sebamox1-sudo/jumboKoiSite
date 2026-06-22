import Hero from '../components/Hero/Hero'
import Collection from '../components/Collection/Collection'
import Philosophy from '../components/Philosophy/Philosophy'
import Bonsai from '../components/Bonsai/Bonsai'
import Atelier from '../components/Atelier/Atelier'
import LivingArt from '../components/LivingArt/LivingArt'
import Bespoke from '../components/Bespoke/Bespoke'
import Footer from '../components/Footer/Footer'

/**
 * Home — the original single-scroll experience, now mounted as the `/` route.
 *
 * Nothing here changed except its home: the section stack was lifted out of App so
 * App can become a thin router shell (preloader + cursor + the transition void).
 * Each section still owns its own GSAP scope, so React Router unmounting Home on a
 * route change reverts every tween and kills every ScrollTrigger automatically.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <Collection />
      <Philosophy />
      <Bonsai />
      <Atelier />
      <LivingArt />
      <Bespoke />
      <Footer />
    </>
  )
}

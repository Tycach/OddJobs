import { useEffect, useState } from "react"
import type { Role } from "../../demo/model"
import { SponsoredAd } from "../../shared/components/WorkspaceUi"
import "./landing.css"

function Mark({ name, size = 20 }: { name: string; size?: number }) {
  const shapes: Record<string, React.ReactNode> = {
    arrow: <><path d="M4 12h15" /><path d="m13 5 7 7-7 7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    shield: <><path d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5Z" /><path d="m8 12 2.5 2.5L16 9" /></>,
    message: <path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" />,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3M3 12h18" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    people: <><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 4a4 4 0 0 1 0 8M18 15a6 6 0 0 1 4 6" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] ?? shapes.check}</svg>
}

const categories = ["Cleaning", "Plumbing", "Electrical", "Care", "Grooming", "Tutoring", "Moving", "Repairs"]

export default function LandingPage({ onSignIn, onLogin }: { onSignIn: () => void; onLogin: (role: Role) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("landing-visible")
          observer.unobserve(entry.target)
        }
      })
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" })
    document.querySelectorAll(".landing-section-heading, .landing-step, .landing-audience-card, .landing-trust-grid article, .landing-faq-list details, .landing-location-card, .landing-final-cta-inner").forEach((item) => {
      item.classList.add("landing-reveal")
      observer.observe(item)
    })
    return () => observer.disconnect()
  }, [])
  const closeMenu = () => setMenuOpen(false)
  const goTo = (role: Role) => { closeMenu(); onLogin(role) }

  return <div className="landing-page">
    <a className="landing-skip" href="#landing-main">Skip to content</a>
    <header className="landing-header">
      <div className="landing-container landing-header-inner">
        <a className="landing-logo" href="/" aria-label="OddJobs home"><img src="/oddjobs-logo.png" alt="OddJobs.com — Building doors where none exist." /></a>
        <button className="landing-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="landing-navigation" onClick={() => setMenuOpen((open) => !open)}><Mark name={menuOpen ? "close" : "menu"} /></button>
        <nav id="landing-navigation" className={`landing-nav ${menuOpen ? "landing-nav-open" : ""}`} aria-label="Main navigation">
          <a href="#how-it-works" onClick={closeMenu}>How it works</a>
          <a href="#for-hirers" onClick={closeMenu}>For hirers</a>
          <a href="#for-workers" onClick={closeMenu}>For workers</a>
          <a href="#questions" onClick={closeMenu}>FAQs</a>
          <button type="button" className="landing-signin" onClick={() => { closeMenu(); onSignIn() }}>Sign in</button>
          <button type="button" className="landing-button landing-button-small" onClick={() => goTo("consumer")}>Get started <Mark name="arrow" size={17} /></button>
        </nav>
      </div>
    </header>

    <main id="landing-main">
      <section className="landing-hero">
        <div className="landing-container landing-hero-grid">
          <div className="landing-hero-copy">
            <span className="landing-kicker"><span className="landing-kicker-dot" /> Work, made easier</span>
            <h1>Find a hand.<br /><em>Get it done.</em></h1>
            <p className="landing-hero-lede">OddJobs brings people who need work done together with workers ready to do it—right in one place.</p>
            <div className="landing-hero-actions">
              <button type="button" className="landing-button" onClick={() => goTo("consumer")}>I need a job done <Mark name="arrow" /></button>
              <button type="button" className="landing-button landing-button-outline" onClick={() => goTo("provider")}>I’m looking for work <Mark name="arrow" /></button>
            </div>
            <div className="landing-hero-points"><span><Mark name="check" size={17} /> Post a job or bid on one</span><span><Mark name="check" size={17} /> Keep the conversation job-linked</span></div>
          </div>
          <div className="landing-hero-art">
            <div className="landing-art-orbit landing-art-orbit-one" />
            <div className="landing-art-orbit landing-art-orbit-two" />
            <img src="/oddjobs-auth-art.jpg" alt="OddJobs connects hirers with workers across home and business services." />
            <div className="landing-art-note"><span className="landing-art-note-icon"><Mark name="people" /></span><span><strong>Your needs. Our network.</strong><small>Find the right people for the work.</small></span></div>
          </div>
        </div>
        <div className="landing-container landing-category-wrap">
          <p>Work across the things that keep life moving</p>
          <div className="landing-category-list">{categories.map((category, index) => <span key={category}><i>{String(index + 1).padStart(2, "0")}</i>{category}</span>)}</div>
        </div>
      </section>

      <section className="landing-section landing-how" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-heading"><span className="landing-eyebrow">A simpler way to get started</span><h2>Good work starts with a clear plan.</h2><p>From the first job post to the final confirmation, keep the important details together.</p></div>
          <div className="landing-steps">
            <article className="landing-step"><span className="landing-step-number">01</span><span className="landing-step-icon"><Mark name="briefcase" size={23} /></span><h3>Describe the job</h3><p>Share what needs doing, where the work is, and when you need it done.</p></article>
            <article className="landing-step"><span className="landing-step-number">02</span><span className="landing-step-icon"><Mark name="people" size={23} /></span><h3>Compare proposals</h3><p>Review worker profiles and bids, then choose the offer that suits your job.</p></article>
            <article className="landing-step"><span className="landing-step-number">03</span><span className="landing-step-icon"><Mark name="check" size={23} /></span><h3>Keep work on track</h3><p>Message about the job, follow progress, and record payment confirmation.</p></article>
          </div>
        </div>
      </section>

      <section className="landing-section landing-ad-section" aria-label="Sponsored offers"><div className="landing-container"><div className="landing-ad-heading"><span className="landing-eyebrow">Offers from our partners</span><h2>Useful services for your next job.</h2></div><SponsoredAd placement="customer_landing" /></div></section>

      <section className="landing-section landing-audiences">
        <div className="landing-container">
          <div className="landing-section-heading landing-section-heading-left"><span className="landing-eyebrow">Two sides. One place.</span><h2>Whether you’re hiring or working, there’s a clear next step.</h2></div>
          <div className="landing-audience-grid">
            <article className="landing-audience-card landing-hirer-card" id="for-hirers">
              <div className="landing-audience-top"><span className="landing-audience-icon"><Mark name="briefcase" size={24} /></span><span className="landing-audience-label">For hirers</span></div>
              <h3>Get the help you need.</h3><p>Post the work once, hear from interested workers, and choose who you want to hire.</p>
              <ul><li><Mark name="check" /> Describe the job and share the area</li><li><Mark name="check" /> Review bids and worker profiles</li><li><Mark name="check" /> Keep job messages and payment records together</li></ul>
              <button type="button" className="landing-text-link" onClick={() => goTo("consumer")}>Post your first job <Mark name="arrow" /></button>
            </article>
            <article className="landing-audience-card landing-worker-card" id="for-workers">
              <div className="landing-audience-top"><span className="landing-audience-icon"><Mark name="search" size={24} /></span><span className="landing-audience-label">For workers</span></div>
              <h3>Find work that fits.</h3><p>Build your profile, discover jobs, and send a proposal with your price and availability.</p>
              <ul><li><Mark name="check" /> Set up your profile and service area</li><li><Mark name="check" /> Browse jobs and submit proposals</li><li><Mark name="check" /> Track accepted work and confirmed earnings</li></ul>
              <button type="button" className="landing-text-link" onClick={() => goTo("provider")}>Explore worker workspace <Mark name="arrow" /></button>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-location-section">
        <div className="landing-container landing-location-card">
          <div className="landing-location-copy"><span className="landing-eyebrow">Work in your area</span><h2>Make nearby opportunities easier to find.</h2><p>Workers can set a service area and share an approximate location to sort nearby jobs. Hirers can describe a neighborhood so workers can judge whether a job is a good fit.</p><button type="button" className="landing-button landing-button-light" onClick={() => goTo("provider")}>Browse jobs <Mark name="arrow" /></button></div>
          <div className="landing-map-art" aria-hidden="true"><div className="landing-map-ring landing-map-ring-a"/><div className="landing-map-ring landing-map-ring-b"/><div className="landing-map-ring landing-map-ring-c"/><span className="landing-map-pin landing-map-pin-a"><Mark name="pin" size={17}/></span><span className="landing-map-pin landing-map-pin-b"><Mark name="pin" size={17}/></span><span className="landing-map-pin landing-map-pin-c"><Mark name="pin" size={17}/></span><span className="landing-map-center"><i/><b>Your area</b></span><span className="landing-map-caption">Approximate location</span></div>
        </div>
      </section>

      <section className="landing-section landing-trust">
        <div className="landing-container landing-trust-grid">
          <div className="landing-trust-intro"><span className="landing-eyebrow">Clarity at every step</span><h2>Keep the details close to the work.</h2><p>OddJobs gives hirers and workers a shared place to make decisions and keep track of what they agreed.</p></div>
          <article><span><Mark name="message" /></span><h3>Job-linked messages</h3><p>Keep conversations connected to the job and the people involved.</p></article>
          <article><span><Mark name="shield" /></span><h3>Profiles to review</h3><p>See worker profile details and available reviews while comparing proposals.</p></article>
          <article><span><Mark name="clock" /></span><h3>Payment records</h3><p>Record agreed amounts and confirmations so both sides can refer back to the job.</p></article>
        </div>
      </section>

      <section className="landing-section landing-faq" id="questions">
        <div className="landing-container landing-faq-grid">
          <div className="landing-section-heading landing-section-heading-left"><span className="landing-eyebrow">A few helpful answers</span><h2>Questions before you begin?</h2><p>Here’s what to expect when you use OddJobs.</p><button type="button" className="landing-text-link" onClick={onSignIn}>Choose a workspace <Mark name="arrow" /></button></div>
          <div className="landing-faq-list">
            <details><summary>How do I hire someone?</summary><p>Create a hirer account, post a job with the work details, then review proposals and choose a worker.</p></details>
            <details><summary>How do workers find jobs?</summary><p>Workers create a profile, choose a service area, browse available jobs, and submit proposals for work they want to do.</p></details>
            <details><summary>Can I message about a job?</summary><p>Job conversations are connected to a specific job and identify the worker or hirer taking part.</p></details>
            <details><summary>Does OddJobs process payments?</summary><p>Payment agreements and confirmations can be recorded in the app. Cash and manual transfers are handled between the parties; automated payment processing is not currently available.</p></details>
          </div>
        </div>
      </section>

      <section className="landing-final-cta"><div className="landing-container landing-final-cta-inner"><div><span className="landing-eyebrow">Let’s get to work</span><h2>Make your next job easier.</h2><p>Join OddJobs as a hirer or a worker and take the next step.</p></div><div className="landing-final-actions"><button type="button" className="landing-button landing-button-light" onClick={() => goTo("consumer")}>I’m hiring <Mark name="arrow" /></button><button type="button" className="landing-button landing-button-dark" onClick={() => goTo("provider")}>I’m looking for work <Mark name="arrow" /></button></div></div></section>
    </main>

    <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-main"><a className="landing-logo" href="/" aria-label="OddJobs home"><img src="/oddjobs-logo.png" alt="OddJobs.com" /></a><p>Connecting people who need work done with workers ready to do it.</p><button type="button" className="landing-footer-signin" onClick={onSignIn}>Sign in to your workspace <Mark name="arrow" size={17} /></button></div><div className="landing-footer-bottom"><span>© {new Date().getFullYear()} OddJobs.com</span><span>Find. Hire. Get it done.</span><a href="#landing-main">Back to top ↑</a></div></div></footer>
  </div>
}

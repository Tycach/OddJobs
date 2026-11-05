import { useEffect, useRef } from "react"

type TermsDialogProps = {
  open: boolean
  policy: "terms" | "privacy"
  onClose: () => void
  onReadToEnd: () => void
}

export const POLICY_VERSIONS = {
  terms: "2026-11-05-v1",
  privacy: "2026-11-05-v1",
} as const

const termsSections = [
  {
    title: "1. About these terms",

    paragraphs: [
      "These Terms & Conditions explain how you may use OddJobs.com and its services. By creating an account or using the platform, you agree to these terms. If you do not agree, do not create an account or use the platform.",

      "OddJobs connects people seeking local services with people offering them. The platform may include profiles, service requests, offers, bookings, communications, reviews, and related account features. Features available to you may depend on your location and account type.",
    ],
  },

  {
    title: "2. Your account",

    paragraphs: [
      "Give accurate, current information when you register and keep it up to date. You are responsible for keeping your sign-in details secure and for activity carried out through your account. Tell OddJobs promptly if you believe someone else has accessed your account.",

      "Use one account for yourself unless OddJobs has approved another arrangement. Do not impersonate another person, misrepresent your identity or qualifications, or use the platform if applicable law prohibits you from doing so.",
    ],
  },

  {
    title: "3. Customers and service providers",

    paragraphs: [
      "Customers are responsible for describing their requested work clearly, reviewing offers, agreeing the scope and timing directly through the available booking flow, and providing safe and lawful access to the work location.",

      "Service providers are responsible for the services they offer, their qualifications and licences where required, their own tools and work practices, and carrying out agreed work safely and lawfully. An application or profile review does not itself guarantee a provider's identity, qualifications, suitability, or work quality.",

      "Unless a separate written agreement says otherwise, service providers are independent businesses or individuals and are not OddJobs employees. OddJobs does not direct how a provider performs a service.",
    ],
  },

  {
    title: "4. Bookings, prices, and payments",

    paragraphs: [
      "Before confirming a booking, review the service description, agreed scope, price, timing, and any cancellation or payment conditions shown in the platform. Those booking details apply to that transaction. Do not proceed if the details are unclear; resolve them with the other party first.",

      "Any platform fee, provider charge, payment method, or refund condition that applies will be shown in the relevant flow or communicated before you commit. Do not assume a price, fee, payment, refund, or cancellation right that has not been disclosed. Keep records of booking and payment communications.",

      "Contact OddJobs through the support options provided in the platform if a booking or payment issue cannot be resolved with the other party. Any mandatory consumer rights under applicable law remain unaffected.",
    ],
  },

  {
    title: "5. Safe and acceptable use",

    paragraphs: [
      "You must not use OddJobs to break the law, threaten or harass anyone, discriminate unlawfully, post misleading or fraudulent content, offer prohibited services, interfere with the platform, or access another person's account or information without permission.",

      "Do not share another person's private information, upload content you do not have permission to use, or send harmful software or unwanted solicitations. Follow reasonable safety precautions when meeting or working with someone you met through the platform.",
    ],
  },

  {
    title: "6. Profiles, messages, and reviews",

    paragraphs: [
      "You retain ownership of content you submit. You give OddJobs permission to host, display, and use that content as needed to operate, secure, and improve the platform and connect users. Remove content you are no longer entitled to share and notify us if you believe content infringes your rights.",

      "Reviews and other public content must be honest, relevant, and based on your genuine experience. OddJobs may remove content that violates these terms or applicable law.",
    ],
  },

  {
    title: "7. The role and limits of OddJobs",

    paragraphs: [
      "OddJobs provides a platform to help users find and communicate with one another. Unless a specific service is expressly described otherwise, OddJobs is not a party to the service agreement between a customer and a provider and does not guarantee that a job will be accepted, completed, or meet a particular standard.",

      "We work to keep the platform available and reliable, but cannot promise uninterrupted or error-free access. We may update, suspend, or discontinue a feature where reasonably necessary for maintenance, safety, legal compliance, or platform operation.",
    ],
  },

  {
    title: "8. Suspension and account closure",

    paragraphs: [
      "You may stop using the platform and request account closure through the available account or support options. OddJobs may restrict or suspend access where reasonably necessary to protect users, investigate suspected misuse, comply with law, or enforce these terms. Where appropriate, we will provide notice and an opportunity to address the issue.",

      "Closing an account does not remove obligations or rights relating to bookings already made, payments already due, or matters that by their nature continue after closure.",
    ],
  },

  {
    title: "9. Liability",

    paragraphs: [
      "Nothing in these terms excludes or limits liability or consumer rights that cannot lawfully be excluded or limited. To the extent allowed by applicable law, OddJobs is not responsible for a user's independent conduct, a service arranged directly between users, or losses caused by information a user provided that was inaccurate.",

      "You remain responsible for assessing whether a service, provider, or booking is suitable for your needs and for taking appropriate precautions.",
    ],
  },

  {
    title: "10. Changes and applicable law",

    paragraphs: [
      "We may update these terms as the platform or applicable requirements change. We will make the current version available here and indicate when it was last updated. If a change materially affects your use, we will provide notice where reasonably practicable. Continued use after an update takes effect means you accept the updated terms; if you do not agree, stop using the platform.",

      "These terms are subject to the laws that apply where you use OddJobs, including applicable Kenyan law. Any dispute will be handled by a court or other process with jurisdiction under applicable law.",
    ],
  },

  {
    title: "11. Contact",

    paragraphs: [
      "For questions about these terms or help with an account, use the support options available through OddJobs.",
    ],
  },
]

const privacySections = [
  {
    title: "1. Who we are and this policy",
    paragraphs: [
      "This Privacy Policy explains how OddJobs.com handles personal information when you use our local-services marketplace. It applies to customers, service providers, applicants, and visitors. The policy is a product draft and must be reviewed and completed by OddJobs' privacy/legal advisers before production use.",
      "OddJobs currently provides prototype and marketplace features for accounts, service discovery, provider applications, job requests, offers, messaging, bookings, reviews, and support. Some screens may show sample data or simulated features rather than live transactions.",
    ],
  },
  {
    title: "2. Information we collect",
    paragraphs: [
      "Account information may include your name, email address or phone number, account identifiers, account type, authentication and verification status, and preferences. Passwords and authentication credentials are handled by the configured authentication provider and are not stored in the OddJobs application database.",
      "Marketplace information may include service profiles and applications, job descriptions, service location details you choose to provide, offers, booking and payment status, messages, reviews, and support requests. Do not include sensitive personal information unless it is necessary for the service.",
      "Technical information may include device and browser details, IP address and request metadata in security logs, session data, and information needed to diagnose errors or protect the service. The web app may store authentication session data and prototype/demo content in your browser's local or session storage.",
      "We do not intentionally collect precise location continuously. A location or address is collected when you choose to provide it as part of a service request or profile.",
    ],
  },
  {
    title: "3. How we use information",
    paragraphs: [
      "We use information to create and secure accounts, provide marketplace features, connect customers and providers, process and support bookings, review provider applications, respond to requests, prevent fraud and abuse, maintain platform safety, troubleshoot and improve the service, and meet legal obligations.",
      "We use personal information only where there is an appropriate legal basis, such as providing a service you request, complying with a legal obligation, protecting users and the platform, or your consent where required. You may withdraw consent where processing relies on it, without affecting processing already carried out.",
    ],
  },
  {
    title: "4. How information is shared",
    paragraphs: [
      "Information needed to arrange a service may be shown to the relevant customer or provider, such as profile details, job details, messages, and booking information. Consider what you share before posting or messaging.",
      "We use service providers to support authentication, hosting, databases, communications, security, and platform operations. For example, the configured Supabase service may process account and authentication data. We require appropriate safeguards from service providers where applicable.",
      "We may disclose information where required by law, to respond to valid legal requests, to protect users or rights, or as part of a business transfer with appropriate safeguards. We do not sell personal information as a data-broker product.",
    ],
  },
  {
    title: "5. International processing",
    paragraphs: [
      "Our service providers may process information in countries other than the country where you live. Where cross-border processing occurs, OddJobs should use the safeguards required by applicable data-protection law. The specific hosting regions and transfer arrangements must be confirmed before production.",
    ],
  },
  {
    title: "6. Retention and deletion",
    paragraphs: [
      "We keep personal information only for as long as reasonably needed for the purposes described in this policy, including providing the service, keeping appropriate transaction and consent records, resolving disputes, preventing abuse, and meeting legal requirements. Retention periods depend on the type of information and applicable law.",
      "You may request account closure or deletion through the support options available in OddJobs. Some information may need to be retained or restricted rather than immediately erased, where required or permitted by law. Specific retention periods and deletion procedures must be published before production.",
    ],
  },
  {
    title: "7. Security",
    paragraphs: [
      "We use technical and organisational measures intended to protect information, including access controls and secure service configurations. No online service can guarantee absolute security. Use a unique password, protect your devices, and contact OddJobs promptly if you suspect account misuse.",
    ],
  },
  {
    title: "8. Your choices and rights",
    paragraphs: [
      "Depending on applicable law, you may have rights to request access to, correction or deletion of your personal information, object to or restrict certain processing, receive a copy of information, or withdraw consent. You may also have the right to complain to the relevant data-protection authority, including the Office of the Data Protection Commissioner in Kenya.",
      "To exercise a right or ask a privacy question, contact OddJobs through the support options provided in the platform. We may need to verify your identity and will respond in accordance with applicable law.",
    ],
  },
  {
    title: "9. Children",
    paragraphs: [
      "OddJobs is not designed for children who are not legally able to enter into the relevant service arrangements. Do not create an account or provide a child's personal information unless a parent or legal guardian is permitted to do so under applicable law.",
    ],
  },
  {
    title: "10. Cookies, storage, and third parties",
    paragraphs: [
      "The app uses browser storage to maintain authentication sessions and, in the prototype, may save demo marketplace data on your device. Authentication, hosting, and other integrated services may use cookies or similar technologies under their own privacy notices. Production cookie and analytics practices should be documented before those features are enabled.",
      "Links to third-party services are governed by those services' own privacy policies. OddJobs is not responsible for third-party privacy practices outside its control.",
    ],
  },
  {
    title: "11. Changes and contact",
    paragraphs: [
      "We may update this policy as the service or legal requirements change. We will publish the current version and update its date. If changes materially affect how information is handled, we will provide notice where required.",
      "For privacy questions or requests, use the support options available through OddJobs. Before production, OddJobs must publish a monitored privacy contact and complete this policy with its legal entity details, hosting regions, retention periods, and complaint process.",
    ],
  },
]

export default function TermsDialog({
  open,
  policy,
  onClose,
  onReadToEnd,
}: TermsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()

    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    contentRef.current?.scrollTo(0, 0)
  }, [open, policy])

  const handleScroll = () => {
    const content = contentRef.current

    if (!content) return

    if (content.scrollTop + content.clientHeight >= content.scrollHeight - 8) {
      onReadToEnd()
    }
  }

  const isTerms = policy === "terms"
  const title = isTerms ? "Terms & Conditions" : "Privacy Policy"
  const sections = isTerms ? termsSections : privacySections

  return (
    <dialog
      ref={dialogRef}
      className="terms-dialog"
      aria-labelledby="terms-dialog-title"
      aria-describedby="terms-dialog-description"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="terms-dialog-card">
        <header className="terms-dialog-header">
          <div>
            <p className="eyebrow">OddJobs.com</p>
            <h2 id="terms-dialog-title">{title}</h2>
            <p id="terms-dialog-description">
              Version {POLICY_VERSIONS[policy]} · Last updated: 5 November 2026
            </p>
          </div>
          <button
            type="button"
            className="terms-dialog-close"
            aria-label={`Close ${title}`}
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </header>
        <div
          ref={contentRef}
          className="terms-dialog-content"
          onScroll={handleScroll}
        >
          {sections.map((section) => (
            <section key={section.title}>
              <h3>{section.title}</h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
        <footer className="terms-dialog-footer">
          <p>Read to the end to enable the agreement checkbox.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => dialogRef.current?.close()}
          >
            Return to sign up
          </button>
        </footer>
      </div>
    </dialog>
  )
}

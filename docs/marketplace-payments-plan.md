# Marketplace Payments and Commission Plan

**Status:** Research and engineering proposal, not a legal opinion or a
provider commitment. Research reviewed on 2026-10-30. Confirm product features,
pricing, country eligibility, and legal requirements with providers and Kenyan
counsel before accepting real money.

## Executive Recommendation

OddJobs should operate as a **platform-collected marketplace**: customers pay
through OddJobs' approved payment-provider arrangement, OddJobs records the
worker's payable amount, and payout is initiated only after completion and the
applicable dispute window. Do not direct clients to pay workers privately by
default. Do not call the arrangement "escrow" or hold customer money in an
ordinary operating account until counsel and the payment partner confirm the
structure and customer-facing claims.

This gives OddJobs control of commission collection and payout timing, but also
makes OddJobs responsible for more operational risk: payment disputes, refunds,
payout failures, fraud, settlement liquidity, reconciliation, and potential
regulatory obligations. Prefer a provider-supported marketplace or
payment-facilitation setup if available for the Kenyan entity and use case.

## What the Existing Prototype Does

Checkout records a simulated payment in browser state, the review screen
simulates release, the provider wallet simulates withdrawal, and the dispute
console records a local decision. There is no backend, ledger, provider
callback, real payout, or authentication boundary. The 10% fee shown at
checkout is client-side presentation logic; it is not enforceable or an
accounting record. See `src/App.tsx` and `README.md` before implementing real
flows.

## Marketplace Patterns and What to Borrow

### Bolt and Uber: transparency and predictable earnings

Bolt's public driver pages advertise upfront fare information, earnings
overviews, periodic statements, and weekly payouts in many cities. Its general
earnings page says the share varies by market; a generalized percentage must
not be treated as the Kenya rate. Review Bolt's Kenya-specific terms and current
driver statements before setting OddJobs policy.

Uber's Kenya driver payments page describes automatic bank transfers and how a
driver adds payout details. Public Uber pages vary by region and do not
establish a single global commission or debt-enforcement rule. Do not copy a
percentage, restriction threshold, or cash-collection policy from another
market.

Transferable product lessons:

- Show the customer total and exact fee breakdown before confirmation.
- Show workers the gross job amount, OddJobs fee, payment/provider fees if
  charged to them, net payable, and expected payout date.
- Provide per-job statements and a searchable transaction history, not just a
  wallet balance.
- Explain adjustments, refunds, tips, promotions, and dispute holds separately.
- Make payout timing and exceptions predictable; notify workers when status
  changes.

Sources: [Bolt driver earnings](https://bolt.eu/en/driver/earn/), [Bolt driver
payments](https://bolt.eu/en/driver/), [Uber Kenya: how payments
work](https://www.uber.com/ke/en/drive/basics/how-payments-work/).

### Provider Models

| Provider/model | Publicly documented | Fit and caveat |
| --- | --- | --- |
| Safaricom Daraja C2B + B2C | C2B can notify a business of customer payments; B2C sends money to a mobile-money customer and returns the final result asynchronously. Production B2C requires the applicable bulk-disbursement/shortcode setup. | Strong Kenya rail candidate for collection plus disbursement. This is not by itself a marketplace escrow/ledger product. Confirm account structure, settlement, reversals, reconciliation, and rules for keeping worker proceeds pending. |
| Paystack Kenya | Paystack documents M-Pesa acceptance for Kenya, split payments through subaccounts, and transfers as available to Kenyan businesses. | Strong discovery candidate. Public split-payment docs describe allocation at payment; they do not prove delayed job-conditioned release or all worker payout destinations. Confirm marketplace approval, hold/release controls, KYC, fees, refunds, disputes, and liability in writing. |
| Stripe Connect | Connect documents direct, destination, and separate charge/transfer models. For platform-collected models, the platform may carry fees, refunds, and dispute balances. Stripe's country page lists Kenya via its Paystack extended network. | Do not assume direct Stripe Connect marketplace features or eligibility for a Kenya-incorporated OddJobs entity from the extended-network listing. Ask about the exact legal entity, Connect availability, M-Pesa, and delayed transfers. |
| Adyen for Platforms | Adyen documents onboarding, verification, payment splits, payout control, and reporting. Its published supported-marketplace country list does not include Kenya. | Not a Kenya launch assumption; revisit only if Adyen confirms written eligibility for OddJobs' entity and flow. |

Sources: [Daraja C2B](https://developer.safaricom.co.ke/apis/CustomerToBusiness),
[Daraja B2C](https://developer.safaricom.co.ke/apis/BusinessToCustomer),
[Paystack split payments](https://paystack.com/docs/payments/split-payments/),
[Paystack transfers](https://paystack.com/docs/transfers/), [Stripe charge
models](https://docs.stripe.com/connect/charges), [Stripe marketplace
tasks](https://docs.stripe.com/connect/marketplace/essential-tasks), [Stripe
country availability](https://stripe.com/global), [Adyen
marketplaces](https://docs.adyen.com/marketplaces/).

## Commission Design

Settle the meaning of the quote before choosing a percentage. A quote must say
whether it is the worker's gross service amount, worker's expected net, or the
customer's all-in amount. Do not use "commission," "protection fee," and
"processing fee" interchangeably.

For a first paid pilot, use one explicit commission model and show all sides.
A provider-commission example (10% is illustrative only):

| Line | Example |
| --- | ---: |
| Agreed service price | KES 2,300 |
| OddJobs commission (10% example) | KES 230 |
| Worker payable before disclosed adjustments | KES 2,070 |
| Customer total | KES 2,300 plus only separately disclosed fees/tax |

If the business instead charges the current prototype's buyer-side 10% fee,
label it as an explicit customer service/protection fee and pay the worker the
full agreed quote, less only deductions that were agreed. Do **not** charge a
buyer fee and also deduct a worker commission unless both fees, recipients, and
the resulting net are disclosed before booking. The example percentage is not
a market recommendation; test willingness to pay and contribution margin after
payment costs, refunds, support, incentives, fraud, and taxes.

Define these server-side rules in a versioned fee schedule:

- Fee base and treatment of tax, materials, tips, and add-ons.
- Percentage/flat fee, minimum/maximum, currency, rounding, and effective date.
- Who bears collection and payout costs.
- Changed quotes, partial completion, cancellation, refunds, and tips.
- Whether a commission adjustment can be offset from future earnings, subject
  to contract and legal review.

## Recommended Money and Job Lifecycle

1. **Quote accepted:** freeze customer-facing price, worker expected net, fee
   schedule version, cancellation terms, and provider identity.
2. **Payment initiated:** create a unique server-side payment record and start
   the provider flow or M-Pesa prompt.
3. **Payment confirmed:** use a verified callback or provider status query.
   API acceptance/redirect is not proof of final collection. Match the job,
   amount, currency, and provider transaction ID. Process duplicate callbacks
   idempotently.
4. **Funds accounted for:** post balanced entries to an append-only ledger.
   Record customer funds, worker payable, OddJobs revenue, provider cost,
   refunds, and reserves separately. A database balance field is not a ledger.
5. **Job in progress:** show current job/payment state. Do not create a second
   charge for the same booking without an explicit change order.
6. **Completion requested:** worker marks work complete and attaches permitted
   evidence. Notify the customer and allow a clearly stated review window.
7. **Dispute or release:** open a dispute hold when a valid dispute arrives
   before release. Otherwise mark worker funds payout-eligible at the agreed
   release condition. Support decisions create auditable adjustments; never
   silently rewrite the original payment.
8. **Payout initiated:** send a uniquely keyed provider payout request. Track
   pending, successful, failed, and reversed states using callbacks/status
   queries. Initial API acceptance is not final payout success.
9. **Reconcile:** compare provider records, settlement reports, platform
   ledger, and bank/M-Pesa statements daily. Escalate unmatched, duplicate,
   late, and negative-balance entries.

Suggested statuses: `payment_pending`, `paid`, `held`, `completion_pending`,
`dispute_hold`, `payout_eligible`, `payout_pending`, `paid_out`,
`payout_failed`, `refund_pending`, and `refunded`. State transitions belong on
the server and should be explicit and auditable.

## Non-Remittance and Account Policy

### Preferred rule: no off-platform settlement

For the pilot, require customers to pay through OddJobs. Do not ask customers to
pay workers cash or transfer directly to them. This reduces uncollected
commission and gives both sides one source of truth. Checkout must state the
payment method and fees before booking.

### If cash must be allowed later

Cash is a separate product/risk decision, not just another button. The customer
may pay the worker directly, so a customer-side "paid" button is not verified
evidence. Record the job as cash and the resulting balance; require a clear,
contractually accepted collection arrangement. Prefer a provider-authorized
payment method over informal manual collection.

Use a graduated, reviewable process for a confirmed unpaid fee or collection
debt:

1. Reconcile the job and fee; distinguish failed collection, customer
   disagreement, provider dispute, duplicate, and intentional evasion.
2. Notify the worker with job ID, amount, calculation, due date, evidence, and
   a way to challenge the entry. Allow reasonable time for correction/payment.
3. If undisputed and overdue, use only a previously disclosed and legally
   reviewed offset from future payable earnings, where provider and law permit.
   Show every offset as a ledger entry; do not silently net balances.
4. Restrict acceptance of new jobs when the verified overdue balance passes a
   disclosed threshold or age, with notice and a fast support/appeal path.
5. Suspend or terminate only for repeated or deliberate evasion after review,
   notice, and an appeal opportunity. Preserve records and settle unrelated,
   undisputed worker earnings on schedule where legally required.
6. Escalate suspected fraud or material disputes to trained operations staff;
   never let a single admin click silently seize unrelated earnings.

Do not make worker payouts a general-purpose debt-collection tool. Never hold
unrelated or undisputed earnings indefinitely as leverage without contract,
provider authorization, and legal review. Account restrictions should be
proportionate and explainable, with human review for contested balances.

## Transparency Requirements

### Customer checkout and receipt

Show agreed service price, customer-paid fees, taxes where applicable, total
charged, payment method, job reference, refund/cancellation terms, and whether
payment is pending, confirmed, or under dispute hold. Do not promise "escrow"
or "held safely" unless the provider/legal structure supports that claim.

### Worker earnings statement

For every job, show gross agreed price, commission rate/amount, taxes and
provider charges if applicable, tips, adjustments, net amount due, hold reason,
release condition/date, payout reference, and final payout result. Let workers
review statements by date and job. Show the fee schedule before they accept
work and notify them before a fee change takes effect.

### Admin and finance controls

Use maker-checker approval for manual refunds, balance adjustments, and large
payouts. Restrict roles, record actor/reason/timestamp, preserve original
entries, alert on unusual payout volume or repeated failures, and reconcile
daily. A support agent should not be able to edit ledger entries or change
provider credentials.

## Production Architecture

The React/Vite app remains a presentation client. Production money movement
needs a trusted API and database, not additional browser state.

- **API:** authenticated customer/provider/admin actions; server-side
  authorization, validation, fee calculation, and state transitions.
- **Data:** relational records for jobs, fee schedule versions, payment
  attempts, provider transactions, ledger entries, disputes, payout
  destinations, and audit events.
- **Ledger:** immutable double-entry postings using integer minor currency
  units and explicit currency; corrections use reversing/adjusting entries.
- **Payment adapter:** `collect`, `verify`, `refund`, `payout`, and `query`
  ports; provider IDs and webhook formats stay inside adapters.
- **Webhook processing:** verify authenticity where supported, persist events
  safely, deduplicate by provider/event ID, enqueue processing, and return
  quickly. Retry transient errors; send exhausted failures for review.
- **Outbox/worker:** transactionally queue notifications and payout work;
  enforce idempotency so a retry cannot create a second payout.
- **Reconciliation:** scheduled import/polling, exact reference matching,
  unmatched-total alerts, and resolution before financial close.
- **Secrets/data:** server-side secret manager, least privilege, encrypted
  payout/identity data, retention rules, audit access, backups, and incident
  response.

Keep cleanup incremental. `src/demo/model.ts` is prototype-only and must not
become the production payment contract.

## Delivery Plan and Gates

### Gate 1: Product and legal decisions

- Confirm company entity, launch country/cities, worker classification, who
  supplies the service, and who appears on receipts.
- Decide buyer fee versus provider commission, fee base, refund policy, and
  completion/dispute windows.
- Obtain Kenyan legal/accounting advice on payment-service rules, safeguarded
  funds, consumer protection, worker classification, tax invoicing, data
  protection, and restrictions on setoff or payout holds.
- Get written provider answers to the RFP questions below.

### Gate 2: Provider and cash-flow proof

In sandbox, prove collection, final status confirmation, delayed payout, failed
payout recovery, refund, dispute hold, duplicate callback, timeout,
reconciliation, and support access. Compare total cost and settlement timing at
realistic transaction sizes. Do not choose on advertised collection price alone.

### Gate 3: Backend and finance foundation

Implement authentication/authorization, server-side job/payment APIs, ledger,
fee versioning, webhook inbox, idempotency, audit log, reconciliation, and
monitoring before real funds move. Test rounding, duplicate callbacks,
concurrent release requests, database rollback, and provider outages.

### Gate 4: Controlled pilot

Start with a small verified worker cohort, one city, low transaction limits,
in-app payments only, manual payout release review, daily reconciliation, and
named support/finance owners. Expand only after payout, reconciliation, refund,
and dispute metrics meet agreed thresholds.

### Gate 5: Automate and expand

Automate release only after the pilot proves the state model and operations.
Add payment methods or countries behind provider adapters and separate
country-specific rules. Reassess legal/provider approval on expansion.

## Provider RFP Questions

Ask Safaricom, Paystack, and any licensed PSP/bank candidate to answer in
writing:

- Can OddJobs collect from the customer and retain the worker portion until a
  job completion/dispute condition is satisfied? Where are funds held, and in
  whose legal name?
- Is this use case approved for our company, worker type, service categories,
  and transaction sizes? What licenses or provider-sponsored arrangements
  apply?
- Which Kenya collection methods, payout destinations, currencies, and
  settlement schedules are supported for this specific marketplace account?
- Can payouts be manual and conditional? Can the PSP maintain separate seller
  balances or provide safeguarded funds? What are hold-time limits?
- What onboarding/KYC checks apply to OddJobs and each worker? Who performs
  verification and ongoing monitoring?
- Who bears collection fees, payout fees, refunds, reversals, chargebacks,
  fraud losses, negative balances, and dispute fees?
- Which callbacks, signatures, status APIs, idempotency controls, statements,
  and reconciliation exports are available? What are retry and support SLAs?
- Can customer fees and worker commissions be itemized on receipts and
  provider statements? Can tax receipts be supported?
- What happens to held money if the account is suspended, a payout destination
  changes, a dispute arrives after release, or the provider relationship ends?
- What are pricing, limits, reserves, settlement delays, and termination/data
  export terms at pilot and scale?

## Legal and Tax Starting Points

These sources are starting points for qualified Kenyan advice, not conclusions
about OddJobs' obligations:

- [Kenya National Payment System Act](https://new.kenyalaw.org/akn/ke/act/2011/39/eng@2022-12-31)
- [Kenya Data Protection Act](https://new.kenyalaw.org/akn/ke/act/2019/24/eng@2022-12-31)
- [KRA eTIMS: who should use it](https://www.kra.go.ke/business/etims-electronic-tax-invoice-management-system/learn-about-etims/what-is-etims)

Before launch, counsel should review the exact funds flow, customer/worker
terms, fee disclosure, and overdue-account policy. This document is not a
substitute for legal advice, tax advice, provider approval, or a finance
controls review.
# Prime Analytics — primeanalytics.ai

Marketing attribution, data infrastructure, and dashboards for US SaaS, e-commerce, and services companies. Static single-page site, no build step.

**Live at https://primeanalytics.ai** (and `www.`).

## Structure

```
prime-analytics/
├── README.md        # permanent product, UX, and infrastructure decision log
├── operations/      # internal delivery, security, legal-readiness, and analytics checklists
├── wrangler.toml    # Cloudflare config, static assets, and Analytics Engine binding
├── worker.js        # redirects, security headers, and first-party event endpoint
└── website/
    ├── index.html    # broad revenue-data homepage
    ├── analytics.js # shared, first-party click measurement
    ├── fonts.css     # self-hosted font declarations
    ├── fonts/        # local WOFF2 files; no Google Fonts request
    ├── marketing-attribution-consulting.html # focused acquisition page
    ├── privacy.html
    ├── sample-blueprint.html
    ├── sample-blueprint-services.html
    ├── 404.html
    ├── sitemap.xml
    └── (favicon/OG image assets)
```

HTML/CSS is page-local and the small measurement script is shared; there is no build step. Don't add a framework or bundler until there's a real reason (a blog, case study pages, or a CMS). Static files are fast to deploy and easy for two people to review in a pull request.

**This is not a pure static-assets project — it has a real Worker script (`worker.js`).** It redirects `http://` → `https://` and `www.` → apex, and attaches security headers (HSTS, CSP, etc.) to every response, then falls through to serving the static files in `website/`. This requires `run_worker_first = true` in `wrangler.toml` — by default, Cloudflare serves static-asset-matching requests (like `/`) directly and **skips the Worker script entirely**, which silently defeats any redirect/header logic unless that flag is set. If headers or redirects ever stop working after a config change, check this first.

**Keep this file out of `website/`.** Anything in that folder is uploaded as a public static asset by `wrangler deploy` — a README with account IDs and internal infra notes previously ended up live at `primeanalytics.ai/README.md` before this was caught and fixed.

## Local development

No install needed. Open `website/index.html` directly in a browser, or serve it:

```bash
python3 -m http.server 8000 --directory website
# visit localhost:8000
```

## Site sections (in order)

Nav → Hero → proof strip → **Challenges/business questions** → Services → fit guidance → **Revenue Data Blueprint** → How We Work → risk reduction → Tool stack → About/founders → **FAQ** → Contact → Footer.

Challenges and FAQ were added after benchmarking four competitor agency sites (datasolutions.com, datasolutionsagency.com, value10x.ai, proiq.com). The July 2026 launch audit then replaced the vague "guarantees" framing with explicit project-risk controls and turned the audit into a named, deliverable-based offer. See "Launch UX audit record" below.

## Launch UX audit record

This is the permanent record of the pre-launch UX review. It deliberately does not depend on case studies or testimonials, because the company does not have a first public client result yet.

### Implemented in the launch revision

- [x] Repositioned the hero around one buyer problem: disconnected marketing, sales, product, and revenue data.
- [x] Changed the primary outcome from generic "data services" to revenue reporting and attribution that decision-makers can trust.
- [x] Kept the target broad enough for the current go-to-market ("growing US companies") without claiming specialization the company has not yet earned.
- [x] Replaced generic "Book a call" language with the intent-based "Discuss your data."
- [x] Added call expectations beside the CTA: 20 minutes, no preparation, direct founder access.
- [x] Replaced the weak "See what we do" secondary CTA with a link to the concrete paid starting offer.
- [x] Named the entry offer **Revenue Data Blueprint**.
- [x] Reframed the $2,000 price around buyer deliverables instead of "about 20 hours of our time."
- [x] Defined eight Blueprint deliverables: stakeholder/question map, source and metric inventory, quality/risk assessment, attribution gap analysis, target architecture, 30/60/90-day roadmap, recorded findings, and fixed build proposal.
- [x] Defined the delivery clock precisely: five business days after kickoff and required access are complete.
- [x] Kept the full $2,000 build credit and made clear that the buyer retains every Blueprint deliverable.
- [x] Removed the illustrative "CAC down 18%" result, which could be mistaken for an unsupported client outcome.
- [x] Replaced it with a neutral system-output diagram that makes no performance claim.
- [x] Added an above-the-fold trust strip using only substantiated facts: combined experience, founder access, CST overlap, and client ownership.
- [x] Replaced the "guarantees" concept with **How we reduce project risk**.
- [x] Added explicit minimum-access, client-owned-infrastructure, NDA/DPA, and access-removal language.
- [x] Removed the unsupported "plenty of clients come back" statement.
- [x] Clarified that ongoing support is optional rather than implying an existing client history.
- [x] Rewrote About into a short company explanation plus distinct founder roles and profiles.
- [x] Removed vague "market-leading platform" language.
- [x] Changed "tools we work with daily" to the more defensible "core technologies we work with."
- [x] Changed "Questions we get asked" to "Common questions" so the copy does not imply a prospect history that may not exist.
- [x] Aligned homepage FAQ structured data with visible FAQ copy.
- [x] Added Open Graph and Twitter image alt text and tightened the search/social description around the named offer.
- [x] Added a skip link, primary-nav label, anchor offset, Escape-to-close behavior, mobile scroll lock, and a visible mobile version of the hero diagram.
- [x] Aligned the privacy page with the site's client-data and NDA/DPA language.

### Hero headline rationale

The previous hero headline was:

> **Know which dollar actually drove the sale.**

Its supporting copy was:

> We build the pipelines, models, and dashboards that turn your marketing and product data into decisions — from raw events to a warehouse your whole team trusts.

That version was sharper and more memorable, but it positioned Prime Analytics primarily as a marketing-attribution firm. It also implied a level of causal certainty — identifying exactly which dollar produced a sale — that attribution data often cannot support.

The launch revision changed the headline to:

> **Revenue reporting your team can finally trust.**

Its supporting copy is:

> We help growing US companies connect marketing, sales, product, and revenue data — then build the attribution models and reporting their teams need to make confident decisions.

The current version is broader, more defensible, and better aligned with the complete offer: attribution, pipelines, warehouses, models, and decision-facing reporting. It can speak to marketing, revenue operations, finance, product, and data leaders rather than only performance marketers. Its tradeoff is that it is less distinctive and less memorable than the previous headline.

If the current headline underperforms or feels too conventional, the preferred hybrid to test is:

> **Know what actually drives revenue.**

With:

> We connect your marketing, sales, product, and revenue data — then build the attribution models and reporting your team can trust.

The hybrid preserves the original headline's punch while avoiding the claim that every individual dollar can be attributed with certainty. Do not change the live headline based on preference alone; compare qualified-call conversion, CTA engagement, or structured prospect feedback once the site has enough traffic.

### Required owner checks before or immediately after launch

- [ ] **Verify every founder claim.** Both founders must confirm the combined 10+ years figure, individual role descriptions, named technology experience, and "fluent English" statement.
- [x] **Define the Blueprint delivery workflow.** The internal checklist now defines scope defaults, start-clock criteria, all eight deliverables, QA, review, and handoff. The founders still need to turn these specifications into the working document templates before accepting payment.
- [ ] **Prepare the legal documents.** Have a reviewed NDA, DPA, master services agreement, statement of work, and USD invoicing process ready; do not rely on website copy alone.
- [x] **Define access handling.** The internal security checklist covers credential transfer, secret storage, MFA, least privilege, named access, client-owned work locations, and revocation/deletion.
- [ ] **Confirm Calendly routing.** Test the complete booking journey on desktop and mobile, including confirmation email, timezone handling, reminders, and the meeting link.
- [ ] **Confirm shared-lead behavior.** Decide whether both founders join every first call; the site promises direct founder access but currently books through Eduardo's calendar.
- [ ] **Check the $2,000 economics after 1–2 engagements.** Record real hours, meetings, and revisions; change price or scope if the Blueprint cannot be delivered profitably in five business days.
- [ ] **Complete brand/legal due diligence.** Search results contain unrelated companies called Prime Analytics, including a `prime-analytics.ai` business. Check US trademark risk and decide whether a consistent descriptor such as "Prime Analytics — Revenue Data Systems" is needed.
- [ ] **Claim consistent social profiles.** Use the same company name, descriptor, domain, logo, founder links, and summary on LinkedIn and any other public profile.
- [x] **Create proof artifacts that are not case studies.** `/sample-blueprint` and `/sample-blueprint-services` are clearly labeled fictional deliverables. Visitors can switch between a B2B SaaS attribution problem that uses BigQuery/dbt and a professional-services reporting problem whose recommended solution is HubSpot plus Google Sheets.
- [x] **Implement conversion measurement.** Cloudflare Web Analytics remains the aggregate traffic source; a first-party endpoint records an allowlisted set of CTA and sample interactions in Analytics Engine without cookies or direct identifiers. Production delivery still needs verification after each deploy.
- [ ] **Run real-device QA.** Test current iPhone Safari, Android Chrome, desktop Chrome, Edge, Firefox, keyboard-only navigation, 200% zoom, reduced motion, and slow/mobile connections.
- [ ] **Request reindexing after deployment.** Resubmit the sitemap and request homepage indexing in Google Search Console after the new title and description are live.
- [ ] **Monitor brand search monthly.** Track `Prime Analytics`, `Prime Analytics revenue data`, and `primeanalytics.ai`; branded discoverability is currently weak because established namesakes dominate.
- [x] **Self-host fonts.** Bitter and IBM Plex font files are served from `/fonts/`, removing the Google Fonts request and simplifying the privacy story.
- [ ] **Tighten the CSP when CSS/JS are externalized.** Inline CSS/JS currently requires `'unsafe-inline'`; do this only when the maintenance benefit justifies splitting the single file.
- [ ] **Add professional founder photos only when both are ready.** Use consistent, real portraits; do not use stock imagery or AI-generated people.
- [ ] **Add certifications only if current and verifiable.** Link badges to the issuer where possible.
- [ ] **Do not add testimonials, logos, client counts, outcome percentages, or "clients come back" language until each is real and permissioned.**

### Meeting action items from July 24

These came out of the Eduardo/Jose call and should stay in the working checklist until they are either done or intentionally dropped.

- [ ] **Jose: create the Upwork agency account.** Investigate Agency Plus and confirm the best agency setup before spending money on it.
- [ ] **Eduardo: revisit pricing.** Compare the $2,000 Blueprint against a free discovery call plus a paid follow-on structure, and decide which model is actually strongest for launch.
- [ ] **Eduardo: bring the tech stack higher on the page.** Keep the stack visible near the top for credibility, not buried low on the page.
- [ ] **Eduardo: finish calendly availability blocking.** Make sure both founders can join when needed and that booking never conflicts with real availability.
- [ ] **Eduardo/Jose: keep the site at MVP level.** Remove visual clutter, but do not add case-study-style claims or decorative sections that weaken the offer.
- [ ] **Eduardo: keep the partnership idea warm.** Follow up on the Fanny introduction only if the partner actually has active lead-gen clients that fit the offer.

## Competitor benchmark checklist

This checklist records the July 2026 review of ProIQ, DataSolutions, Data Solutions Agency, Value10x, SmartSites, Pegasus One, and Element / The Data Agency. Items are ranked by likely impact for Prime Analytics, not by how frequently competitors use them.

### Highest impact — implemented

- [x] Add a precise **who this is for** section based on business conditions rather than company size alone.
- [x] Add a restrained **not the right fit** section without rejecting profitable spreadsheet or lightweight work.
- [x] State the technology-agnostic principle: recommend the smallest system that reliably solves the problem.
- [x] Add three problem-based entry paths: attribution, conflicting reporting, and infrastructure readiness.
- [x] Explain the complete fit call → kickoff → assessment → findings → buyer decision journey.
- [x] State exactly when the five-business-day delivery clock begins.
- [x] Explain that the buyer may implement the Blueprint internally, use another team, or hire Prime.
- [x] Publish a fictional sample Blueprint that prospects can inspect without relying on case studies.
- [x] Make the sample obviously fictional in the page banner, title, company name, and explanatory copy.
- [x] Show the expected depth of the deliverable: executive finding, inventory, metric conflicts, architecture, 90-day roadmap, and implementation boundary.
- [x] Clarify that Prime builds measurement and reporting infrastructure but does not manage media, SEO, creative, or campaigns.
- [x] State that outside specialists are never introduced without prior disclosure of identity, purpose, and access.
- [x] Add a one-business-day email response expectation.
- [x] Add the sample Blueprint to the sitemap.
- [x] Simplify the four "Sound familiar?" statements so each communicates one problem in a single sentence.
- [x] Turn the sample Blueprint into a two-example chooser rather than presenting one fictional case as the only possible engagement.
- [x] Use the second sample to demonstrate that an important problem can justify a paid engagement without requiring a warehouse or complex stack.

### High impact — requires owner preparation

- [ ] Build the working document templates behind all eight Blueprint deliverables using the production checklist; the public fictional sample is a sales artifact, not the complete operating template.
- [ ] Approve or revise the recommended limit of one decision, five sources, three reports, two stakeholder interviews, and one clarification round before putting it in the SOW.
- [x] Create a written credential-access procedure covering password sharing, MFA, least privilege, secret storage, and revocation.
- [ ] Decide whether both founders join every kickoff and findings call and align Calendly capacity with that promise.
- [ ] Create the reviewed NDA, DPA, MSA, and Blueprint statement-of-work templates.
- [ ] Confirm whether outside specialists will ever be used; if yes, define vetting, contracting, confidentiality, and access requirements.
- [ ] Decide which founder owns commercial follow-up and guarantee the one-business-day response expectation during travel or leave.

### Add after enough operating evidence exists

- [ ] Publish realistic implementation-duration bands after several completed builds; do not copy competitor timelines.
- [ ] Convert common Blueprint outcomes into one or two bounded implementation packages once repeated patterns are proven.
- [ ] Add a five-question data-maturity self-assessment only if its output gives useful guidance without inventing financial losses.
- [ ] Add separate attribution, infrastructure, and reporting pages when each can contain genuinely distinct buyer guidance.
- [ ] Add focused industry or business-model pages only after demand shows where Prime consistently wins.
- [ ] Publish a short technical article explaining what attribution can and cannot prove.
- [ ] Add a concise client-access/security page after the operating procedure and legal documents exist.
- [ ] Consider a short inquiry form if analytics show visitors avoid Calendly and email; do not add fields without a clear follow-up workflow.

### Explicitly rejected for now

- [ ] Do not add AI services merely because competitors lead with AI.
- [ ] Do not add a speculative ROI or “money left on the table” calculator.
- [ ] Do not add an ROI guarantee before delivery economics and attribution boundaries are proven.
- [ ] Do not manufacture industry specialization, project counts, return-client rates, awards, or performance percentages.
- [ ] Do not create thin SEO landing pages, a generic high-volume blog, live chat, or phone support that the two founders cannot maintain.
- [ ] Do not expand the service list unless the new service supports the core revenue-data positioning.

## BuzzCube benchmark notes

BuzzCube was reviewed separately after the broader competitor benchmark. Its strongest patterns are operational specificity and visual proof:

- It puts concrete operating promises directly under the hero rather than relying on adjectives.
- It makes the output visible through many work examples.
- It explains the customer journey as a short visual sequence.
- Its FAQ answers the operational questions buyers ask immediately: timing, team continuity, workflow, limits, and cancellation.
- It clearly contrasts its model with hiring, agencies, freelancers, and AI.

Prime should borrow the specificity, inspectable work, process clarity, and objection handling. The two fictional Blueprint examples, five-step journey, risk controls, and expanded FAQ apply those lessons without copying BuzzCube's subscription model, comparison table, testimonials, or scale claims. Do not add a competitor-comparison table until Prime has enough delivery evidence to support every comparison fairly.

## SEO keyword strategy

### Primary acquisition keyword

**Marketing attribution consulting**

This is the clearest high-intent search phrase for Prime's strongest entry problem: connecting marketing activity to pipeline and revenue. Search results for the phrase are service and consultancy pages rather than general definitions, which indicates commercial intent. It is also more specific and defensible than the extremely broad "data analytics consulting."

The keyword is an acquisition wedge, not the definition of the entire company. Prime also provides data infrastructure, revenue reporting, and lightweight decision systems. The homepage therefore keeps broad revenue-data positioning, while `/marketing-attribution-consulting` is the focused search-intent page. This avoids making the whole company look like a single-service attribution shop and gives the exact keyword a page with enough depth to deserve ranking.

Implemented placements:

- [x] Dedicated page title, canonical URL, description, H1, section headings, and FAQs
- [x] Homepage attribution service heading and contextual internal link
- [x] Homepage About description and broader revenue-data metadata
- [x] Sitemap entry for the focused page

Supporting topics used naturally across the page:

- Revenue attribution
- Marketing attribution services
- Attribution modeling
- Revenue reporting
- Revenue analytics
- Data infrastructure
- Data warehouse consulting
- Analytics consulting

The visible H1 remains **Revenue reporting your team can finally trust.** This is intentional. The smaller line above it ("Revenue attribution · Data infrastructure") is an eyebrow, not the H1. The conversion headline explains the outcome more clearly than an exact-match keyword headline; the title, headings, service copy, About copy, and future focused pages can carry the search language.

Do not judge the keyword from intuition or estimated search volume alone. Monitor Search Console impressions, queries, qualified traffic, and booked calls. If attribution traffic is too narrow or low quality, improve or reposition the dedicated page before replacing the homepage's broader positioning.

## July 2026 conversion and operating-system pass

This pass was implemented after the initial launch audit. Its goal was to remove conversion friction, create one defensible SEO entry page, make the fictional examples more useful, and ensure the public promises can be delivered consistently.

### Site and copy decisions

- [x] Consolidated the overlapping “Sound familiar?” and buyer-question sections into one shorter “Which problem sounds familiar?” section. This reduces repetition and moves visitors to the service and offer faster.
- [x] Kept the examples explicitly fictional and made the choice visible before the click: B2B SaaS attribution or professional-services reporting. This adds useful range without implying client history.
- [x] Added “Save as PDF” to both examples so a buyer can retain or share the artifact without requiring a form.
- [x] Changed “complete assessment” to “focused assessment of the agreed business question and relevant systems.” The former could imply an unlimited review for $2,000; the latter matches a fixed-price, five-day engagement.
- [x] Changed the final button from “Schedule Your Blueprint Call” to **“See If the Blueprint Fits.”** The body already says the call determines fit, so the new label accurately lowers commitment. This was adopted because it is more congruent with the actual call—not merely because it was suggested.
- [x] Kept the reassuring final-CTA body and founder/no-preparation/no-obligation line because they answer the three most likely scheduling anxieties without making an outcome claim.
- [x] Restored broad homepage metadata and created a substantive marketing-attribution consulting page. The page explains appropriate inputs, outputs, limitations, and process rather than existing only to repeat a keyword.
- [x] Added Open Graph metadata to the fictional examples so shared links have a deliberate title, description, and image.
- [x] Updated the privacy policy for the new first-party conversion measurement.
- [x] Self-hosted Bitter and IBM Plex as WOFF2 files. This removes Google font requests and the associated third-party dependency without changing the visual system.

### Measurement

Cloudflare Web Analytics remains the source for aggregate page traffic and performance. It does not provide custom conversion events, so the Worker now accepts a strict allowlist of click events at `POST /__events` and writes them to the `prime_analytics_events` Analytics Engine dataset.

Only the approved event name and page path are written. The implementation does not add form contents, email addresses, IP addresses, user-agent strings, or query parameters to this dataset. The endpoint rejects unapproved event names and cross-origin browser posts. See [`operations/analytics.md`](operations/analytics.md) for the event dictionary, sample query, and funnel-review procedure.

An internal dashboard is also available at `/metrics` once these runtime values are configured:

- `ACCOUNT_ID` in `wrangler.toml`
- `ANALYTICS_API_TOKEN` as a Cloudflare API secret with `Account Analytics | Read`
- `METRICS_PASSWORD` as the HTTP basic-auth password for the internal page

That page renders the same 30-day funnel data in one place so you do not need to run the SQL query by hand every time you want a status check.

### Delivery credibility

The public site now has matching internal controls:

- [`operations/blueprint-delivery-checklist.md`](operations/blueprint-delivery-checklist.md) defines a recommended scope boundary, start-clock criteria, deliverables, review, and handoff.
- [`operations/access-security-checklist.md`](operations/access-security-checklist.md) defines least privilege, MFA, credential handling, client-owned work locations, revocation, and deletion.
- [`operations/legal-readiness.md`](operations/legal-readiness.md) lists the NDA, DPA, MSA, SOW, cross-border billing, and counsel decisions still required. It is a readiness list, not a substitute for legal advice.

The recommended scope limits in the internal checklist are operating defaults, not new public promises. Both founders must approve them and put the final boundaries in the signed statement of work.

## Accounts & infrastructure

| What | Where | Notes |
|---|---|---|
| Source repo | [github.com/eduardo-primeanalytics/prime-analytics](https://github.com/eduardo-primeanalytics/prime-analytics) | GitHub account `eduardo-primeanalytics` (renamed once from a typo'd signup, `eduardo-primeanaytics`). Two unrelated personal GitHub accounts (`eduardo-hellomood`, `DA-educhac`) are also authenticated locally on this machine — not used for this repo. |
| Hosting | Cloudflare Workers (static assets, not classic Pages) | Cloudflare account **`Educhac23@gmail.com's Account`** (id `334696cbcfac3868e5a054bb7771257d`) — this is the account that already owned the `primeanalytics.ai` DNS zone before this project started, so it was used instead of creating a new one. Worker name: `prime-analytics`. |
| DNS / SSL | Same Cloudflare account | `primeanalytics.ai` and `www.primeanalytics.ai` are attached as Custom Domains directly on the Worker (see `wrangler.toml` routes) — SSL is auto-provisioned by Cloudflare, no manual cert management. |
| Business email | Google Workspace | `eduardo@primeanalytics.ai` is a paid Workspace seat; `hello@primeanalytics.ai` is a **free alias** on that same seat (Workspace allows multiple aliases per seat at no extra cost — don't create it as a separate user, that costs another license). MX record for the domain points to `smtp.google.com`; do **not** set up Cloudflare Email Routing for this zone, it would conflict with the existing Workspace MX. |
| Scheduling | Calendly (free tier) | https://calendly.com/eduardo-primeanalytics/20min — all scheduling CTAs on the site link here. The 20-minute length lowers the commitment for cold traffic. |
| SEO / indexing | Google Search Console | Domain verified, `sitemap.xml` submitted, and indexing requested for the homepage. As of setup, `site:primeanalytics.ai` returned zero results — brand-new domain with no backlinks, so this was expected. Give it a few days before re-checking. |
| Email authentication | DNS TXT records | DKIM, SPF, and DMARC all confirmed live via direct DNS lookup: SPF is `v=spf1 include:_spf.google.com ~all`, DMARC is `v=DMARC1; p=none; rua=mailto:hello@primeanalytics.ai` (monitor-only — tighten to `p=quarantine`/`p=reject` later once reports look clean). |

## Deploy

**Important:** pushing to `master` does not reliably trigger an auto-deploy on Cloudflare's side for this Workers project (unlike classic Cloudflare Pages). After pushing, always confirm the deploy manually:

```bash
npx wrangler deploy
```

`wrangler.toml` pins `account_id` — don't remove it. Whoever runs `wrangler deploy` locally may be authenticated to more than one Cloudflare account (Cloudflare account membership isn't tied 1:1 to the login email), and without a pinned `account_id` wrangler will guess wrong and deploy to/create a Worker in the wrong account.

To verify a deploy actually went live (bypassing CDN cache):

```bash
curl -s "https://primeanalytics.ai/?cb=$(date +%s)" | grep -o "<title>.*</title>"
```

## Working as two co-owners

Don't push straight to `main`. Suggested workflow:

1. Branch per change: `git checkout -b copy/about-section`
2. Push and open a PR, even solo — it's a paper trail of *why* something changed, which matters for later disagreements.
3. Each partner reviews the other's PRs before merge.
4. Protect `main` in GitHub repo settings (Settings → Branches → require PR before merge) so this isn't just a norm you can forget under deadline pressure.
5. After merging, remember the manual `wrangler deploy` step above — merging alone doesn't put it live.

## Open items

- [ ] **Re-price the Revenue Data Blueprint after the first 1–2 real engagements.** The published $2,000 price is benchmark-derived, not costed — nobody has actually timed a real Blueprint yet. Track real hours on the first couple of clients and revisit the number and scope once there's real data.
- [ ] **Certification/partner badges** — if either founder holds a Snowflake, dbt, or GA4 certification, add it as a trust signal. Costs nothing, needs no client, not yet done.
- [x] **Make compliance/data-handling visible.** The homepage now states minimum-access, client-owned-infrastructure, NDA/DPA, and access-removal practices; the privacy page uses matching language.
- [ ] **Real proof, when it exists** — do not invent case studies or push for them before the first client. Once a client grants permission, add the smallest truthful proof available: a quote, anonymized artifact, or measured outcome.
- [ ] **Legal/invoicing structure** for cross-border USD billing. Complete the counsel-reviewed items in `operations/legal-readiness.md` before handling client data.
- [ ] **Approve the Blueprint operating boundary.** Both founders must accept or revise the proposed source, report, interview, revision, and start-clock limits before the first SOW.
- [ ] **Verify conversion reporting after launch.** Confirm real events reach `prime_analytics_events`, run the 30-day query in `operations/analytics.md`, and reconcile Calendly clicks against completed bookings.
- [ ] **Submit the focused page for indexing.** Request indexing for `/marketing-attribution-consulting` in Google Search Console and monitor query quality.
- [ ] **Real-device QA.** Test navigation, scheduling, example selection, printing to PDF, and keyboard use on current iOS Safari, Android Chrome, and desktop browsers.
- [x] **Font privacy/performance.** Fonts are self-hosted as WOFF2 assets, the Google disclosure was removed, and the CSP now permits fonts only from the site itself.
- [ ] **Testimonials / client logos** — deliberately not faked. Add once there are real clients willing to be named or quoted.

## Pricing anchor

**Published offer:** the **Revenue Data Blueprint is $2,000 fixed and delivered in five business days** after kickoff and required access are complete. It is credited in full toward the build if the client moves forward. The website sells defined deliverables, not a block of consultant hours. Internally, continue tracking whether roughly 20 hours is a viable delivery target. The build itself deliberately has no published number; the Blueprint produces a fixed build proposal.

**Why $2,000 and tightly defined, not the originally-researched $2,500 flat fee:**
- The Blueprint can become open-ended if "map everything" is promised. The public deliverable list defines the expected output; the eventual statement of work must define access assumptions, number of stakeholder sessions, source-system limits, and exclusions.
- $2,000 at ~20 realistic internal hours lands at roughly $100/hr — consistent with the nearshore/boutique blended rate researched below, for a disciplined Blueprint rather than an unbounded assessment.
- The closest direct comp (Data Solutions Agency) publishes deliverables from ~$900. With zero case studies or testimonials live yet, pricing much above that gap is a harder sell than the original research fully weighed — $2,000 narrows that gap versus $2,500.

**Not yet published, deliberately:**
- **Build price range.** No real client has been billed yet, so any range is still benchmark-derived, not costed. Leaving it as "quoted after the Blueprint" is already standard, credible practice and doesn't need a public range to work.
- **Monthly/retainer tier.** Site copy was cleaned up specifically to remove "fixed price vs. monthly" contradictions (see git log). Reintroducing a retainer product is a real decision that deserves its own pass later, not a rider on the Blueprint-pricing change.
- **Important:** the $2,000 figure is a benchmark-derived guess, not a costed one — nobody has timed a real Blueprint yet. Revisit after the first 1–2 real engagements (see Open Items).

**Market benchmarks used:**
- US onshore senior data engineers: $150–185/hr; analytics engineers $140–170/hr; dbt specialists $140–160/hr baseline, up to $200–300/hr when dbt is the centerpiece. ([source](https://dataconsultingfirms.com/insights/data-engineering-hourly-rates), [source](https://www.webfx.com/martech/pricing/big-data-consulting/))
- Small Snowflake implementations: $25,000–$50,000; small assessments/audits alone from $5,000; full migrations $100K+. ([source](https://www.hireinsouth.com/post/best-snowflake-consulting-companies), [source](https://data-sleek.com/snowflake-consulting-services/))
- Marketing attribution audits from ~$5K, monthly retainers up to $20K for larger clients — but boutique agencies (2–15 people, which is us) charge markedly less than enterprise firms for the same scope. ([source](https://www.cometly.com/post/marketing-attribution-consultant-pricing))
- General project-based agency work: $5,000–$50,000+ per project. ([source](https://www.darkroomagency.com/observatory/marketing-agency-cost-2026-pricing-by-service))
- Nearshore LatAm senior data/dev talent: $80–$115/hr at full timezone overlap, vs. $150–250/hr for US mid-market firms and $400+/hr for top-tier US specialists — a 40–65% discount for equivalent seniority. ([source](https://www.hireinsouth.com/post/nearshore-development-rates), [source](https://distantjob.com/blog/offshore-developer-rates/))
- Direct competitor reality check: Data Solutions Agency publishes *"deliverables start at 800 EUR, missions at 1,500 EUR"* (~$900/$1,600) — "small deliverables" pricing (one dashboard, one dbt model), not full warehouse builds. Not a comparable benchmark for our Build phase, but a real signal on audit-tier pricing from the closest direct comp.
- The tension to hold in mind: the site's own commitment is *"both founders, no hand-offs — no account managers, no rotating junior staff."* That's a premium-access claim — pricing shouldn't read as "cheap because junior/offshore," it should read as "same senior access, less overhead."

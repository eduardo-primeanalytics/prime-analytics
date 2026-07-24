# Prime Analytics — primeanalytics.ai

Marketing attribution, data infrastructure, and dashboards for US SaaS, e-commerce, and services companies. Static single-page site, no build step.

**Live at https://primeanalytics.ai** (and `www.`).

## Structure

```
prime-analytics/
├── README.md        # this file — NOT inside website/, so it's never served publicly
├── wrangler.toml     # Cloudflare Workers config — points at website/ for static assets
├── worker.js         # the Worker script — redirects + security headers, see below
└── website/
    ├── index.html    # the main page — HTML, CSS, and JS inline
    ├── privacy.html
    ├── 404.html
    ├── sitemap.xml
    └── (favicon/OG image assets)
```

HTML/CSS/JS inline, no build step, by design. Don't add a framework or bundler until there's a real reason (a blog, case study pages, a CMS). Static files are the fastest thing to deploy and the easiest for two people to review in a pull request.

**This is not a pure static-assets project — it has a real Worker script (`worker.js`).** It redirects `http://` → `https://` and `www.` → apex, and attaches security headers (HSTS, CSP, etc.) to every response, then falls through to serving the static files in `website/`. This requires `run_worker_first = true` in `wrangler.toml` — by default, Cloudflare serves static-asset-matching requests (like `/`) directly and **skips the Worker script entirely**, which silently defeats any redirect/header logic unless that flag is set. If headers or redirects ever stop working after a config change, check this first.

**Keep this file out of `website/`.** Anything in that folder is uploaded as a public static asset by `wrangler deploy` — a README with account IDs and internal infra notes previously ended up live at `primeanalytics.ai/README.md` before this was caught and fixed.

## Local development

No install needed. Open `website/index.html` directly in a browser, or serve it:

```bash
python3 -m http.server 8000 --directory website
# visit localhost:8000
```

## Site sections (in order)

Nav → Hero → proof strip → **Challenges** ("Sound familiar?") → Services → **Revenue Data Blueprint** → How We Work → risk reduction → Tool stack → About/founders → **FAQ** → Contact → Footer.

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

### Required owner checks before or immediately after launch

- [ ] **Verify every founder claim.** Both founders must confirm the combined 10+ years figure, individual role descriptions, named technology experience, and "fluent English" statement.
- [ ] **Operationalize the Blueprint.** Create the actual reusable templates for all eight promised deliverables before accepting payment.
- [ ] **Prepare the legal documents.** Have a reviewed NDA, DPA, master services agreement, statement of work, and USD invoicing process ready; do not rely on website copy alone.
- [ ] **Define access handling.** Document how credentials are received, where secrets are stored, whether MFA is required, who receives access, and the handoff/revocation checklist.
- [ ] **Confirm Calendly routing.** Test the complete booking journey on desktop and mobile, including confirmation email, timezone handling, reminders, and the meeting link.
- [ ] **Confirm shared-lead behavior.** Decide whether both founders join every first call; the site promises direct founder access but currently books through Eduardo's calendar.
- [ ] **Check the $2,000 economics after 1–2 engagements.** Record real hours, meetings, and revisions; change price or scope if the Blueprint cannot be delivered profitably in five business days.
- [ ] **Complete brand/legal due diligence.** Search results contain unrelated companies called Prime Analytics, including a `prime-analytics.ai` business. Check US trademark risk and decide whether a consistent descriptor such as "Prime Analytics — Revenue Data Systems" is needed.
- [ ] **Claim consistent social profiles.** Use the same company name, descriptor, domain, logo, founder links, and summary on LinkedIn and any other public profile.
- [ ] **Create one proof artifact that is not a case study.** A redacted sample Blueprint, sample architecture, metric dictionary, or reporting-spec excerpt will let prospects inspect the quality of the work without inventing client results.
- [ ] **Verify analytics.** Confirm Cloudflare Web Analytics records page views and Calendly outbound clicks without introducing cookies inconsistent with the privacy policy.
- [ ] **Run real-device QA.** Test current iPhone Safari, Android Chrome, desktop Chrome, Edge, Firefox, keyboard-only navigation, 200% zoom, reduced motion, and slow/mobile connections.
- [ ] **Request reindexing after deployment.** Resubmit the sitemap and request homepage indexing in Google Search Console after the new title and description are live.
- [ ] **Monitor brand search monthly.** Track `Prime Analytics`, `Prime Analytics revenue data`, and `primeanalytics.ai`; branded discoverability is currently weak because established namesakes dominate.
- [ ] **Self-host fonts when practical.** This removes a third-party request, improves resilience, and simplifies the privacy story.
- [ ] **Tighten the CSP when CSS/JS are externalized.** Inline CSS/JS currently requires `'unsafe-inline'`; do this only when the maintenance benefit justifies splitting the single file.
- [ ] **Add professional founder photos only when both are ready.** Use consistent, real portraits; do not use stock imagery or AI-generated people.
- [ ] **Add certifications only if current and verifiable.** Link badges to the issuer where possible.
- [ ] **Do not add testimonials, logos, client counts, outcome percentages, or "clients come back" language until each is real and permissioned.**

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
- [ ] **Case studies** — even one anonymized project (the anchor client, once wrapped) would do more for conversion than any copy polish. This is the single biggest gap versus competitor sites, which all lead with quantified case results.
- [ ] **Legal/invoicing structure** for cross-border USD billing.
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

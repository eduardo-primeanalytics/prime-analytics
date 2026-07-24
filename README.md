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

Nav → Hero → **Challenges** ("Sound familiar?") → Services → **Guarantees** → How We Work → Tool stack → About → **FAQ** → Contact → Footer.

The three bolded sections (Challenges, Guarantees, FAQ) were added after benchmarking four competitor agency sites (datasolutions.com, datasolutionsagency.com, value10x.ai, proiq.com) — all four lead with a pain-point section before pitching services, and all four have an FAQ and/or an explicit trust/guarantee section addressing "why hire an unknown small shop." See git log around the "Add Challenges, Guarantees, and FAQ sections" commit for the full reasoning.

## Accounts & infrastructure

| What | Where | Notes |
|---|---|---|
| Source repo | [github.com/eduardo-primeanalytics/prime-analytics](https://github.com/eduardo-primeanalytics/prime-analytics) | GitHub account `eduardo-primeanalytics` (renamed once from a typo'd signup, `eduardo-primeanaytics`). Two unrelated personal GitHub accounts (`eduardo-hellomood`, `DA-educhac`) are also authenticated locally on this machine — not used for this repo. |
| Hosting | Cloudflare Workers (static assets, not classic Pages) | Cloudflare account **`Educhac23@gmail.com's Account`** (id `334696cbcfac3868e5a054bb7771257d`) — this is the account that already owned the `primeanalytics.ai` DNS zone before this project started, so it was used instead of creating a new one. Worker name: `prime-analytics`. |
| DNS / SSL | Same Cloudflare account | `primeanalytics.ai` and `www.primeanalytics.ai` are attached as Custom Domains directly on the Worker (see `wrangler.toml` routes) — SSL is auto-provisioned by Cloudflare, no manual cert management. |
| Business email | Google Workspace | `eduardo@primeanalytics.ai` is a paid Workspace seat; `hello@primeanalytics.ai` is a **free alias** on that same seat (Workspace allows multiple aliases per seat at no extra cost — don't create it as a separate user, that costs another license). MX record for the domain points to `smtp.google.com`; do **not** set up Cloudflare Email Routing for this zone, it would conflict with the existing Workspace MX. |
| Scheduling | Calendly (free tier) | https://calendly.com/eduardo-primeanalytics/20min — all three "Book a call" buttons on the site link here. Shortened from 30 to 20 minutes to lower the commitment for cold traffic with no case studies yet. |
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

- [ ] **Re-price the audit after the first 1–2 real engagements.** The published $2,000 / ~20-hour cap (see "Pricing anchor" below) is benchmark-derived, not costed — nobody has actually timed a real audit yet. Track real hours on the first couple of clients and revisit the number once there's real data, rather than leaving a guessed number live indefinitely. This is the follow-up that matters most, more than the exact figure.
- [ ] **Certification/partner badges** — if either founder holds a Snowflake, dbt, or GA4 certification, add it as a trust signal. Costs nothing, needs no client, not yet done.
- [ ] **Compliance/data-handling as a visible guarantee, not just a `/privacy` mention.** Given the shop is Honduras-based pitching to US companies, being explicit about NDA/DPA practice somewhere more prominent than the privacy page could preempt an objection before it's asked.
- [ ] **Case studies** — even one anonymized project (the anchor client, once wrapped) would do more for conversion than any copy polish. This is the single biggest gap versus competitor sites, which all lead with quantified case results.
- [ ] **Legal/invoicing structure** for cross-border USD billing.
- [ ] **Testimonials / client logos** — deliberately not faked. Add once there are real clients willing to be named or quoted.

## Pricing anchor

**Published and live:** the audit is **$2,000 fixed, time-boxed to ~20 hours across one week** — stated in Process, Guarantees, and FAQ. Credited in full toward the build if the client moves forward. The build itself deliberately has no published number ("you'll have a fixed one in hand before committing to it") — see reasoning below for why that's staying unpublished for now, and why there's no monthly/retainer tier.

**Why $2,000 and time-boxed, not the originally-researched $2,500 flat fee:**
- The audit is inherently the least predictable phase of the engagement — a messy, undocumented client stack can make "map everything" open-ended regardless of price. A **flat scope commitment** ("a complete audit") is what creates 100+ hour blowout risk; a **time-boxed** one ("~20 hours across one week, here's what we found") caps it structurally. Get the scope framing right before worrying about the exact number.
- $2,000 at ~20 realistic hours lands at roughly $100/hr — consistent with the nearshore/boutique blended rate researched below, for a *disciplined, capped* audit rather than an unbounded one.
- The closest direct comp (Data Solutions Agency) publishes deliverables from ~$900. With zero case studies or testimonials live yet, pricing much above that gap is a harder sell than the original research fully weighed — $2,000 narrows that gap versus $2,500.

**Not yet published, deliberately:**
- **Build price range.** No real client has been billed yet, so any range is still benchmark-derived, not costed. Leaving it as "quoted after the audit" is already standard, credible practice and doesn't need a public range to work.
- **Monthly/retainer tier.** Site copy was just cleaned up specifically to remove "fixed price vs. monthly" contradictions (see git log). Reintroducing a retainer product is a real decision that deserves its own pass later, not a rider on the audit-pricing change.
- **Important:** the $2,000 figure is a benchmark-derived guess, not a costed one — nobody has timed a real audit yet. Revisit after the first 1–2 real engagements (see Open Items).

**Market benchmarks used:**
- US onshore senior data engineers: $150–185/hr; analytics engineers $140–170/hr; dbt specialists $140–160/hr baseline, up to $200–300/hr when dbt is the centerpiece. ([source](https://dataconsultingfirms.com/insights/data-engineering-hourly-rates), [source](https://www.webfx.com/martech/pricing/big-data-consulting/))
- Small Snowflake implementations: $25,000–$50,000; small assessments/audits alone from $5,000; full migrations $100K+. ([source](https://www.hireinsouth.com/post/best-snowflake-consulting-companies), [source](https://data-sleek.com/snowflake-consulting-services/))
- Marketing attribution audits from ~$5K, monthly retainers up to $20K for larger clients — but boutique agencies (2–15 people, which is us) charge markedly less than enterprise firms for the same scope. ([source](https://www.cometly.com/post/marketing-attribution-consultant-pricing))
- General project-based agency work: $5,000–$50,000+ per project. ([source](https://www.darkroomagency.com/observatory/marketing-agency-cost-2026-pricing-by-service))
- Nearshore LatAm senior data/dev talent: $80–$115/hr at full timezone overlap, vs. $150–250/hr for US mid-market firms and $400+/hr for top-tier US specialists — a 40–65% discount for equivalent seniority. ([source](https://www.hireinsouth.com/post/nearshore-development-rates), [source](https://distantjob.com/blog/offshore-developer-rates/))
- Direct competitor reality check: Data Solutions Agency publishes *"deliverables start at 800 EUR, missions at 1,500 EUR"* (~$900/$1,600) — "small deliverables" pricing (one dashboard, one dbt model), not full warehouse builds. Not a comparable benchmark for our Build phase, but a real signal on audit-tier pricing from the closest direct comp.
- The tension to hold in mind: the site's own guarantee is *"both founders, no hand-offs — no account managers, no rotating junior staff."* That's a premium-access claim — pricing shouldn't read as "cheap because junior/offshore," it should read as "same senior access, less overhead."

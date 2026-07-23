# Prime Analytics — primeanalytics.ai

Marketing attribution, data infrastructure, and dashboards for US SaaS, e-commerce, and services companies. Static single-page site, no build step.

**Live at https://primeanalytics.ai** (and `www.`).

## Structure

```
prime-analytics/
├── README.md        # this file — NOT inside website/, so it's never served publicly
├── wrangler.toml     # Cloudflare Workers config — points at website/ for static assets
└── website/
    └── index.html    # the entire site — HTML, CSS, and JS inline
```

One HTML file on purpose. Don't split into a framework or add a build step until there's a real reason (a blog, case study pages, a CMS). A static HTML file is the fastest thing to deploy and the easiest for two people to review in a pull request.

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
| Scheduling | Calendly (free tier) | https://calendly.com/eduardo-primeanalytics/30min — all three "Book a call" buttons on the site link here. |

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

- [ ] **Case studies** — even one anonymized project (the anchor client, once wrapped) would do more for conversion than any copy polish. This is the single biggest gap versus competitor sites, which all lead with quantified case results.
- [ ] **Legal/invoicing structure** for cross-border USD billing.
- [ ] **Testimonials / client logos** — deliberately not faked. Add once there are real clients willing to be named or quoted.

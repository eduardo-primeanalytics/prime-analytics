# Prime Analytics — primeanalytics.ai

Marketing attribution, data infrastructure, and dashboards for US SaaS, e-commerce, and services companies. Static single-page site, no build step.

## Structure

```
prime-analytics/
└── website/
    ├── index.html   # the entire site — HTML, CSS, and JS inline
    └── README.md
```

One file on purpose. Don't split into a framework or add a build step until there's a real reason (a blog, case study pages, a CMS). A static HTML file is the fastest thing to deploy and the easiest for two people to review in a pull request.

## Local development

No install needed. Open `index.html` directly in a browser, or serve it:

```bash
python3 -m http.server 8000
# visit localhost:8000
```

## Working as two co-owners

Don't push straight to `main`. Suggested workflow:

1. Branch per change: `git checkout -b copy/about-section`
2. Push and open a PR, even solo — it's a paper trail of *why* something changed, which matters for later disagreements.
3. Each partner reviews the other's PRs before merge. This is the same veto-round discipline from your naming process, applied to the repo instead of a spreadsheet.
4. Protect `main` in GitHub repo settings (Settings → Branches → require PR before merge) so this isn't just a norm you can forget under deadline pressure.

## Status

Live at **https://primeanalytics.ai** (and `www.`). Deployed as a Cloudflare Workers static-assets project (`wrangler.toml` at repo root, `directory = "./website"`), connected to this GitHub repo for auto-deploy on push to `master`.

- [x] **About section** — credits both founders (Eduardo Chacón and Jose Bardales).
- [x] **"Book a call" buttons** — relabeled to "Email us" to match the actual `mailto:` behavior.
- [x] **Deploy** — Cloudflare Workers (static assets), account `Educhac23@gmail.com's Account` (the one that already owns the `primeanalytics.ai` DNS zone).
- [x] **Domain DNS** — `primeanalytics.ai` and `www.primeanalytics.ai` attached as custom domains on the Worker, SSL provisioned.
- [x] **Business email** — `hello@primeanalytics.ai` set up as a Google Workspace alias on the `eduardo@` mailbox (free, no extra seat). Confirmed working.
- [ ] **Case studies** — even one anonymized project (the anchor client, once wrapped) would do more for conversion than any copy polish.
- [ ] **Legal/invoicing structure** for cross-border USD billing.

GitHub account for this repo: `eduardo-primeanalytics` (renamed once from a typo'd signup, `eduardo-primeanaytics`). Two unrelated personal GitHub accounts (`eduardo-hellomood`, `DA-educhac`) are also authenticated locally — not used for this repo.

## Deploy details

Redeploys automatically on push to `master` via the Cloudflare-GitHub integration. To deploy manually:

```bash
npx wrangler deploy
```

`wrangler.toml` pins `account_id` to the Cloudflare account that owns the DNS zone — don't remove it, since the authenticated user may have access to more than one Cloudflare account and wrangler will otherwise guess wrong.

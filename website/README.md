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

## Outstanding before this goes live

Pulled from the partner's launch notes — treat this as the actual punch list, not the README as decoration:

- [ ] **About section** — currently credits only one founder. Add the second partner's name and credential line (marked with a TODO comment in `index.html`).
- [ ] **"Book a call" buttons** — currently `mailto:` links, but labeled as if they book a calendar slot. Either relabel to "Email us" honestly, or wire up Calendly/Cal.com so the label matches the behavior.
- [ ] **Case studies** — even one anonymized project (the anchor client, once wrapped) would do more for conversion than any copy polish.
- [ ] **Deploy** — see below.
- [ ] **Domain DNS** — point primeanalytics.ai at the deploy host.
- [ ] **Business email** — hello@primeanalytics.ai needs to actually exist and receive mail before the mailto link is worth anything.
- [ ] **Legal/invoicing structure** for cross-border USD billing.

## Deploy

GitHub hosts the code; it doesn't put it on the internet at your domain by itself. Pick one:

- **Cloudflare Pages** — connect the repo, auto-deploys on push to `main`, free, and if you're already managing `primeanalytics.ai` DNS through Cloudflare, the domain connection is a couple of clicks.
- **Netlify** — same idea, marginally friendlier UI, one more account to manage.
- **GitHub Pages** — zero extra services, but weaker for custom domain + redirect edge cases than the two above.

Whichever you pick, connect it to the repo so every merge to `main` deploys automatically — no manual "drag the file to the host" step to forget.

## Handoff status (for the next Claude session)

Project was moved from `~/Downloads` into this folder (`C:\Users\educh\OneDrive\Personales\prime-analytics`) and `git init` has been run here. **No commits yet** — `index.html` and `README.md` are untracked.

Decisions made so far:
- GitHub repo should be created under a **new** account, username `eduardo-primeanalytics`, email `eduardo@primeanalytics.ai` (this address already works — forwards to/reads via Gmail).
- User confirmed they want the assistant to eventually handle the whole punch list above ("do everything"), but stopped short of authorizing account creation in this session.

Blocked / pending user input:
- **GitHub account creation** is the very next step and is *not done*. Two options were offered and the user dismissed the question without picking one — ask again before proceeding:
  1. User signs up themselves (github.com/signup, username `eduardo-primeanalytics`, email `eduardo@primeanalytics.ai`), tells the assistant once done, then assistant runs `gh auth login` to connect it.
  2. Assistant drives the signup form via browser tooling, but the user types the password and email verification code themselves (don't auto-fill secrets or read the verification email autonomously).
- Two other GitHub accounts (`eduardo-hellomood`, `DA-educhac`) are already authenticated locally via `gh auth status` — do not use either for this repo; a dedicated agency account was explicitly requested instead.
- Repo visibility/name not yet confirmed — default assumption is a repo named `prime-analytics`, but confirm before running `gh repo create`.

Once the repo exists: `git add`, first commit, push, then work the punch list above. The "Book a call" mislabeling and About-section TODO can be fixed in `index.html` without needing any external account — safe to do before or independently of the GitHub signup.

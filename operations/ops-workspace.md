# Prime Analytics Ops workspace

## Fresh-session starting point

This file is the canonical handoff for reviewing or changing Prime Analytics Ops. A new coding session should be told:

> Read `README.md` and `operations/ops-workspace.md` completely, then inspect the current Git status and recent history before reviewing or changing `/ops`. Treat the repository and production behavior as authoritative; do not rely on prior chat history.

The implementation is concentrated in:

| Concern | Source |
|---|---|
| Worker routing, Access validation, API, AI reconciliation | `worker.js`, `ops-api.js` |
| Ops interface structure | `website/ops/index.html` |
| Ops interaction logic | `website/ops.js` |
| Ops visual system and motion | `website/ops.css` |
| D1 schema | `migrations/` |
| Google Drive intake | `automation/google-drive-meeting-ingest.gs` |
| Runtime bindings and non-secret identifiers | `wrangler.toml` |

Before making a change, run `git status --short` and preserve unrelated work. After a change, at minimum run:

```powershell
node --check ops-api.js
node --check website/ops.js
git diff --check
```

Deployments are manual:

```powershell
npx wrangler deploy
```

Pushing to GitHub does not guarantee that production was deployed. Confirm both the deployed Worker version and pushed commit. Never put credentials, API keys, intake tokens, or downloaded OAuth JSON files in the repository or documentation.

Prime Analytics Ops is the private operating workspace at `/ops`. It is deliberately smaller than a general project-management product:

- **Latest** shows the discussions and proposed task changes from the newest processed meeting.
- **Tasks** is the permanent register of active, completed, and archived commitments.
- **Meetings** preserves the original notes and links each meeting to its extracted discussions.

The public website and `/metrics` do not depend on Ops. If Ops processing fails, the marketing site continues to work normally.

Database timestamps are stored in UTC. The Ops interface displays audit history, notes, and meeting times in `America/Chicago`, including the correct `CST` or `CDT` abbreviation for the date.

## Current interface behavior

### Latest

- Shows the most recently processed meeting.
- Displays new and resurfaced discussions. A discussion mentioned again after several weeks resurfaces without losing its original first-discussed date.
- Shows active tasks needing attention.
- Opens the review inbox when the meeting produced pending task proposals.

### Tasks

- Filters are **Active**, **Mine**, **Completed**, **Archived**, and **All**.
- Columns are task, owner, created date, and due/review date.
- Tasks are ordered by conventional action priority: active work first, waiting work second, completed work third, and archived work last. Within each group, the nearest due/review date comes first; ties and undated tasks use newest-created first.
- Clicking the square completion control marks an active task completed. Clicking a checked control reopens the task as `Open`. Both actions use the audited task-update API.
- Clicking elsewhere on a task row opens its details.
- Archived tasks cannot be toggled from the completion control. They must be deliberately restored by changing their status in task details.
- Creating a task closes the form smoothly and shows a confirmation toast with **View** and **Create another** actions.
- Task identifiers are permanent and sequential. A task ID is not renumbered or reused after legitimate creation.

### Task details and history

- Editable structured fields are status, owner, due date, review date, title, and description.
- Manual notes are append-only from the user interface and remain isolated from AI reconciliation.
- Every structured mutation records the verified actor, old value, new value, source, and timestamp.
- Archiving replaces deletion. There is no task-deletion control or API route.

### Meetings and review

- Opening a task or meeting immediately shows a loading skeleton while its details are fetched.
- Approving or rejecting a proposal removes its review card only after the server accepts the decision.
- Approval supports field-level selection; unchecked fields and manual notes are preserved.
- Original meeting notes remain immutable.

### Motion and accessibility

- Dialogs, tab changes, task filters, confirmation toasts, and review-card removal use short functional transitions.
- Buttons show saving, archiving, approving, rejecting, or processing states during network work.
- `prefers-reduced-motion` is honored. Motion must remain brief and should clarify state change rather than decorate the interface.

## Record model

A meeting is an immutable source record. AI processing appends discussion occurrences and task proposals; it does not rewrite the source notes.

A discussion is a durable topic that can reappear across meetings. Each occurrence has its own summary and evidence. When an existing discussion is mentioned again, Latest marks it **Resurfaced** and retains the original first-discussed date.

A task is a durable commitment with a permanent `PA-###` identifier. A task can be manually created or created from an approved meeting proposal.

Tasks are archived instead of deleted. Archiving removes a task from active views and AI reconciliation while keeping it available under the Archived and All filters with its manual notes and append-only history intact. The application exposes no task-deletion action or API route. Legitimate task identifiers are never reused; the production sequence was normalized once after removing IDs consumed by the manual-entry bug.

Manual task notes are stored separately from structured task fields. AI processing never receives those notes in its reconciliation context and has no update or delete operation for them.

## Attribution and history guarantees

Every task mutation creates an append-only `task_events` row containing:

- task ID;
- actor ID;
- actor type (`human`, `ai`, or `system`);
- event type;
- changed field;
- previous and new values;
- source type and source ID;
- proposal metadata; and
- server timestamp.

Cloudflare Access supplies the verified user email. The server derives the actor from the validated Access JWT; the browser cannot select or submit an actor name.

AI proposals and human approvals are separate events. For example:

```text
Prime Ops AI proposed status: In progress → Waiting
Eduardo approved the proposed status change
```

Rejected proposals are also recorded. Undoing a change must be implemented as another event; history rows are never edited or deleted through the application.

## Runtime resources

The Worker uses the D1 database `prime-analytics-ops`, bound as `OPS_DB`. Schema migrations live in `migrations/`.

Apply migrations locally:

```powershell
npx wrangler d1 migrations apply prime-analytics-ops --local
```

Apply migrations to Cloudflare:

```powershell
npx wrangler d1 migrations apply prime-analytics-ops --remote
```

## Cloudflare Access

Create one self-hosted Access application for:

```text
primeanalytics.ai/ops*
```

Use an Allow policy containing the two exact founder email addresses. Do not use an email-domain wildcard.

Use Google as the Access identity provider for the app. The Google Workspace domain is already managed, so this gives us a cleaner login path than Cloudflare One-Time PIN and ties sign-in to the same domain identity we use everywhere else.

Configure these non-secret Worker variables in `wrangler.toml` after creating the Access application:

```toml
ACCESS_TEAM_DOMAIN = "bold-lab-dae0.cloudflareaccess.com"
ACCESS_AUD = "cd87d771faa1e0d253e38e2a851452c21b76f2a1830cce77cf1919cacdca8715"
```

The Worker validates the Access JWT signature, issuer, audience, expiry, and email before serving `/ops` or its APIs.

Add each founder to D1 using their exact login email:

```powershell
npx wrangler d1 execute prime-analytics-ops --remote --command "INSERT INTO workspace_users (email, display_name, role) VALUES ('founder-one@example.com', 'Eduardo', 'owner'), ('founder-two@example.com', 'José', 'owner')"
```

Never share a login. Actor attribution is only trustworthy when each founder signs in with a separate account.

## OpenAI meeting analysis

Create an OpenAI API key with a project-level spending limit and store it as a Worker secret:

```powershell
npx wrangler secret put OPENAI_API_KEY
```

The model is configured by `OPS_AI_MODEL` in `wrangler.toml`. Processing sends:

- the new meeting notes;
- active task fields;
- active discussion titles and dates; and
- workspace member names and emails.

It does **not** send manual task notes. The model returns structured discussion occurrences and task proposals. Proposed task changes remain pending until Eduardo or José approves selected fields.

## Automatic Google Drive intake

`automation/google-drive-meeting-ingest.gs` is a standalone Google Apps Script. It checks the meeting organizer's Google Meet folder and its meeting-specific subfolders every five minutes, then sends newly created Google Docs to:

```text
POST https://primeanalytics.ai/__ops/ingest
```

Generate a long random intake token and store it as a Worker secret:

```powershell
npx wrangler secret put MEETING_INGEST_TOKEN
```

In Apps Script, create these script properties:

| Property | Value |
|---|---|
| `PRIME_OPS_FOLDER_ID` | ID of the organizer's automatically created `Google Meet` folder |
| `PRIME_OPS_INGEST_URL` | `https://primeanalytics.ai/__ops/ingest` |
| `PRIME_OPS_INGEST_TOKEN` | The same value stored in the Worker secret |

Run `installTrigger()` once from Apps Script and approve Google Drive, Docs, external-request, and trigger permissions.

Gemini places each meeting's notes inside a meeting-specific subfolder under the organizer's `Google Meet` folder. The intake therefore scans two folder levels. Pointing it at a separate custom folder will not work unless another automation copies or moves the Gemini documents there.

The script deliberately scans with a time overlap. D1 enforces a unique Google Drive file ID, so retries are safe and the same meeting cannot create duplicate records.

Manual import remains available from the Meetings page as a fallback when Drive automation is delayed or a call was recorded elsewhere.

## Failure behavior

- Missing or invalid Access identity: no workspace data is returned.
- Email not present in `workspace_users`: access is denied.
- Duplicate Drive file: the existing meeting ID and status are returned.
- OpenAI failure: the original meeting remains stored with `processing_status = failed`.
- Ambiguous task match: the AI should propose a new task or leave the item for review instead of silently merging.
- Rejected proposal: no task fields change.
- Partially approved proposal: only selected fields change.
- Existing manual notes: remain untouched for every proposal outcome.

## Local development

Use a local-only identity variable when starting Wrangler:

```powershell
npx wrangler dev --local --var OPS_DEV_EMAIL:founder-one@example.com --var OPS_DEV_NAME:Eduardo
```

`OPS_DEV_EMAIL` must never be configured in the deployed Worker. Production identity must always come from a validated Cloudflare Access JWT.

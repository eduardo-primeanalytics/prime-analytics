# Prime Analytics Ops workspace

Prime Analytics Ops is the private operating workspace at `/ops`. It is deliberately smaller than a general project-management product:

- **Latest** shows the discussions and proposed task changes from the newest processed meeting.
- **Tasks** is the permanent register of active, completed, and archived commitments.
- **Meetings** preserves the original notes and links each meeting to its extracted discussions.

The public website and `/metrics` do not depend on Ops. If Ops processing fails, the marketing site continues to work normally.

## Record model

A meeting is an immutable source record. AI processing appends discussion occurrences and task proposals; it does not rewrite the source notes.

A discussion is a durable topic that can reappear across meetings. Each occurrence has its own summary and evidence. When an existing discussion is mentioned again, Latest marks it **Resurfaced** and retains the original first-discussed date.

A task is a durable commitment with a permanent `PA-###` identifier. A task can be manually created or created from an approved meeting proposal.

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

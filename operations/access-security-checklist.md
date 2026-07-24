# Client Access and Security Checklist

Minimum operating standard for any engagement involving client systems or data. Adapt it to signed contractual requirements. This is not a substitute for security or legal review.

## Access principles

- Use client-created, named accounts wherever possible.
- Request the least privilege required for the agreed work.
- Require MFA whenever the client system supports it.
- Never request or store credentials in email, chat, project documents, or source control.
- Use an approved password manager or the client's access-management process.
- Do not share one founder's account with the other.
- Work inside client-owned infrastructure unless the statement of work explicitly says otherwise.
- Do not download production datasets unless the task requires it and the client has approved the handling method.

## Before access

- [ ] NDA and DPA executed when required
- [ ] Systems and requested permission levels listed
- [ ] Business reason for each permission recorded
- [ ] Named account created for each person requiring access
- [ ] MFA enabled
- [ ] Credential-delivery method agreed
- [ ] Data-residency or regulated-data restrictions documented
- [ ] Local-download rules documented
- [ ] Client security contact identified

## During the engagement

- [ ] Do not copy secrets into code, tickets, recordings, or screenshots.
- [ ] Use environment variables or the client's secret manager.
- [ ] Keep working files in the approved client-owned location.
- [ ] Redact sensitive values from findings and demonstrations.
- [ ] Report suspected exposure or unexpected access immediately.
- [ ] Review active access when scope changes.
- [ ] Do not give subcontractors or specialists access without written client approval.

## At handoff

- [ ] Transfer code, models, dashboards, documentation, and configuration.
- [ ] Rotate any implementation secrets that were exposed to Prime.
- [ ] Revoke both founders' accounts and API credentials unless support is separately contracted.
- [ ] Delete approved local working copies.
- [ ] Confirm retention exceptions in writing.
- [ ] Record completion of revocation and deletion.


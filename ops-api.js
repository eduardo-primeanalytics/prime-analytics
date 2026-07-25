const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
};

const TASK_FIELDS = new Set([
  'title',
  'description',
  'status',
  'owner_email',
  'due_at',
  'review_at',
  'discussion_id',
]);

const TASK_STATUSES = new Set(['open', 'in_progress', 'waiting', 'completed', 'archived']);
const AI_ACTOR = 'prime-ops-ai';
let cachedJwks = null;
let cachedJwksAt = 0;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(normalized + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getAccessKeys(env) {
  if (cachedJwks && Date.now() - cachedJwksAt < 60 * 60 * 1000) return cachedJwks;
  const teamDomain = String(env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!teamDomain) throw new Error('ACCESS_TEAM_DOMAIN is not configured.');
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('Unable to load Cloudflare Access signing keys.');
  cachedJwks = await response.json();
  cachedJwksAt = Date.now();
  return cachedJwks;
}

async function verifyAccessIdentity(request, env) {
  if (env.OPS_DEV_EMAIL) {
    return {
      email: String(env.OPS_DEV_EMAIL).toLowerCase(),
      name: String(env.OPS_DEV_NAME || 'Local developer'),
      actorType: 'human',
    };
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_AUD || !env.ACCESS_TEAM_DOMAIN) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    if (header.alg !== 'RS256' || !header.kid) return null;

    const jwks = await getAccessKeys(env);
    const jwk = (jwks.keys || []).find((key) => key.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;

    const now = Math.floor(Date.now() / 1000);
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    const teamDomain = String(env.ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (
      payload.exp < now ||
      (payload.nbf && payload.nbf > now) ||
      !audience.includes(env.ACCESS_AUD) ||
      payload.iss !== `https://${teamDomain}`
    ) return null;

    const email = String(payload.email || request.headers.get('Cf-Access-Authenticated-User-Email') || '').toLowerCase();
    if (!email) return null;
    return { email, name: payload.name || email.split('@')[0], actorType: 'human' };
  } catch {
    return null;
  }
}

async function ensureWorkspaceUser(env, identity) {
  const existing = await env.OPS_DB.prepare(
    'SELECT email, display_name, role, active FROM workspace_users WHERE email = ?',
  ).bind(identity.email).first();
  if (!existing || !existing.active) return null;
  return existing;
}

async function requireIdentity(request, env) {
  if (!env.OPS_DB) return { error: json({ error: 'Ops database is not configured.' }, 503) };
  const identity = await verifyAccessIdentity(request, env);
  if (!identity) return { error: json({ error: 'Authentication required.' }, 401) };
  const user = await ensureWorkspaceUser(env, identity);
  if (!user) return { error: json({ error: 'This account is not a member of the workspace.' }, 403) };
  return { identity: { ...identity, ...user } };
}

function taskCode(id) {
  return `PA-${String(id).padStart(3, '0')}`;
}

function mapTask(row) {
  return row ? { ...row, code: taskCode(row.id) } : null;
}

function cleanText(value, maxLength = 5000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanOptionalDate(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return undefined;
  return value.slice(0, 30);
}

function taskEventStatement(env, event) {
  return env.OPS_DB.prepare(`
    INSERT INTO task_events (
      task_id, actor_id, actor_type, event_type, field_name, old_value, new_value,
      source_type, source_id, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    event.taskId,
    event.actorId,
    event.actorType,
    event.eventType,
    event.fieldName ?? null,
    event.oldValue === undefined ? null : JSON.stringify(event.oldValue),
    event.newValue === undefined ? null : JSON.stringify(event.newValue),
    event.sourceType || 'manual',
    event.sourceId || null,
    JSON.stringify(event.metadata || {}),
  );
}

async function recordTaskEvent(env, event) {
  await taskEventStatement(env, event).run();
}

async function getBootstrap(env, identity) {
  const [latestMeeting, tasksResult, meetingsResult, proposalsResult, usersResult] = await Promise.all([
    env.OPS_DB.prepare(`
      SELECT id, title, happened_at, summary, source_url, processing_status, created_at
      FROM meetings
      ORDER BY
        happened_at DESC,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM meeting_discussions md WHERE md.meeting_id = meetings.id
          ) THEN 0
          ELSE 1
        END,
        created_at DESC
      LIMIT 1
    `).first(),
    env.OPS_DB.prepare(`
      SELECT t.*, u.display_name AS owner_name
      FROM tasks t LEFT JOIN workspace_users u ON u.email = t.owner_email
      ORDER BY
        CASE t.status
          WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'waiting' THEN 3
          WHEN 'completed' THEN 4 ELSE 5
        END,
        COALESCE(t.due_at, t.review_at, '9999-12-31'),
        t.updated_at DESC
      LIMIT 250
    `).all(),
    env.OPS_DB.prepare(`
      SELECT id, title, happened_at, summary, source_url, processing_status, created_by_email
      FROM meetings ORDER BY happened_at DESC, created_at DESC LIMIT 100
    `).all(),
    env.OPS_DB.prepare(`
      SELECT COUNT(*) AS count FROM proposals WHERE status = 'pending'
    `).first(),
    env.OPS_DB.prepare(`
      SELECT email, display_name, role FROM workspace_users WHERE active = 1 ORDER BY display_name
    `).all(),
  ]);

  let latestDiscussions = [];
  let latestProposals = [];
  if (latestMeeting) {
    const [discussionResult, proposalResult] = await Promise.all([
      env.OPS_DB.prepare(`
        SELECT md.*, d.first_discussed_at, d.last_discussed_at
        FROM meeting_discussions md
        LEFT JOIN discussions d ON d.id = md.discussion_id
        WHERE md.meeting_id = ?
        ORDER BY md.sequence_number, md.id
      `).bind(latestMeeting.id).all(),
      env.OPS_DB.prepare(`
        SELECT p.*, t.title AS target_task_title
        FROM proposals p
        LEFT JOIN tasks t ON t.id = p.target_task_id
        WHERE p.meeting_id = ? AND p.status = 'pending'
        ORDER BY p.created_at, p.id
      `).bind(latestMeeting.id).all(),
    ]);
    latestDiscussions = discussionResult.results || [];
    latestProposals = (proposalResult.results || []).map((proposal) => ({
      ...proposal,
      payload: JSON.parse(proposal.payload_json),
      payload_json: undefined,
    }));
  }

  return {
    user: {
      email: identity.email,
      displayName: identity.display_name || identity.name,
      role: identity.role,
    },
    users: usersResult.results || [],
    latestMeeting,
    latestDiscussions,
    latestProposals,
    pendingProposalCount: Number(proposalsResult?.count || 0),
    tasks: (tasksResult.results || []).map(mapTask),
    meetings: meetingsResult.results || [],
  };
}

async function getTask(env, taskId) {
  const task = await env.OPS_DB.prepare(`
    SELECT t.*, u.display_name AS owner_name, d.title AS discussion_title
    FROM tasks t
    LEFT JOIN workspace_users u ON u.email = t.owner_email
    LEFT JOIN discussions d ON d.id = t.discussion_id
    WHERE t.id = ?
  `).bind(taskId).first();
  if (!task) return null;

  const [notes, events] = await Promise.all([
    env.OPS_DB.prepare(`
      SELECT n.*, u.display_name AS author_name
      FROM task_notes n
      LEFT JOIN workspace_users u ON u.email = n.author_email
      WHERE n.task_id = ? ORDER BY n.created_at DESC, n.id DESC
    `).bind(taskId).all(),
    env.OPS_DB.prepare(`
      SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC, id DESC LIMIT 250
    `).bind(taskId).all(),
  ]);

  return {
    ...mapTask(task),
    notes: notes.results || [],
    events: (events.results || []).map((event) => ({
      ...event,
      oldValue: event.old_value ? JSON.parse(event.old_value) : null,
      newValue: event.new_value ? JSON.parse(event.new_value) : null,
      metadata: event.metadata_json ? JSON.parse(event.metadata_json) : {},
      old_value: undefined,
      new_value: undefined,
      metadata_json: undefined,
    })),
  };
}

async function createTask(request, env, identity) {
  const body = await request.json();
  const title = cleanText(body.title, 240);
  if (!title) return json({ error: 'Task title is required.' }, 400);

  const status = TASK_STATUSES.has(body.status) ? body.status : 'open';
  const description = cleanText(body.description);
  const ownerEmail = body.owner_email ? cleanText(body.owner_email, 320).toLowerCase() : null;
  const dueAt = cleanOptionalDate(body.due_at);
  const reviewAt = cleanOptionalDate(body.review_at);
  if (dueAt === undefined || reviewAt === undefined) return json({ error: 'A date is invalid.' }, 400);

  const result = await env.OPS_DB.prepare(`
    INSERT INTO tasks (
      title, description, status, owner_email, due_at, review_at, discussion_id, created_by_email,
      completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END)
  `).bind(
    title,
    description,
    status,
    ownerEmail,
    dueAt,
    reviewAt,
    Number.isInteger(body.discussion_id) ? body.discussion_id : null,
    identity.email,
    status,
  ).run();

  const taskId = result.meta.last_row_id;
  await recordTaskEvent(env, {
    taskId,
    actorId: identity.email,
    actorType: 'human',
    eventType: 'task_created',
    newValue: { title, description, status, owner_email: ownerEmail, due_at: dueAt, review_at: reviewAt },
  });
  return json({ task: await getTask(env, taskId) }, 201);
}

async function updateTask(request, env, identity, taskId) {
  const existing = await env.OPS_DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
  if (!existing) return json({ error: 'Task not found.' }, 404);

  const body = await request.json();
  const updates = {};
  for (const [field, rawValue] of Object.entries(body)) {
    if (!TASK_FIELDS.has(field)) continue;
    let value = rawValue;
    if (field === 'title') value = cleanText(value, 240);
    if (field === 'description') value = cleanText(value);
    if (field === 'status' && !TASK_STATUSES.has(value)) {
      return json({ error: 'Invalid task status.' }, 400);
    }
    if (field === 'owner_email') value = value ? cleanText(value, 320).toLowerCase() : null;
    if (field === 'due_at' || field === 'review_at') {
      value = cleanOptionalDate(value);
      if (value === undefined) return json({ error: `Invalid ${field}.` }, 400);
    }
    if (field === 'discussion_id') value = Number.isInteger(value) ? value : null;
    if (value !== existing[field]) updates[field] = value;
  }

  const changedFields = Object.keys(updates);
  if (!changedFields.length) return json({ task: await getTask(env, taskId) });

  const assignments = changedFields.map((field) => `${field} = ?`);
  const values = changedFields.map((field) => updates[field]);
  assignments.push('updated_at = CURRENT_TIMESTAMP');
  if (updates.status === 'completed') assignments.push('completed_at = CURRENT_TIMESTAMP');
  if (updates.status && updates.status !== 'completed') assignments.push('completed_at = NULL');
  if (updates.status === 'archived') assignments.push('archived_at = CURRENT_TIMESTAMP');
  if (updates.status && updates.status !== 'archived') assignments.push('archived_at = NULL');

  await env.OPS_DB.prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`)
    .bind(...values, taskId)
    .run();

  for (const field of changedFields) {
    await recordTaskEvent(env, {
      taskId,
      actorId: identity.email,
      actorType: 'human',
      eventType: 'field_changed',
      fieldName: field,
      oldValue: existing[field],
      newValue: updates[field],
    });
  }

  return json({ task: await getTask(env, taskId) });
}

async function addTaskNote(request, env, identity, taskId) {
  const task = await env.OPS_DB.prepare('SELECT id FROM tasks WHERE id = ?').bind(taskId).first();
  if (!task) return json({ error: 'Task not found.' }, 404);
  const body = await request.json();
  const note = cleanText(body.body, 10000);
  if (!note) return json({ error: 'Note cannot be empty.' }, 400);

  const result = await env.OPS_DB.prepare(`
    INSERT INTO task_notes (task_id, body, author_email) VALUES (?, ?, ?)
  `).bind(taskId, note, identity.email).run();
  await recordTaskEvent(env, {
    taskId,
    actorId: identity.email,
    actorType: 'human',
    eventType: 'note_added',
    newValue: note,
    metadata: { noteId: result.meta.last_row_id },
  });
  return json({ task: await getTask(env, taskId) }, 201);
}

async function getMeeting(env, meetingId) {
  const meeting = await env.OPS_DB.prepare('SELECT * FROM meetings WHERE id = ?').bind(meetingId).first();
  if (!meeting) return null;
  const [discussions, proposals] = await Promise.all([
    env.OPS_DB.prepare(`
      SELECT md.*, d.first_discussed_at, d.last_discussed_at
      FROM meeting_discussions md
      LEFT JOIN discussions d ON d.id = md.discussion_id
      WHERE md.meeting_id = ? ORDER BY md.sequence_number, md.id
    `).bind(meetingId).all(),
    env.OPS_DB.prepare(`
      SELECT p.*, t.title AS target_task_title
      FROM proposals p LEFT JOIN tasks t ON t.id = p.target_task_id
      WHERE p.meeting_id = ? ORDER BY p.created_at, p.id
    `).bind(meetingId).all(),
  ]);
  return {
    ...meeting,
    participants: JSON.parse(meeting.participants_json || '[]'),
    discussions: discussions.results || [],
    proposals: (proposals.results || []).map((proposal) => ({
      ...proposal,
      payload: JSON.parse(proposal.payload_json),
      payload_json: undefined,
    })),
  };
}

function extractOpenAIText(result) {
  for (const output of result.output || []) {
    for (const content of output.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  return '';
}

async function analyzeMeeting(env, meeting, context) {
  if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'discussions'],
    properties: {
      summary: { type: 'string' },
      discussions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'summary', 'source_excerpt', 'existing_discussion_id', 'task_proposals'],
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            source_excerpt: { type: 'string' },
            existing_discussion_id: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
            task_proposals: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'target_task_id', 'changes', 'evidence', 'confidence'],
                properties: {
                  type: { type: 'string', enum: ['create_task', 'update_task'] },
                  target_task_id: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
                  changes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['field', 'value'],
                      properties: {
                        field: {
                          type: 'string',
                          enum: ['title', 'description', 'status', 'owner_email', 'due_at', 'review_at'],
                        },
                        value: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                      },
                    },
                  },
                  evidence: { type: 'string' },
                  confidence: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
  };

  const prompt = `You reconcile meeting notes for Prime Analytics, a two-founder company.
Extract concise discussion updates and propose task changes. Never claim a task is complete unless the notes say so clearly.
Reuse an existing discussion or task only when the match is strong. Do not invent owners or dates.
Manual notes are intentionally absent from the context and must never be inferred, replaced, or deleted.
For an update_task proposal, include only fields that should change in the changes array.
For create_task, the changes array must include a clear outcome-oriented title.
Use the exact owner email only when the person is explicit in the notes.

Workspace members:
${JSON.stringify(context.users)}

Existing discussions:
${JSON.stringify(context.discussions)}

Existing active tasks:
${JSON.stringify(context.tasks)}

Meeting:
${JSON.stringify({
  title: meeting.title,
  happened_at: meeting.happened_at,
  participants: meeting.participants,
  notes: meeting.raw_notes,
})}`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPS_AI_MODEL || 'gpt-5-mini',
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: 'meeting_reconciliation',
          strict: true,
          schema,
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${await response.text()}`);
  const result = await response.json();
  const outputText = extractOpenAIText(result);
  if (!outputText) throw new Error('OpenAI returned no structured output.');
  return JSON.parse(outputText);
}

async function processMeeting(env, meetingId) {
  const meeting = await env.OPS_DB.prepare('SELECT * FROM meetings WHERE id = ?').bind(meetingId).first();
  if (!meeting) throw new Error('Meeting not found.');
  await env.OPS_DB.prepare(`
    UPDATE meetings SET processing_status = 'processing', processing_error = NULL WHERE id = ?
  `).bind(meetingId).run();

  try {
    const [users, discussions, tasks] = await Promise.all([
      env.OPS_DB.prepare(`
        SELECT email, display_name FROM workspace_users WHERE active = 1 ORDER BY display_name
      `).all(),
      env.OPS_DB.prepare(`
        SELECT id, title, category, state, first_discussed_at, last_discussed_at
        FROM discussions WHERE state != 'closed' ORDER BY last_discussed_at DESC LIMIT 100
      `).all(),
      env.OPS_DB.prepare(`
        SELECT id, title, description, status, owner_email, due_at, review_at, discussion_id
        FROM tasks WHERE status NOT IN ('completed', 'archived') ORDER BY updated_at DESC LIMIT 150
      `).all(),
    ]);

    const analysis = await analyzeMeeting(env, {
      ...meeting,
      participants: JSON.parse(meeting.participants_json || '[]'),
    }, {
      users: users.results || [],
      discussions: discussions.results || [],
      tasks: tasks.results || [],
    });
    const validTaskIds = new Set((tasks.results || []).map((task) => task.id));
    const validMemberEmails = new Set((users.results || []).map((user) => user.email));

    await env.OPS_DB.prepare('UPDATE meetings SET summary = ? WHERE id = ?')
      .bind(cleanText(analysis.summary, 5000), meetingId)
      .run();

    let sequence = 0;
    const proposedTaskEvents = [];
    for (const discussionData of analysis.discussions || []) {
      sequence += 1;
      let discussionId = Number.isInteger(discussionData.existing_discussion_id)
        ? discussionData.existing_discussion_id
        : null;
      let resurfaced = 0;
      if (discussionId) {
        const existing = await env.OPS_DB.prepare('SELECT id FROM discussions WHERE id = ?')
          .bind(discussionId)
          .first();
        if (existing) {
          resurfaced = 1;
          await env.OPS_DB.prepare(`
            UPDATE discussions SET last_discussed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).bind(meeting.happened_at, discussionId).run();
        } else {
          discussionId = null;
        }
      }
      if (!discussionId) {
        const created = await env.OPS_DB.prepare(`
          INSERT INTO discussions (title, first_discussed_at, last_discussed_at)
          VALUES (?, ?, ?)
        `).bind(
          cleanText(discussionData.title, 240),
          meeting.happened_at,
          meeting.happened_at,
        ).run();
        discussionId = created.meta.last_row_id;
      }

      const discussionResult = await env.OPS_DB.prepare(`
        INSERT INTO meeting_discussions (
          meeting_id, discussion_id, title, summary, source_excerpt, sequence_number, resurfaced
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        meetingId,
        discussionId,
        cleanText(discussionData.title, 240),
        cleanText(discussionData.summary, 5000),
        cleanText(discussionData.source_excerpt, 2000),
        sequence,
        resurfaced,
      ).run();
      const meetingDiscussionId = discussionResult.meta.last_row_id;

      for (const taskProposal of discussionData.task_proposals || []) {
        const proposalType = taskProposal.type === 'update_task' ? 'update_task' : 'create_task';
        const targetTaskId = proposalType === 'update_task' && Number.isInteger(taskProposal.target_task_id)
          ? taskProposal.target_task_id
          : null;
        if (proposalType === 'update_task' && (!targetTaskId || !validTaskIds.has(targetTaskId))) continue;
        const fields = {};
        for (const change of taskProposal.changes || []) {
          if (!TASK_FIELDS.has(change.field) || change.value === undefined) continue;
          let value = change.value;
          if (change.field === 'title') value = cleanText(value, 240);
          if (change.field === 'description') value = cleanText(value);
          if (change.field === 'status' && !['open', 'in_progress', 'waiting', 'completed'].includes(value)) continue;
          if (change.field === 'owner_email') {
            value = value ? cleanText(value, 320).toLowerCase() : null;
            if (value && !validMemberEmails.has(value)) continue;
          }
          if (change.field === 'due_at' || change.field === 'review_at') {
            value = cleanOptionalDate(value);
            if (value === undefined) continue;
          }
          fields[change.field] = value;
        }
        if (proposalType === 'create_task' && !cleanText(fields.title, 240)) continue;
        const proposalId = crypto.randomUUID();
        await env.OPS_DB.prepare(`
          INSERT INTO proposals (
            id, meeting_id, proposal_type, target_task_id, meeting_discussion_id,
            payload_json, evidence, confidence
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          proposalId,
          meetingId,
          proposalType,
          targetTaskId,
          meetingDiscussionId,
          JSON.stringify(fields),
          cleanText(taskProposal.evidence, 2000),
          Math.max(0, Math.min(1, Number(taskProposal.confidence) || 0)),
        ).run();
        if (targetTaskId) {
          proposedTaskEvents.push({
            taskId: targetTaskId,
            actorId: AI_ACTOR,
            actorType: 'ai',
            eventType: 'ai_update_proposed',
            newValue: fields,
            sourceType: 'meeting',
            sourceId: meetingId,
            metadata: { proposalId, evidence: taskProposal.evidence || '' },
          });
        }
      }
    }

    if (proposedTaskEvents.length) {
      await env.OPS_DB.batch(proposedTaskEvents.map((event) => taskEventStatement(env, event)));
    }
    await env.OPS_DB.prepare(`
      UPDATE meetings SET processing_status = 'ready', processing_error = NULL WHERE id = ?
    `).bind(meetingId).run();
  } catch (error) {
    await env.OPS_DB.batch([
      env.OPS_DB.prepare('DELETE FROM proposals WHERE meeting_id = ?').bind(meetingId),
      env.OPS_DB.prepare('DELETE FROM meeting_discussions WHERE meeting_id = ?').bind(meetingId),
      env.OPS_DB.prepare(`
        DELETE FROM discussions
        WHERE id NOT IN (SELECT discussion_id FROM meeting_discussions WHERE discussion_id IS NOT NULL)
          AND id NOT IN (SELECT discussion_id FROM tasks WHERE discussion_id IS NOT NULL)
      `),
      env.OPS_DB.prepare(`
        UPDATE discussions
        SET last_discussed_at = COALESCE((
          SELECT MAX(m.happened_at)
          FROM meeting_discussions md
          JOIN meetings m ON m.id = md.meeting_id
          WHERE md.discussion_id = discussions.id
        ), first_discussed_at)
      `),
    ]);
    await env.OPS_DB.prepare(`
      UPDATE meetings SET processing_status = 'failed', processing_error = ? WHERE id = ?
    `).bind(cleanText(error?.message || 'Unknown processing error.', 3000), meetingId).run();
    throw error;
  }
}

async function createMeeting(env, input, createdBy) {
  const title = cleanText(input.title, 240);
  const rawNotes = cleanText(input.notes, 100000);
  const happenedAt = cleanOptionalDate(input.happened_at);
  if (!title || !rawNotes || !happenedAt) throw new Error('Title, valid meeting date, and notes are required.');
  const externalSourceId = cleanText(input.external_source_id, 500) || null;
  if (externalSourceId) {
    const existing = await env.OPS_DB.prepare(`
      SELECT id, processing_status FROM meetings WHERE external_source_id = ?
    `).bind(externalSourceId).first();
    if (existing) return { duplicate: true, meetingId: existing.id, status: existing.processing_status };
  }

  const meetingId = crypto.randomUUID();
  await env.OPS_DB.prepare(`
    INSERT INTO meetings (
      id, external_source_id, title, happened_at, participants_json, raw_notes,
      source_url, created_by_email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    meetingId,
    externalSourceId,
    title,
    happenedAt,
    JSON.stringify(Array.isArray(input.participants) ? input.participants.slice(0, 20) : []),
    rawNotes,
    cleanText(input.source_url, 1000) || null,
    createdBy,
  ).run();
  return { duplicate: false, meetingId, status: 'pending' };
}

async function ingestMeeting(request, env, createdBy) {
  const input = await request.json();
  let created;
  try {
    created = await createMeeting(env, input, createdBy);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
  if (created.duplicate && !['failed', 'pending'].includes(created.status)) {
    return json(created);
  }
  try {
    await processMeeting(env, created.meetingId);
    return json({ ...created, status: 'ready' }, 201);
  } catch (error) {
    return json({ ...created, status: 'failed', error: error.message }, 502);
  }
}

async function reviewProposal(request, env, identity, proposalId) {
  const proposal = await env.OPS_DB.prepare('SELECT * FROM proposals WHERE id = ?').bind(proposalId).first();
  if (!proposal) return json({ error: 'Proposal not found.' }, 404);
  if (proposal.status !== 'pending') return json({ error: 'Proposal has already been reviewed.' }, 409);
  const body = await request.json();
  if (!['approve', 'reject'].includes(body.decision)) return json({ error: 'Invalid decision.' }, 400);
  const payload = JSON.parse(proposal.payload_json);

  if (body.decision === 'reject') {
    await env.OPS_DB.prepare(`
      UPDATE proposals SET status = 'rejected', reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(identity.email, proposalId).run();
    if (proposal.target_task_id) {
      await recordTaskEvent(env, {
        taskId: proposal.target_task_id,
        actorId: identity.email,
        actorType: 'human',
        eventType: 'ai_proposal_rejected',
        sourceType: 'meeting',
        sourceId: proposal.meeting_id,
        metadata: { proposalId },
      });
    }
    return json({ ok: true });
  }

  const selectedFields = Array.isArray(body.fields)
    ? body.fields.filter((field) => Object.hasOwn(payload, field) && TASK_FIELDS.has(field))
    : Object.keys(payload).filter((field) => TASK_FIELDS.has(field));
  if (!selectedFields.length) return json({ error: 'Select at least one field.' }, 400);

  let taskId = proposal.target_task_id;
  if (proposal.proposal_type === 'create_task') {
    const title = cleanText(payload.title, 240);
    if (!title) return json({ error: 'The proposed task has no title.' }, 400);
    const values = Object.fromEntries(selectedFields.map((field) => [field, payload[field]]));
    const status = TASK_STATUSES.has(values.status) ? values.status : 'open';
    const result = await env.OPS_DB.prepare(`
      INSERT INTO tasks (
        title, description, status, owner_email, due_at, review_at, discussion_id, created_by_email
      ) VALUES (?, ?, ?, ?, ?, ?, (
        SELECT discussion_id FROM meeting_discussions WHERE id = ?
      ), ?)
    `).bind(
      title,
      cleanText(values.description),
      status,
      values.owner_email || null,
      cleanOptionalDate(values.due_at) ?? null,
      cleanOptionalDate(values.review_at) ?? null,
      proposal.meeting_discussion_id,
      identity.email,
    ).run();
    taskId = result.meta.last_row_id;
    await recordTaskEvent(env, {
      taskId,
      actorId: AI_ACTOR,
      actorType: 'ai',
      eventType: 'task_proposed',
      newValue: payload,
      sourceType: 'meeting',
      sourceId: proposal.meeting_id,
      metadata: { proposalId },
    });
    await recordTaskEvent(env, {
      taskId,
      actorId: identity.email,
      actorType: 'human',
      eventType: 'task_created_from_proposal',
      newValue: values,
      sourceType: 'meeting',
      sourceId: proposal.meeting_id,
      metadata: { proposalId, proposedBy: AI_ACTOR },
    });
  } else {
    const existing = await env.OPS_DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first();
    if (!existing) return json({ error: 'The target task no longer exists.' }, 409);
    const assignments = [];
    const values = [];
    for (const field of selectedFields) {
      const value = payload[field];
      assignments.push(`${field} = ?`);
      values.push(value);
    }
    assignments.push('updated_at = CURRENT_TIMESTAMP');
    if (selectedFields.includes('status') && payload.status === 'completed') {
      assignments.push('completed_at = CURRENT_TIMESTAMP');
    } else if (selectedFields.includes('status')) {
      assignments.push('completed_at = NULL');
    }
    await env.OPS_DB.prepare(`UPDATE tasks SET ${assignments.join(', ')} WHERE id = ?`)
      .bind(...values, taskId)
      .run();
    for (const field of selectedFields) {
      await recordTaskEvent(env, {
        taskId,
        actorId: identity.email,
        actorType: 'human',
        eventType: 'ai_change_approved',
        fieldName: field,
        oldValue: existing[field],
        newValue: payload[field],
        sourceType: 'meeting',
        sourceId: proposal.meeting_id,
        metadata: { proposalId, proposedBy: AI_ACTOR },
      });
    }
  }

  const status = selectedFields.length === Object.keys(payload).length ? 'approved' : 'partially_approved';
  await env.OPS_DB.prepare(`
    UPDATE proposals
    SET status = ?, target_task_id = ?, reviewed_by_email = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(status, taskId, identity.email, proposalId).run();
  return json({ ok: true, task: await getTask(env, taskId) });
}

async function verifyIngestToken(request, env) {
  const supplied = request.headers.get('Authorization') || '';
  if (!env.MEETING_INGEST_TOKEN || !supplied.startsWith('Bearer ')) return false;
  const left = new TextEncoder().encode(supplied.slice(7));
  const right = new TextEncoder().encode(env.MEETING_INGEST_TOKEN);
  if (left.length !== right.length) return false;
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', left),
    crypto.subtle.digest('SHA-256', right),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

export async function handleOpsRequest(request, env, executionContext) {
  const url = new URL(request.url);

  if (url.pathname === '/__ops/ingest') {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    if (!env.OPS_DB) return json({ error: 'Ops database is not configured.' }, 503);
    if (!(await verifyIngestToken(request, env))) return json({ error: 'Unauthorized.' }, 401);
    const systemUser = await env.OPS_DB.prepare(`
      SELECT email FROM workspace_users WHERE active = 1 ORDER BY role = 'owner' DESC, created_at LIMIT 1
    `).first();
    if (!systemUser) return json({ error: 'No workspace owner is configured.' }, 503);
    return ingestMeeting(request, env, systemUser.email);
  }

  const auth = await requireIdentity(request, env);
  if (auth.error) return auth.error;
  const identity = auth.identity;

  try {
    if (url.pathname === '/ops/api/bootstrap' && request.method === 'GET') {
      return json(await getBootstrap(env, identity));
    }
    if (url.pathname === '/ops/api/tasks' && request.method === 'POST') {
      return createTask(request, env, identity);
    }
    const taskMatch = url.pathname.match(/^\/ops\/api\/tasks\/(\d+)$/);
    if (taskMatch && request.method === 'GET') {
      const task = await getTask(env, Number(taskMatch[1]));
      return task ? json({ task }) : json({ error: 'Task not found.' }, 404);
    }
    if (taskMatch && request.method === 'PATCH') {
      return updateTask(request, env, identity, Number(taskMatch[1]));
    }
    const noteMatch = url.pathname.match(/^\/ops\/api\/tasks\/(\d+)\/notes$/);
    if (noteMatch && request.method === 'POST') {
      return addTaskNote(request, env, identity, Number(noteMatch[1]));
    }
    const meetingMatch = url.pathname.match(/^\/ops\/api\/meetings\/([a-f0-9-]+)$/);
    if (meetingMatch && request.method === 'GET') {
      const meeting = await getMeeting(env, meetingMatch[1]);
      return meeting ? json({ meeting }) : json({ error: 'Meeting not found.' }, 404);
    }
    if (url.pathname === '/ops/api/meetings' && request.method === 'POST') {
      return ingestMeeting(request, env, identity.email);
    }
    const proposalMatch = url.pathname.match(/^\/ops\/api\/proposals\/([a-f0-9-]+)\/review$/);
    if (proposalMatch && request.method === 'POST') {
      return reviewProposal(request, env, identity, proposalMatch[1]);
    }
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    return json({ error: error?.message || 'Unexpected Ops error.' }, 500);
  }
}

export async function getOpsPageIdentity(request, env) {
  if (!env.OPS_DB) return { ok: false, status: 503, message: 'The Ops database has not been configured yet.' };
  const identity = await verifyAccessIdentity(request, env);
  if (!identity) return { ok: false, status: 401, message: 'Sign in through Cloudflare Access to open Prime Analytics Ops.' };
  const user = await ensureWorkspaceUser(env, identity);
  if (!user) return { ok: false, status: 403, message: 'This Gmail account is not authorized for this workspace.' };
  return { ok: true, identity: { ...identity, ...user } };
}

const state = {
  data: null,
  currentView: 'latest',
  taskFilter: 'active',
  search: '',
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date(value);
}

function formatDate(value, options = {}) {
  if (!value) return 'No date';
  const date = parseDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: options.year ? 'numeric' : undefined,
    ...options,
  }).format(date);
}

function relativeTaskDate(task) {
  const value = task.due_at || task.review_at;
  if (!value) return { text: '', overdue: false };
  const label = task.due_at ? 'Due' : 'Review';
  const date = parseDate(value);
  const overdue = task.status !== 'completed' && date < new Date(new Date().toDateString());
  return { text: `${label} ${formatDate(value)}`, overdue };
}

function statusLabel(status) {
  return {
    open: 'Open',
    in_progress: 'In progress',
    waiting: 'Waiting',
    completed: 'Completed',
    archived: 'Archived',
  }[status] || status;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function showNotice(message, type = '') {
  const notice = $('#notice');
  notice.textContent = message;
  notice.className = `notice ${type}`.trim();
  window.clearTimeout(showNotice.timer);
  showNotice.timer = window.setTimeout(() => notice.classList.add('hidden'), 6000);
}

function ownerLabel(task) {
  if (task.owner_name) return task.owner_name;
  if (task.owner_email) return task.owner_email.split('@')[0];
  return 'Unassigned';
}

function taskRow(task) {
  const template = $('#task-row-template').content.cloneNode(true);
  const row = $('.task-row', template);
  row.dataset.taskId = task.id;
  row.classList.toggle('completed', task.status === 'completed');
  $('.task-main strong', row).textContent = task.title;
  $('.task-main small', row).textContent = `${task.code} · ${statusLabel(task.status)}`;
  $('.task-owner', row).textContent = ownerLabel(task);
  const date = relativeTaskDate(task);
  $('.task-date', row).textContent = date.text;
  $('.task-date', row).classList.toggle('overdue', date.overdue);
  return template;
}

function renderTaskRows(container, tasks, emptyMessage) {
  container.replaceChildren();
  if (!tasks.length) {
    container.innerHTML = `<p class="empty-inline">${escapeHtml(emptyMessage)}</p>`;
    return;
  }
  tasks.forEach((task) => container.append(taskRow(task)));
}

function renderLatest() {
  const { latestMeeting, latestDiscussions, latestProposals, tasks } = state.data;
  const empty = $('#empty-latest');
  const content = $('#latest-content');
  if (!latestMeeting) {
    $('#latest-title').textContent = 'Your latest meeting';
    $('#latest-date').textContent = '';
    empty.classList.remove('hidden');
    content.classList.add('hidden');
    $('#review-banner').classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  content.classList.remove('hidden');
  $('#latest-title').textContent = latestMeeting.title;
  $('#latest-date').textContent = formatDate(latestMeeting.happened_at, {
    year: 'numeric',
    weekday: 'long',
  });

  const banner = $('#review-banner');
  if (latestProposals.length) {
    const creates = latestProposals.filter((proposal) => proposal.proposal_type === 'create_task').length;
    const updates = latestProposals.length - creates;
    $('#review-banner-title').textContent = `${formatDate(latestMeeting.happened_at)} meeting is ready to review`;
    $('#review-banner-detail').textContent = `${creates} new action${creates === 1 ? '' : 's'} · ${updates} suggested update${updates === 1 ? '' : 's'}`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }

  const discussionList = $('#discussion-list');
  discussionList.replaceChildren();
  if (!latestDiscussions.length) {
    discussionList.innerHTML = '<p class="empty-inline">The meeting is still being processed.</p>';
  } else {
    latestDiscussions.forEach((discussion) => {
      const article = document.createElement('article');
      article.className = 'discussion';
      article.innerHTML = `
        <div>
          <h3>${escapeHtml(discussion.title)}</h3>
          <p class="discussion-meta">${discussion.resurfaced
            ? `First discussed ${escapeHtml(formatDate(discussion.first_discussed_at, { year: 'numeric' }))}`
            : 'New discussion'}</p>
        </div>
        <p>${escapeHtml(discussion.summary)}</p>
        ${discussion.resurfaced ? '<span class="resurfaced">Resurfaced</span>' : ''}
      `;
      discussionList.append(article);
    });
  }

  const attention = tasks
    .filter((task) => !['completed', 'archived'].includes(task.status))
    .slice(0, 5);
  renderTaskRows($('#attention-list'), attention, 'No active tasks need attention.');
}

function renderTasks() {
  const query = state.search.toLowerCase();
  const tasks = state.data.tasks.filter((task) => {
    if (state.taskFilter === 'active' && ['completed', 'archived'].includes(task.status)) return false;
    if (state.taskFilter === 'mine' && task.owner_email !== state.data.user.email) return false;
    if (state.taskFilter === 'completed' && task.status !== 'completed') return false;
    if (query && !`${task.code} ${task.title} ${task.description || ''}`.toLowerCase().includes(query)) return false;
    return true;
  });
  renderTaskRows($('#all-task-list'), tasks, 'No tasks match this view.');
}

function renderMeetings() {
  const container = $('#meeting-list');
  container.replaceChildren();
  if (!state.data.meetings.length) {
    container.innerHTML = '<p class="empty-inline">No meeting notes have been imported yet.</p>';
    return;
  }
  state.data.meetings.forEach((meeting) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'meeting-row';
    row.dataset.meetingId = meeting.id;
    row.innerHTML = `
      <time>${escapeHtml(formatDate(meeting.happened_at, { year: 'numeric' }))}</time>
      <span>
        <strong>${escapeHtml(meeting.title)}</strong>
        <small>${escapeHtml(meeting.summary || 'Processing notes…')}</small>
      </span>
      <span class="status ${escapeHtml(meeting.processing_status)}">${escapeHtml(meeting.processing_status)}</span>
    `;
    container.append(row);
  });
}

function renderShell() {
  $('#loading-view').classList.add('hidden');
  $$('.view').forEach((view) => view.classList.toggle('hidden', view.dataset.view !== state.currentView));
  $$('[data-view-link]').forEach((link) => link.classList.toggle('active', link.dataset.viewLink === state.currentView));
  $('#user-name').textContent = state.data.user.displayName;
  $('#user-avatar').textContent = state.data.user.displayName.slice(0, 1).toUpperCase();
  $('#review-count').textContent = state.data.pendingProposalCount;
  $('.review-link').classList.toggle('hidden', !state.data.pendingProposalCount);
  renderLatest();
  renderTasks();
  renderMeetings();
}

async function refresh() {
  state.data = await api('/ops/api/bootstrap');
  renderShell();
}

function setView(view) {
  state.currentView = view;
  renderShell();
  history.replaceState(null, '', view === 'latest' ? '/ops' : `/ops#${view}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function eventDescription(event) {
  const actor = event.actor_type === 'ai'
    ? 'Prime Ops AI'
    : event.actor_id === state.data.user.email
      ? 'You'
      : event.actor_id.split('@')[0];
  const field = event.field_name ? event.field_name.replace(/_/g, ' ') : '';
  const value = event.newValue === null || event.newValue === undefined
    ? ''
    : typeof event.newValue === 'object'
      ? JSON.stringify(event.newValue)
      : String(event.newValue);
  const descriptions = {
    task_created: `${actor} created this task`,
    field_changed: `${actor} changed ${field} to ${value || 'empty'}`,
    note_added: `${actor} added a manual note`,
    ai_update_proposed: `Prime Ops AI proposed an update`,
    ai_proposal_rejected: `${actor} rejected an AI proposal`,
    task_proposed: `Prime Ops AI proposed this task`,
    task_created_from_proposal: `${actor} approved and created this task`,
    ai_change_approved: `${actor} approved the proposed ${field} change`,
  };
  return descriptions[event.event_type] || `${actor}: ${event.event_type.replace(/_/g, ' ')}`;
}

async function openTask(taskId) {
  const { task } = await api(`/ops/api/tasks/${taskId}`);
  $('#task-dialog-code').textContent = task.code;
  $('#task-dialog-title').textContent = task.title;
  const detail = $('#task-detail');
  const dateInput = (value) => value ? String(value).slice(0, 10) : '';
  const ownerOptions = [
    '<option value="">Unassigned</option>',
    ...state.data.users.map((user) => `<option value="${escapeHtml(user.email)}" ${task.owner_email === user.email ? 'selected' : ''}>${escapeHtml(user.display_name)}</option>`),
  ].join('');
  detail.innerHTML = `
    <form id="task-edit-form">
      <div class="detail-grid">
        <label class="detail-field"><span>Status</span>
          <select name="status">
            ${['open', 'in_progress', 'waiting', 'completed', 'archived'].map((status) => `<option value="${status}" ${task.status === status ? 'selected' : ''}>${statusLabel(status)}</option>`).join('')}
          </select>
        </label>
        <label class="detail-field"><span>Owner</span><select name="owner_email">${ownerOptions}</select></label>
        <label class="detail-field"><span>Due</span><input name="due_at" type="date" value="${escapeHtml(dateInput(task.due_at))}"></label>
        <label class="detail-field"><span>Review</span><input name="review_at" type="date" value="${escapeHtml(dateInput(task.review_at))}"></label>
      </div>
      <label class="stacked-form" style="padding:0">
        <span>Title</span>
        <input name="title" value="${escapeHtml(task.title)}" maxlength="240" required>
        <span>Description</span>
        <textarea name="description" rows="3">${escapeHtml(task.description || '')}</textarea>
      </label>
      <div class="dialog-actions"><button class="secondary-button" type="submit">Save changes</button></div>
    </form>

    <section class="detail-section">
      <h3>Manual notes</h3>
      <div>${task.notes.length ? task.notes.map((note) => `
        <article class="note">
          <p>${escapeHtml(note.body)}</p>
          <small>${escapeHtml(note.author_name || note.author_email)} · ${escapeHtml(formatDate(note.created_at, { year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</small>
        </article>
      `).join('') : '<p class="empty-inline">No manual notes yet.</p>'}</div>
      <form id="note-form" class="note-form">
        <label><span class="sr-only">Add a manual note</span><textarea name="body" rows="2" required placeholder="Add a manual note. AI will never overwrite it."></textarea></label>
        <button class="secondary-button" type="submit">Add note</button>
      </form>
    </section>

    <section class="detail-section">
      <h3>History</h3>
      <div class="history">${task.events.map((event) => `
        <article class="history-item">
          <time>${escapeHtml(formatDate(event.created_at, { year: 'numeric', hour: 'numeric', minute: '2-digit' }))}</time>
          <div>
            <p>${escapeHtml(eventDescription(event))}</p>
            ${event.source_type === 'meeting' ? '<small>Source: meeting notes</small>' : '<small>Source: manual change</small>'}
          </div>
        </article>
      `).join('') || '<p class="empty-inline">No history events yet.</p>'}</div>
    </section>
  `;

  $('#task-edit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/ops/api/tasks/${task.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: form.get('title'),
        description: form.get('description'),
        status: form.get('status'),
        owner_email: form.get('owner_email') || null,
        due_at: form.get('due_at') || null,
        review_at: form.get('review_at') || null,
      }),
    });
    await refresh();
    await openTask(task.id);
    showNotice('Task updated and recorded in its history.', 'success');
  });

  $('#note-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await api(`/ops/api/tasks/${task.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: form.get('body') }),
    });
    await refresh();
    await openTask(task.id);
    showNotice('Manual note added.', 'success');
  });
  $('#task-dialog').showModal();
}

async function openMeeting(meetingId) {
  const { meeting } = await api(`/ops/api/meetings/${meetingId}`);
  $('#meeting-dialog-date').textContent = formatDate(meeting.happened_at, { year: 'numeric' });
  $('#meeting-dialog-title').textContent = meeting.title;
  $('#meeting-detail').innerHTML = `
    <section class="meeting-summary">
      <p>${escapeHtml(meeting.summary || `Processing status: ${meeting.processing_status}`)}</p>
      ${meeting.source_url ? `<p style="margin-top:10px"><a href="${escapeHtml(meeting.source_url)}" target="_blank" rel="noopener">Open original in Google Drive</a></p>` : ''}
    </section>
    <section class="detail-section">
      <h3>Discussions</h3>
      ${meeting.discussions.map((discussion) => `
        <article class="meeting-discussion">
          <h3>${escapeHtml(discussion.title)} ${discussion.resurfaced ? '<span class="status processing">Resurfaced</span>' : ''}</h3>
          <p>${escapeHtml(discussion.summary)}</p>
          ${discussion.source_excerpt ? `<blockquote>“${escapeHtml(discussion.source_excerpt)}”</blockquote>` : ''}
        </article>
      `).join('') || '<p class="empty-inline">No discussions extracted yet.</p>'}
    </section>
    <section class="detail-section">
      <h3>Original notes</h3>
      <div class="raw-notes">${escapeHtml(meeting.raw_notes)}</div>
    </section>
  `;
  $('#meeting-dialog').showModal();
}

function proposalTitle(proposal) {
  return proposal.proposal_type === 'create_task'
    ? proposal.payload.title || 'New task'
    : `Update ${proposal.target_task_title || `PA-${proposal.target_task_id}`}`;
}

function openReview() {
  const proposals = state.data.latestProposals;
  const container = $('#proposal-list');
  container.replaceChildren();
  if (!proposals.length) {
    container.innerHTML = '<p class="empty-inline">The latest meeting has no changes awaiting review.</p>';
  } else {
    proposals.forEach((proposal) => {
      const card = document.createElement('article');
      card.className = 'proposal';
      const fields = Object.entries(proposal.payload);
      card.innerHTML = `
        <div class="proposal-top">
          <h3>${escapeHtml(proposalTitle(proposal))}</h3>
          <span class="status processing">${proposal.proposal_type === 'create_task' ? 'New task' : 'Suggested update'}</span>
        </div>
        ${proposal.evidence ? `<p class="proposal-evidence">Evidence: “${escapeHtml(proposal.evidence)}”</p>` : ''}
        <div class="field-review">
          ${fields.map(([field, value]) => `
            <div class="field-row">
              <input type="checkbox" value="${escapeHtml(field)}" checked aria-label="Apply ${escapeHtml(field)}">
              <label>${escapeHtml(field.replace(/_/g, ' '))}</label>
              <span>${escapeHtml(value === null ? 'Not specified' : value)}</span>
            </div>
          `).join('')}
        </div>
        <p class="preservation">Manual notes and unselected fields will be preserved.</p>
        <div class="proposal-actions">
          <button class="danger-button" type="button" data-review="reject">Reject</button>
          <button class="primary-button" type="button" data-review="approve">Approve selected</button>
        </div>
      `;
      $$('[data-review]', card).forEach((button) => button.addEventListener('click', async () => {
        const decision = button.dataset.review;
        const selectedFields = $$('input[type="checkbox"]:checked', card).map((checkbox) => checkbox.value);
        if (decision === 'approve' && !selectedFields.length) {
          showNotice('Select at least one field to approve.', 'error');
          return;
        }
        button.disabled = true;
        try {
          await api(`/ops/api/proposals/${proposal.id}/review`, {
            method: 'POST',
            body: JSON.stringify({ decision, fields: selectedFields }),
          });
          await refresh();
          openReview();
          showNotice(decision === 'approve' ? 'Changes approved.' : 'Proposal rejected.', 'success');
        } catch (error) {
          button.disabled = false;
          showNotice(error.message, 'error');
        }
      }));
      container.append(card);
    });
  }
  $('#review-dialog').showModal();
}

function openTaskForm() {
  const select = $('#new-task-owner');
  select.innerHTML = '<option value="">Unassigned</option>' + state.data.users
    .map((user) => `<option value="${escapeHtml(user.email)}">${escapeHtml(user.display_name)}</option>`)
    .join('');
  $('#task-form').reset();
  $('#form-dialog').showModal();
}

function openImportForm() {
  $('#meeting-form').reset();
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  $('#meeting-form [name="happened_at"]').value = local;
  $('#import-dialog').showModal();
}

document.addEventListener('click', async (event) => {
  const viewLink = event.target.closest('[data-view-link], [data-view-target]');
  if (viewLink) setView(viewLink.dataset.viewLink || viewLink.dataset.viewTarget);

  if (event.target.closest('[data-action="add-task"]')) openTaskForm();
  if (event.target.closest('[data-action="import-meeting"]')) openImportForm();
  if (event.target.closest('[data-action="open-review"]')) openReview();
  if (event.target.closest('[data-action="open-latest-meeting"]') && state.data.latestMeeting) {
    await openMeeting(state.data.latestMeeting.id);
  }

  const task = event.target.closest('[data-task-id]');
  if (task) {
    try { await openTask(Number(task.dataset.taskId)); } catch (error) { showNotice(error.message, 'error'); }
  }
  const meeting = event.target.closest('[data-meeting-id]');
  if (meeting) {
    try { await openMeeting(meeting.dataset.meetingId); } catch (error) { showNotice(error.message, 'error'); }
  }
  const close = event.target.closest('[data-close-dialog]');
  if (close) close.closest('dialog').close();
});

$$('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));

$$('[data-task-filter]').forEach((button) => button.addEventListener('click', () => {
  state.taskFilter = button.dataset.taskFilter;
  $$('[data-task-filter]').forEach((item) => item.classList.toggle('active', item === button));
  renderTasks();
}));

$('#task-search').addEventListener('input', (event) => {
  state.search = event.target.value;
  renderTasks();
});

$('#task-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await api('/ops/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        title: form.get('title'),
        description: form.get('description'),
        owner_email: form.get('owner_email') || null,
        status: form.get('status'),
        due_at: form.get('due_at') || null,
        review_at: form.get('review_at') || null,
      }),
    });
    event.currentTarget.closest('dialog').close();
    await refresh();
    showNotice('Task added and attributed to you.', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
  }
});

$('#meeting-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const submit = $('button[type="submit"]', event.currentTarget);
  submit.disabled = true;
  submit.textContent = 'Processing…';
  try {
    await api('/ops/api/meetings', {
      method: 'POST',
      body: JSON.stringify({
        title: form.get('title'),
        happened_at: new Date(form.get('happened_at')).toISOString(),
        participants: String(form.get('participants') || '').split(',').map((value) => value.trim()).filter(Boolean),
        source_url: form.get('source_url') || null,
        notes: form.get('notes'),
      }),
    });
    event.currentTarget.closest('dialog').close();
    await refresh();
    setView('latest');
    showNotice('Meeting processed and ready for review.', 'success');
  } catch (error) {
    showNotice(error.message, 'error');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Process notes';
  }
});

async function start() {
  const hash = location.hash.slice(1);
  if (['latest', 'tasks', 'meetings'].includes(hash)) state.currentView = hash;
  try {
    await refresh();
  } catch (error) {
    $('#loading-view').innerHTML = `
      <h1>Prime Analytics Ops</h1>
      <p>${escapeHtml(error.message)}</p>
      <p>If this is the first setup, configure Cloudflare Access and the Ops database.</p>
    `;
  }
}

start();

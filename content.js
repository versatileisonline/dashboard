// 1. Storage Helper Functions ---------

function loadStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(
      ['shadowTasks', 'taskPriorities', 'sidebarCollapsed', 'sortMode',
        'courseNotes', 'dismissedNotifications', 'courseLinks', 'customDueDates'],
      result => {
        resolve({
          shadowTasks: result.shadowTasks || [],
          taskPriorities: result.taskPriorities || {},
          sidebarCollapsed: result.sidebarCollapsed || false,
          sortMode: result.sortMode || 'date',
          courseNotes: result.courseNotes || {},
          dismissedNotifications: result.dismissedNotifications || {},
          courseLinks: result.courseLinks || {},
          customDueDates: result.customDueDates || {}
        });
      }
    );
  });
}

function saveStorage(shadowTasks, taskPriorities) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ shadowTasks, taskPriorities }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Versatile] saveStorage failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function saveCourseNotes(courseNotes) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ courseNotes }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Versatile] saveCourseNotes failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function saveDismissedNotifications(dismissedNotifications) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ dismissedNotifications }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Versatile] saveDismissedNotifications failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function saveCustomDueDates(customDueDates) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ customDueDates }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Versatile] saveCustomDueDates failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function saveCourseLinks(courseLinks) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ courseLinks }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Versatile] saveCourseLinks failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}


// 2. Date/formating helpers ----------

function getWeekBounds(offset = 0) {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay() + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function formatWeekLabel(offset = 0) {
  const { start, end } = getWeekBounds(offset);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmt = d => `${months[d.getMonth()]} ${d.getDate()}`;
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatDueDate(isoString) {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `Due: ${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()} at ${hours}:${minutes} ${ampm}`;
}

function toDatetimeLocalValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatNotifDate(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// 3. Misc Utilities ----------

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function getCourseIdFromUrl(pathname) {
  const match = pathname.match(/\/courses\/(\d+)/);
  return match ? Number(match[1]) : null;
}

// 4. Data Normalization ----------

function normalizeCanvasItem(item) {
  return {
    id: String(item.plannable_id),
    title: item.plannable.title,
    courseName: item.context_name || '',
    courseId: item.course_id,
    dueAt: item.plannable_date,
    source: 'canvas',
    description: '',
    url: item.html_url || item.plannable?.html_url || ''
  };
}

function filterCanvasItems(items, offset = 0, customDueDates = {}) {
  const { start, end } = getWeekBounds(offset);
  const allowed = new Set(['assignment', 'quiz']);

  return items.filter(item => {
    if (!allowed.has(item.plannable_type)) return false;
    if (item.submissions && item.submissions.submitted === true) return false;
    const effectiveDate = customDueDates[String(item.plannable_id)] || item.plannable_date;
    const due = new Date(effectiveDate);
    return due >= start && due <= end;
  });
}

// 4. Canvas Fetching ----------

async function fetchCanvasTasks() {
  const { start: weekStart } = getWeekBounds(0);
  const pastDate = new Date(weekStart);
  pastDate.setDate(weekStart.getDate() - 28);
  const futureDate = new Date(weekStart);
  futureDate.setDate(weekStart.getDate() + 28);
  const startDate = pastDate.toISOString().split('T')[0];
  const endDate = futureDate.toISOString().split('T')[0];

  let url = `/api/v1/planner/items?per_page=100&start_date=${startDate}&end_date=${endDate}`;
  const allData = [];

  try {
    while (url) {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        console.error(`[Versatile] Canvas API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const page = await response.json();
      allData.push(...page);

      // Follow Link: <url>; rel="next" header for pagination
      const linkHeader = response.headers.get('Link') || '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }

    return allData;

  } catch (err) {
    console.error('[Versatile] fetchCanvasTasks failed:', err);
    return null;
  }
}

async function fetchCanvasCourses() {
  const url = `/api/v1/users/self/favorites/courses`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[Versatile] Canvas API error (courses): ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    return data.filter(course => course.name && !course.access_restricted_by_date);

  } catch (err) {
    console.error('[Versatile] fetchCanvasCourses failed:', err);
    return [];
  }
}

async function fetchCanvasNotifications() {
  const url = `/api/v1/users/self/activity_stream`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[Versatile] Canvas API error (notifications): ${response.status} ${response.statusText}`);
      return [];
    }

    return await response.json();

  } catch (err) {
    console.error('[Versatile] fetchCanvasNotifications failed:', err);
    return [];
  }
}

// 5. Render ------

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function notifHash(notif) {
  return notif.html_url || `${notif.type}::${notif.title}::${notif.course_id}`;
}

function notifTypeLabel(notif) {
  switch (notif.type) {
    case 'Announcement': return 'Announcement';
    case 'DiscussionTopic': return 'Discussion';
    case 'Conversation': return 'Conversation';
    case 'Message': return 'Message';
    case 'Conference':
    case 'WebConference': return 'Conference';
    case 'Collaboration': return 'Collaboration';
    case 'Submission':
      if (notif.grade != null) return `Graded — ${notif.grade}`;
      if (notif.score != null) return `Graded — ${notif.score}`;
      return 'Submission';
    default: return notif.type || '';
  }
}

// For Canvas API URLs (may be relative paths or absolute https).
// Allows /path URLs and http(s):// URLs; blocks javascript:, data:, etc.
function isSafeCanvasUrl(url) {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function normalizeExternalUrl(rawUrl) {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function buildTaskCard(task, taskPriorities, canvasTasks, shadowTasks, refreshCallback, customDueDates = {}) {
  const priority = taskPriorities[task.id] || null;
  const card = document.createElement('div');
  card.className = 'cp-task-card' + (priority ? ` priority-${priority}` : '');

  // Build card structure via DOM — avoids XSS from task.id in attribute context
  // and from formatDueDate output in innerHTML
  const titlePlaceholder = document.createElement('p');
  titlePlaceholder.className = 'cp-title';
  card.appendChild(titlePlaceholder);

  const dateEl = document.createElement('p');
  dateEl.className = 'cp-task-date';
  const dateText = formatDueDate(task.dueAt) || '';
  dateEl.textContent = task.courseName ? `${task.courseName} — ${dateText}` : dateText;
  card.appendChild(dateEl);

  const priorityRow = document.createElement('div');
  priorityRow.className = 'vtask-priority-row';
  ['low', 'med', 'xtrm'].forEach(p => {
    const dot = document.createElement('button');
    dot.className = `vtask-dot vtask-dot-${p}${priority === p ? ' vtask-dot-active' : ''}`;
    dot.dataset.priority = p;
    dot.dataset.id = task.id;
    priorityRow.appendChild(dot);
  });
  card.appendChild(priorityRow);

  if (task.source === 'shadow') {
    const deleteActionsRow = document.createElement('div');
    deleteActionsRow.className = 'vtask-actions-row';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'vtask-delete-btn';
    deleteBtn.dataset.id = task.id;
    deleteBtn.title = 'Delete custom task';
    deleteBtn.textContent = 'Delete';
    deleteActionsRow.appendChild(deleteBtn);
    card.appendChild(deleteActionsRow);
  }

  // Build title element via DOM; isSafeCanvasUrl blocks javascript:/data: schemes
  const titleEl = card.querySelector('.cp-title');
  if (task.source === 'canvas' && task.url && isSafeCanvasUrl(task.url)) {
    const anchor = document.createElement('a');
    anchor.href = task.url;
    anchor.className = 'cp-canvas-link';
    anchor.textContent = task.title;
    titleEl.appendChild(anchor);
  } else {
    titleEl.textContent = task.title;
  }
  if (task.source === 'shadow') {
    const badge = document.createElement('span');
    badge.className = 'vtask-badge';
    badge.textContent = 'custom';
    titleEl.appendChild(document.createTextNode('\u00A0\u00A0'));
    titleEl.appendChild(badge);
  }

  // "edited" badge on the date line for Canvas tasks with a custom due date
  if (task.source === 'canvas' && task.isCustomDue) {
    const dateLine = card.querySelector('.cp-task-date');
    const badge = document.createElement('span');
    badge.className = 'vtask-badge';
    badge.textContent = 'edited';
    dateLine.appendChild(document.createTextNode('\u00A0\u00A0'));
    dateLine.appendChild(badge);
  }

  // Build external link via DOM to prevent javascript: URI injection
  if (task.source === 'shadow' && task.externalLink) {
    const linkP = document.createElement('p');
    linkP.className = 'cp-task-link';
    const anchor = document.createElement('a');
    anchor.href = task.externalLink;  // DOM property assignment
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = 'Open external link';
    linkP.appendChild(anchor);
    // Insert before the priority row
    card.querySelector('.vtask-priority-row').before(linkP);
  }

  // Edit due date controls for Canvas tasks
  if (task.source === 'canvas') {
    const actionsRow = document.createElement('div');
    actionsRow.className = 'vtask-actions-row';

    const editBtn = document.createElement('button');
    editBtn.className = 'vtask-delete-btn';
    editBtn.textContent = 'Edit due date';
    actionsRow.appendChild(editBtn);

    // Hoist resetBtn so the cancel handler can re-append it without recreating
    const resetBtn = document.createElement('button');
    resetBtn.className = 'vtask-delete-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', async () => {
      const updated = { ...customDueDates };
      delete updated[task.id];
      await saveCustomDueDates(updated);
      if (refreshCallback) {
        refreshCallback(shadowTasks, taskPriorities, updated);
      }
    });
    if (task.isCustomDue) {
      actionsRow.appendChild(resetBtn);
    }

    card.appendChild(actionsRow);

    editBtn.addEventListener('click', () => {
      actionsRow.innerHTML = '';
      const input = document.createElement('input');
      input.type = 'datetime-local';
      input.value = toDatetimeLocalValue(task.dueAt);
      input.className = 'vtask-due-edit-input';

      const saveBtn = document.createElement('button');
      saveBtn.className = 'vtask-delete-btn';
      saveBtn.textContent = 'Save';

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'vtask-delete-btn';
      cancelBtn.textContent = 'Cancel';

      actionsRow.appendChild(input);
      actionsRow.appendChild(saveBtn);
      actionsRow.appendChild(cancelBtn);

      saveBtn.addEventListener('click', async () => {
        const val = input.value;
        if (!val) return;
        const updated = { ...customDueDates, [task.id]: new Date(val).toISOString() };
        await saveCustomDueDates(updated);
        if (refreshCallback) {
          refreshCallback(shadowTasks, taskPriorities, updated);
        }
      });

      cancelBtn.addEventListener('click', () => {
        actionsRow.innerHTML = '';
        actionsRow.appendChild(editBtn);
        if (task.isCustomDue) {
          actionsRow.appendChild(resetBtn);
        }
      });
    });
  }

  card.querySelectorAll('.vtask-dot').forEach(btn => {
    btn.addEventListener('click', async () => {
      const clicked = btn.dataset.priority;
      const taskId = btn.dataset.id;
      const updated = { ...taskPriorities };

      if (updated[taskId] === clicked) {
        delete updated[taskId];
      } else {
        updated[taskId] = clicked;
      }

      await saveStorage(shadowTasks, updated);
      if (refreshCallback) {
        refreshCallback(shadowTasks, updated, customDueDates);
      } else {
        renderTodoSection(canvasTasks, shadowTasks, updated, customDueDates);
      }
    });
  });

  card.querySelectorAll('.vtask-delete-btn[data-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.dataset.id;
      const updatedShadow = shadowTasks.filter(taskItem => taskItem.id !== taskId);
      const updatedPriorities = { ...taskPriorities };
      delete updatedPriorities[taskId];
      await saveStorage(updatedShadow, updatedPriorities);
      if (refreshCallback) {
        refreshCallback(updatedShadow, updatedPriorities, customDueDates);
      } else {
        renderTodoSection(canvasTasks, updatedShadow, updatedPriorities, customDueDates);
      }
    });
  });

  return card;
}

const PRIORITY_RANK = { xtrm: 0, med: 1, low: 2 };
let sortMode = 'date'; // 'date' | 'priority'
let weekOffset = 0;
let rawCanvasTasks = [];

function sortTasks(tasks, taskPriorities) {
  if (sortMode === 'priority') {
    return [...tasks].sort((a, b) => {
      const pa = PRIORITY_RANK[taskPriorities[a.id]] ?? 3;
      const pb = PRIORITY_RANK[taskPriorities[b.id]] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(a.dueAt) - new Date(b.dueAt);
    });
  }
  return [...tasks].sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
}

function renderTodoSection(canvasTasks, shadowTasks, taskPriorities, customDueDates = {}) {
  const container = document.getElementById('versatile-todo-list');
  if (!container) return;
  container.innerHTML = '';

  const { start, end } = getWeekBounds(weekOffset);
  const filteredShadow = shadowTasks.filter(t => {
    const due = new Date(t.dueAt);
    return due >= start && due <= end;
  });

  const allTasks = sortTasks([
    ...canvasTasks.map(item => {
      const normalized = normalizeCanvasItem(item);
      const customDue = customDueDates[normalized.id];
      return customDue ? { ...normalized, dueAt: customDue, isCustomDue: true } : normalized;
    }),
    ...filteredShadow
  ], taskPriorities);

  if (allTasks.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No tasks due this week.</p>';
    return;
  }

  allTasks.forEach(task => {
    container.appendChild(buildTaskCard(
      task, taskPriorities, canvasTasks, shadowTasks,
      (updShadow, updPriorities, updCustomDueDates) => {
        const refiltered = filterCanvasItems(rawCanvasTasks, weekOffset, updCustomDueDates);
        renderTodoSection(refiltered, updShadow, updPriorities, updCustomDueDates);
      },
      customDueDates
    ));
  });
}

function renderTopicsSection(courses, context) {
  const container = document.getElementById('versatile-topics-list');
  if (!container) return;
  container.innerHTML = '';

  if (courses.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No active courses found.</p>';
    return;
  }

  courses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'cp-topic-card cp-topic-card--clickable';
    card.innerHTML = `
      <p class="cp-title">${sanitize(course.name)}</p>
      <p class="cp-task-date">Tap to view details &rsaquo;</p>
    `;
    card.addEventListener('click', () => openCourseDetail(course, context));
    container.appendChild(card);
  });
}

function renderNotificationsSection(notifications, context) {
  const container = document.getElementById('versatile-notifications-list');
  if (!container) return;
  container.innerHTML = '';

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No recent notifications.</p>';
    return;
  }

  const courseMap = {};
  (context.courses || []).forEach(c => { courseMap[c.id] = c.name; });

  // Filter out already-dismissed notifications, then take the 10 most recent
  const undismissed = notifications.filter(notif => {
    const courseKey = notif.course_id ? String(notif.course_id) : '__global__';
    const dismissed = (context.dismissedNotifications || {})[courseKey] || [];
    return !dismissed.includes(notifHash(notif));
  });

  const recentNotifs = undismissed.slice(0, 10);

  if (recentNotifs.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No recent notifications.</p>';
    return;
  }

  recentNotifs.forEach(notif => {
    const card = document.createElement('div');
    card.className = 'cp-topic-card';

    const rawTitle = notif.title || notif.message || `New ${notif.type}`;
    const cleanText = rawTitle.replace(/<[^>]*>?/gm, '');
    const textTitle = sanitize(cleanText).substring(0, 80) + (cleanText.length > 80 ? '...' : '');
    const typeLabel = notifTypeLabel(notif);
    const courseName = notif.course_id ? courseMap[notif.course_id] : null;
    const dateLabel = formatNotifDate(notif.created_at);

    card.innerHTML = `
      <p class="cp-title">${textTitle}</p>
      ${courseName ? `<p class="cp-task-date">${sanitize(courseName)}</p>` : ''}
      ${typeLabel ? `<p class="cp-task-date">${sanitize(typeLabel)}</p>` : ''}
      ${dateLabel ? `<p class="cp-task-date">${sanitize(dateLabel)}</p>` : ''}
    `;

    if (notif.html_url && isSafeCanvasUrl(notif.html_url)) {
      const linkP = document.createElement('p');
      linkP.className = 'cp-task-link';
      const anchor = document.createElement('a');
      anchor.href = notif.html_url;
      anchor.textContent = 'View details';
      linkP.appendChild(anchor);
      card.appendChild(linkP);
    }

    const courseKey = notif.course_id ? String(notif.course_id) : '__global__';
    const dismissRow = document.createElement('div');
    dismissRow.className = 'vtask-actions-row';
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'vtask-delete-btn';
    dismissBtn.textContent = 'Mark as Read';
    dismissBtn.addEventListener('click', async () => {
      const hash = notifHash(notif);
      const currentDismissed = (context.dismissedNotifications || {})[courseKey] || [];
      const updatedDismissed = {
        ...context.dismissedNotifications,
        [courseKey]: [...currentDismissed, hash]
      };
      Object.assign(context, { dismissedNotifications: updatedDismissed });
      await saveDismissedNotifications(updatedDismissed);
      card.remove();
      if (container.querySelectorAll('.cp-topic-card').length === 0) {
        container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No recent notifications.</p>';
      }
    });

    dismissRow.appendChild(dismissBtn);
    card.appendChild(dismissRow);
    container.appendChild(card);
  });
}

// 6. Course Detail Sub-Render Functions -------

function renderDetailTasks(course, context, container) {
  const { shadowTasks, taskPriorities, customDueDates = {} } = context;
  const canvasTasks = filterCanvasItems(rawCanvasTasks, weekOffset, customDueDates);
  const section = document.createElement('div');
  section.className = 'cp-section';

  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Tasks';
  section.appendChild(titleEl);

  const { start, end } = getWeekBounds(weekOffset);
  const filteredShadow = shadowTasks.filter(t => {
    const due = new Date(t.dueAt);
    return due >= start && due <= end;
  });

  const allTasks = sortTasks([
    ...canvasTasks.map(item => {
      const normalized = normalizeCanvasItem(item);
      const customDue = customDueDates[normalized.id];
      return customDue ? { ...normalized, dueAt: customDue, isCustomDue: true } : normalized;
    }),
    ...filteredShadow
  ], taskPriorities);

  const filtered = allTasks.filter(task =>
    task.source === 'canvas' ? task.courseId === course.id : task.courseName === course.name
  );

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cp-task-date';
    empty.style.padding = '4px 0';
    empty.textContent = 'No tasks due this week for this course.';
    section.appendChild(empty);
  } else {
    filtered.forEach(task => {
      section.appendChild(buildTaskCard(
        task, taskPriorities, canvasTasks, shadowTasks,
        (updShadow, updPriorities, updCustomDueDates) => {
          context.taskPriorities = updPriorities;
          context.shadowTasks = updShadow;
          context.customDueDates = updCustomDueDates;
          const refiltered = filterCanvasItems(rawCanvasTasks, weekOffset, updCustomDueDates);
          renderTodoSection(refiltered, updShadow, updPriorities, updCustomDueDates);
          openCourseDetail(course, context);
        },
        customDueDates
      ));
    });
  }

  container.appendChild(section);
}

function renderDetailNotes(course, context, container) {
  const courseKey = String(course.id);
  const section = document.createElement('div');
  section.className = 'cp-section';

  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Notes';
  section.appendChild(titleEl);

  const textarea = document.createElement('textarea');
  textarea.className = 'cp-notes-textarea';
  textarea.placeholder = 'Jot down notes for this course...';
  textarea.value = context.courseNotes[courseKey] || '';

  const statusEl = document.createElement('p');
  statusEl.className = 'cp-notes-status';

  const debouncedSave = debounce(async (value) => {
    const updated = { ...context.courseNotes, [courseKey]: value };
    context.courseNotes = updated;
    await saveCourseNotes(updated);
    statusEl.textContent = 'Saved';
    setTimeout(() => { statusEl.textContent = ''; }, 1500);
  }, 500);

  textarea.addEventListener('input', e => {
    statusEl.textContent = 'Saving...';
    debouncedSave(e.target.value);
  });

  section.appendChild(textarea);
  section.appendChild(statusEl);
  container.appendChild(section);
}

function renderDetailNotifications(course, context, container) {
  const courseKey = String(course.id);
  const dismissed = context.dismissedNotifications[courseKey] || [];

  const section = document.createElement('div');
  section.className = 'cp-section';

  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Announcements';
  section.appendChild(titleEl);

  const courseNotifs = (context.notifications || []).filter(notif => {
    if (notif.course_id !== course.id) return false;
    return !dismissed.includes(notifHash(notif));
  });

  const list = document.createElement('div');

  if (courseNotifs.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'cp-task-date';
    empty.style.padding = '4px 0';
    empty.textContent = 'No announcements for this course.';
    list.appendChild(empty);
  } else {
    courseNotifs.forEach(notif => {
      const card = document.createElement('div');
      card.className = 'cp-topic-card';

      const rawTitle = notif.title || notif.message || `New ${notif.type}`;
      const cleanText = rawTitle.replace(/<[^>]*>?/gm, '');
      const textTitle = sanitize(cleanText).substring(0, 80) + (cleanText.length > 80 ? '...' : '');

      const typeLabel = notifTypeLabel(notif);
      const dateLabel = formatNotifDate(notif.created_at);
      card.innerHTML = `
        <p class="cp-title">${textTitle}</p>
        ${typeLabel ? `<p class="cp-task-date">${sanitize(typeLabel)}</p>` : ''}
        ${dateLabel ? `<p class="cp-task-date">${sanitize(dateLabel)}</p>` : ''}
      `;
      if (notif.html_url && isSafeCanvasUrl(notif.html_url)) {
        const linkP = document.createElement('p');
        linkP.className = 'cp-task-link';
        const anchor = document.createElement('a');
        anchor.href = notif.html_url;
        anchor.textContent = 'View details';
        linkP.appendChild(anchor);
        card.appendChild(linkP);
      }

      const dismissRow = document.createElement('div');
      dismissRow.className = 'vtask-actions-row';
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'vtask-delete-btn';
      dismissBtn.textContent = 'Mark as Read';
      dismissBtn.addEventListener('click', async () => {
        const hash = notifHash(notif);
        const currentDismissed = context.dismissedNotifications[courseKey] || [];
        const updatedDismissed = {
          ...context.dismissedNotifications,
          [courseKey]: [...currentDismissed, hash]
        };
        Object.assign(context, { dismissedNotifications: updatedDismissed });
        await saveDismissedNotifications(updatedDismissed);
        card.remove();
        if (list.querySelectorAll('.cp-topic-card').length === 0) {
          const empty = document.createElement('p');
          empty.className = 'cp-task-date';
          empty.style.padding = '4px 0';
          empty.textContent = 'No announcements for this course.';
          list.appendChild(empty);
        }
      });

      dismissRow.appendChild(dismissBtn);
      card.appendChild(dismissRow);
      list.appendChild(card);
    });
  }

  section.appendChild(list);
  container.appendChild(section);
}

function renderDetailLinks(course, context, container) {
  const courseKey = String(course.id);

  const section = document.createElement('div');
  section.className = 'cp-section';

  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Links';
  section.appendChild(titleEl);

  const list = document.createElement('div');

  function rebuildLinksList(currentLinks) {
    list.innerHTML = '';
    if (currentLinks.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'cp-task-date';
      empty.style.padding = '4px 0';
      empty.textContent = 'No links added yet.';
      list.appendChild(empty);
      return;
    }
    currentLinks.forEach(link => {
      const card = document.createElement('div');
      card.className = 'cp-topic-card';

      const titleP = document.createElement('p');
      titleP.className = 'cp-title';
      titleP.style.fontWeight = 'normal';
      const anchor = document.createElement('a');
      anchor.href = link.url;  // DOM property assignment
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.className = 'cp-link-anchor';
      anchor.textContent = link.label || link.url;
      titleP.appendChild(anchor);
      card.appendChild(titleP);

      const deleteRow = document.createElement('div');
      deleteRow.className = 'vtask-actions-row';
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'vtask-delete-btn';
      deleteBtn.textContent = 'Remove';
      deleteBtn.addEventListener('click', async () => {
        const updatedLinks = currentLinks.filter(l => l.id !== link.id);
        const updatedCourseLinks = { ...context.courseLinks, [courseKey]: updatedLinks };
        context.courseLinks = updatedCourseLinks;
        await saveCourseLinks(updatedCourseLinks);
        rebuildLinksList(updatedLinks);
      });

      deleteRow.appendChild(deleteBtn);
      card.appendChild(deleteRow);
      list.appendChild(card);
    });
  }

  rebuildLinksList(context.courseLinks[courseKey] || []);
  section.appendChild(list);

  // Add link button + inline form
  const addBtn = document.createElement('button');
  addBtn.className = 'cp-add-link-btn';
  addBtn.textContent = '+ Add Link';

  const form = document.createElement('div');
  form.className = 'cp-add-link-form';
  form.style.display = 'none';
  form.innerHTML = `
    <input type="text" class="cp-link-url-input" placeholder="URL (required)" />
    <input type="text" class="cp-link-label-input" placeholder="Label (optional)" />
    <div class="vtask-form-actions">
      <button class="cp-link-cancel-btn vtask-delete-btn">Cancel</button>
      <button class="cp-link-save-btn">Add</button>
    </div>
  `;

  addBtn.addEventListener('click', () => {
    form.style.display = 'flex';
    addBtn.style.display = 'none';
  });

  const cancelBtn = form.querySelector('.cp-link-cancel-btn');
  cancelBtn.addEventListener('click', () => {
    form.querySelector('.cp-link-url-input').value = '';
    form.querySelector('.cp-link-label-input').value = '';
    form.querySelector('.cp-link-url-input').style.borderColor = '';
    form.style.display = 'none';
    addBtn.style.display = 'block';
  });

  const saveBtn = form.querySelector('.cp-link-save-btn');
  saveBtn.addEventListener('click', async () => {
    const urlInput = form.querySelector('.cp-link-url-input');
    const labelInput = form.querySelector('.cp-link-label-input');
    const normalizedUrl = normalizeExternalUrl(urlInput.value);

    urlInput.style.borderColor = '';
    if (!normalizedUrl) {
      urlInput.style.borderColor = '#ff0000';
      return;
    }

    const newLink = {
      id: Date.now().toString(),
      label: labelInput.value.trim(),
      url: normalizedUrl
    };

    const currentLinks = context.courseLinks[courseKey] || [];
    const updatedLinks = [...currentLinks, newLink];
    const updatedCourseLinks = { ...context.courseLinks, [courseKey]: updatedLinks };
    context.courseLinks = updatedCourseLinks;
    await saveCourseLinks(updatedCourseLinks);

    rebuildLinksList(updatedLinks);
    urlInput.value = '';
    labelInput.value = '';
    form.style.display = 'none';
    addBtn.style.display = 'block';
  });

  section.appendChild(addBtn);
  section.appendChild(form);
  container.appendChild(section);
}

// 7. Handlers -------

async function handleAddTask(canvasTasks) {
  const titleEl = document.getElementById('vtask-title');
  const courseEl = document.getElementById('vtask-course');
  const linkEl = document.getElementById('vtask-link');
  const dueEl = document.getElementById('vtask-due');
  const descEl = document.getElementById('vtask-desc');

  const title = titleEl.value.trim();
  const courseName = courseEl.value.trim();
  const normalizedLink = normalizeExternalUrl(linkEl.value);
  const due = dueEl.value;

  titleEl.style.borderColor = '';
  linkEl.style.borderColor = '';
  dueEl.style.borderColor = '';

  let valid = true;
  if (!title) { titleEl.style.borderColor = '#ff0000'; valid = false; }
  if (!due) { dueEl.style.borderColor = '#ff0000'; valid = false; }
  if (normalizedLink === null) { linkEl.style.borderColor = '#ff0000'; valid = false; }
  if (!valid) return;

  const newTask = {
    id: Date.now().toString(),
    title,
    courseName,
    dueAt: new Date(due).toISOString(),
    source: 'shadow',
    description: descEl.value.trim(),
    externalLink: normalizedLink
  };

  const { shadowTasks, taskPriorities } = await loadStorage();
  const updatedShadow = [...shadowTasks, newTask];
  await saveStorage(updatedShadow, taskPriorities);

  resetAddTaskForm();
  renderTodoSection(canvasTasks, updatedShadow, taskPriorities);
}

function resetAddTaskForm() {
  document.getElementById('vtask-title').value = '';
  document.getElementById('vtask-course').value = '';
  document.getElementById('vtask-link').value = '';
  document.getElementById('vtask-desc').value = '';
  document.getElementById('vtask-due').value = '';
  document.getElementById('vtask-title').style.borderColor = '';
  document.getElementById('vtask-link').style.borderColor = '';
  document.getElementById('vtask-due').style.borderColor = '';
  document.getElementById('versatile-add-task-form').style.display = 'none';
  document.getElementById('versatile-add-task-btn').style.display = 'block';
}

// 8. Sidebar Skeleton -------

function collapseSidebar() {
  document.getElementById('Versatile').style.display = 'none';
  document.getElementById('versatile-fab').style.display = 'flex';
  document.body.style.paddingRight = '';
  document.body.classList.add('versatile-hidden');
  chrome.storage.local.set({ sidebarCollapsed: true });
}

function expandSidebar() {
  document.getElementById('Versatile').style.display = 'flex';
  document.getElementById('versatile-fab').style.display = 'none';
  document.body.style.paddingRight = '350px';
  document.body.classList.remove('versatile-hidden');
  chrome.storage.local.set({ sidebarCollapsed: false });
}


function initSidebar(collapsed = false) {
  const sidebar = document.createElement('div');
  sidebar.id = 'Versatile';

  sidebar.innerHTML = `
    <div id="versatile-header">
      <h2>Canvas+</h2>
      <button id="versatile-collapse-btn" title="Hide sidebar">&#x2715;</button>
    </div>

    <div id="versatile-main-view">
      <div class="cp-section" id="versatile-todo-section">
        <div class="vtask-section-header">
          <div class="section-title">To-Do</div>
          <button id="versatile-sort-btn" title="Sort by date">Date</button>
        </div>
        <div class="vtask-week-nav">
          <button id="vtask-week-prev" title="Previous week">&#9664;</button>
          <span id="vtask-week-label"></span>
          <button id="vtask-week-next" title="Next week">&#9654;</button>
        </div>
        <div id="versatile-todo-list"></div>
        <button id="versatile-add-task-btn">+ Add Task</button>
        <div id="versatile-add-task-form" style="display:none;">
          <input type="text" id="vtask-title" placeholder="Title" />
          <div class="vtask-course-wrapper">
            <input type="text" id="vtask-course" placeholder="Course (optional)" autocomplete="off" />
            <div id="vtask-course-dropdown" class="vtask-course-dropdown"></div>
          </div>
          <input type="text" id="vtask-link" placeholder="External URL (optional)" />
          <textarea id="vtask-desc" placeholder="Description (optional)"></textarea>
          <input type="datetime-local" id="vtask-due" />
          <div class="vtask-form-actions">
            <button id="vtask-cancel">Cancel</button>
            <button id="vtask-submit">Add</button>
          </div>
        </div>
      </div>

      <div class="cp-section">
        <div class="section-title">Topics</div>
        <div id="versatile-topics-list"></div>
      </div>

      <div class="cp-section">
        <div class="section-title">Notifications</div>
        <div id="versatile-notifications-list"></div>
      </div>
    </div>

    <div id="versatile-course-detail" style="display:none;"></div>
  `;

  document.body.appendChild(sidebar);

  // FAB (floating button shown when sidebar is collapsed)
  const fab = document.createElement('button');
  fab.id = 'versatile-fab';
  fab.title = 'Open Versatile';
  const logoImg = document.createElement('img');
  logoImg.src = chrome.runtime.getURL('assets/canvas+_logo.png');
  logoImg.alt = 'Versatile';
  fab.appendChild(logoImg);
  document.body.appendChild(fab);

  if (collapsed) {
    sidebar.style.display = 'none';
    fab.style.display = 'flex';
    document.body.classList.add('versatile-hidden');
  } else {
    document.body.style.paddingRight = '350px';
  }

  document.getElementById('versatile-collapse-btn').addEventListener('click', collapseSidebar);
  fab.addEventListener('click', expandSidebar);

  document.getElementById('versatile-add-task-btn').addEventListener('click', () => {
    document.getElementById('versatile-add-task-form').style.display = 'block';
    document.getElementById('versatile-add-task-btn').style.display = 'none';
  });

  document.getElementById('vtask-cancel').addEventListener('click', () => {
    resetAddTaskForm();
  });
}

// 8b. Course Detail Navigation ----------

let activeCourseId = null;

function closeCourseDetail() {
  activeCourseId = null;
  document.getElementById('versatile-course-detail').style.display = 'none';
  document.getElementById('versatile-main-view').style.display = 'block';
  document.getElementById('Versatile').scrollTop = 0;
}

function openCourseDetail(course, context) {
  const isNewCourse = activeCourseId !== course.id;
  activeCourseId = course.id;
  document.getElementById('versatile-main-view').style.display = 'none';
  const detailEl = document.getElementById('versatile-course-detail');
  detailEl.style.display = 'block';
  detailEl.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'cp-detail-header';
  header.innerHTML = `
    <button class="cp-back-btn" title="Back to main view">&#8592;</button>
    <span class="cp-detail-course-name">${sanitize(course.name)}</span>
  `;
  header.querySelector('.cp-back-btn').addEventListener('click', closeCourseDetail);
  detailEl.appendChild(header);

  renderDetailTasks(course, context, detailEl);
  renderDetailNotes(course, context, detailEl);
  renderDetailNotifications(course, context, detailEl);
  renderDetailLinks(course, context, detailEl);

  if (isNewCourse) {
    document.getElementById('Versatile').scrollTop = 0;
  }
}

function initUrlWatcher(context) {
  function handleUrlChange() {
    const courseId = getCourseIdFromUrl(location.pathname);

    if (courseId) {
      const course = context.courses.find(c => c.id === courseId);
      if (course && activeCourseId !== courseId) {
        openCourseDetail(course, context);
      }
    } else {
      if (activeCourseId !== null) {
        closeCourseDetail();
      }
    }
  }

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    originalPushState(...args);
    handleUrlChange();
  };
  history.replaceState = function (...args) {
    originalReplaceState(...args);
    handleUrlChange();
  };

  window.addEventListener('popstate', handleUrlChange);

  // Check URL on initial load
  handleUrlChange();
}

// 9. Course Dropdown ----------

function initCourseDropdown(courses) {
  const input = document.getElementById('vtask-course');
  const dropdown = document.getElementById('vtask-course-dropdown');
  if (!input || !dropdown || courses.length === 0) return;

  const courseNames = courses.map(c => c.name);

  function showOptions(query) {
    const q = query.toLowerCase();
    const matches = q
      ? courseNames.filter(name => name.toLowerCase().includes(q))
      : courseNames;

    dropdown.innerHTML = '';
    if (matches.length === 0) { dropdown.style.display = 'none'; return; }

    matches.forEach(name => {
      const option = document.createElement('div');
      option.className = 'vtask-course-option';
      option.textContent = name;
      option.addEventListener('mousedown', (e) => {
        e.preventDefault(); // keeps focus on input so blur doesn't fire first
        input.value = name;
        dropdown.style.display = 'none';
      });
      dropdown.appendChild(option);
    });
    dropdown.style.display = 'block';
  }

  input.addEventListener('focus', () => showOptions(input.value));
  input.addEventListener('input', () => showOptions(input.value));
  input.addEventListener('blur', () => {
    dropdown.style.display = 'none';
  });
}

// 10. Bootstrap -------------

async function initVersatile() {
  if (document.getElementById('Versatile')) return;
  try {
    const storageData = await loadStorage();
    initSidebar(storageData.sidebarCollapsed);
    console.debug('[Versatile] Sidebar skeleton built.');

    const [rawItems, courses, notifications] = await Promise.all([
      fetchCanvasTasks(),
      fetchCanvasCourses(),
      fetchCanvasNotifications()
    ]);

    console.debug('[Versatile] Storage loaded:', {
      shadowTasks: storageData.shadowTasks.length,
      taskPriorities: Object.keys(storageData.taskPriorities).length,
      sidebarCollapsed: storageData.sidebarCollapsed,
      sortMode: storageData.sortMode
    });

    if (rawItems === null) {
      console.warn('[Versatile] Canvas API fetch failed — sidebar will show shadow tasks only. Check network tab for details.');
    } else {
      console.debug(`[Versatile] Canvas API returned ${rawItems.length} planner item(s).`);
    }

    const {
      shadowTasks, taskPriorities, sidebarCollapsed, sortMode: savedSortMode,
      courseNotes, dismissedNotifications, courseLinks, customDueDates
    } = storageData;
    rawCanvasTasks = rawItems || [];
    let canvasTasks = filterCanvasItems(rawCanvasTasks, weekOffset, customDueDates);

    if (rawItems && rawItems.length > 0 && canvasTasks.length === 0) {
      console.warn(`[Versatile] Canvas returned ${rawItems.length} item(s) but 0 passed the week filter — all may be outside this week's range or already submitted.`);
    } else if (canvasTasks.length > 0) {
      console.debug(`[Versatile] ${canvasTasks.length} Canvas task(s) due this week.`);
    }

    const context = {
      shadowTasks,
      taskPriorities,
      notifications,
      courseNotes,
      dismissedNotifications,
      courseLinks,
      courses,
      customDueDates
    };

    renderTopicsSection(courses, context);
    initCourseDropdown(courses);

    renderNotificationsSection(notifications, context);

    sortMode = savedSortMode;

    // Sort button toggle
    const sortBtn = document.getElementById('versatile-sort-btn');
    function updateSortBtn() {
      sortBtn.textContent = sortMode === 'date' ? 'Date' : 'Priority';
      sortBtn.classList.toggle('vtask-sort-active', sortMode === 'priority');
    }
    updateSortBtn();

    sortBtn.addEventListener('click', async () => {
      sortMode = sortMode === 'date' ? 'priority' : 'date';
      chrome.storage.local.set({ sortMode });
      updateSortBtn();
      const latestStorage = await loadStorage();
      const currentCanvasTasks = filterCanvasItems(rawCanvasTasks, weekOffset, latestStorage.customDueDates);
      renderTodoSection(currentCanvasTasks, latestStorage.shadowTasks, latestStorage.taskPriorities, latestStorage.customDueDates);
    });

    // Week navigation
    const weekLabel = document.getElementById('vtask-week-label');
    function updateWeekNav() {
      weekLabel.textContent = formatWeekLabel(weekOffset);
    }
    updateWeekNav();

    document.getElementById('vtask-week-prev').addEventListener('click', async () => {
      weekOffset--;
      updateWeekNav();
      const latest = await loadStorage();
      canvasTasks = filterCanvasItems(rawCanvasTasks, weekOffset, latest.customDueDates);
      renderTodoSection(canvasTasks, latest.shadowTasks, latest.taskPriorities, latest.customDueDates);
    });

    document.getElementById('vtask-week-next').addEventListener('click', async () => {
      weekOffset++;
      updateWeekNav();
      const latest = await loadStorage();
      canvasTasks = filterCanvasItems(rawCanvasTasks, weekOffset, latest.customDueDates);
      renderTodoSection(canvasTasks, latest.shadowTasks, latest.taskPriorities, latest.customDueDates);
    });

    document.getElementById('vtask-submit').addEventListener('click', () => {
      handleAddTask(canvasTasks);
    });

    renderTodoSection(canvasTasks, shadowTasks, taskPriorities, customDueDates);

    initUrlWatcher(context);

    const totalTasks = canvasTasks.length + shadowTasks.length;
    console.log(
      `%c[Versatile] Ready — ${totalTasks} task(s) loaded (${canvasTasks.length} from Canvas, ${shadowTasks.length} custom).`,
      'color: #00b050; font-weight: bold;'
    );

  } catch (err) {
    console.error('[Versatile] Initialization failed with an unexpected error:', err);
  }
}

initVersatile();

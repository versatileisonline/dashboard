// 1. Storage Helper Functions ---------

function loadStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(
      ['shadowTasks', 'taskPriorities', 'sidebarCollapsed', 'sortMode',
        'courseNotes', 'dismissedNotifications', 'courseLinks'],
      result => {
        resolve({
          shadowTasks: result.shadowTasks || [],
          taskPriorities: result.taskPriorities || {},
          sidebarCollapsed: result.sidebarCollapsed || false,
          sortMode: result.sortMode || 'date',
          courseNotes: result.courseNotes || {},
          dismissedNotifications: result.dismissedNotifications || {},
          courseLinks: result.courseLinks || {}
        });
      }
    );
  });
}

function saveStorage(shadowTasks, taskPriorities) {
  return new Promise(resolve => {
    chrome.storage.local.set({ shadowTasks, taskPriorities }, resolve);
  });
}

function saveCourseNotes(courseNotes) {
  return new Promise(resolve => chrome.storage.local.set({ courseNotes }, resolve));
}

function saveDismissedNotifications(dismissedNotifications) {
  return new Promise(resolve => chrome.storage.local.set({ dismissedNotifications }, resolve));
}

function saveCourseLinks(courseLinks) {
  return new Promise(resolve => chrome.storage.local.set({ courseLinks }, resolve));
}


// 2. Date/formating helpers ----------

function getEndOfWeek() {
  const now = new Date();
  const daysUntilSunday = (7 - now.getDay()) % 7;
  const end = new Date(now);
  end.setDate(now.getDate() + daysUntilSunday);
  end.setHours(23, 59, 59, 999);
  return end;
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
    description: ''
  };
}

function filterCanvasItems(items) {
  const now = new Date();
  const endOfWeek = getEndOfWeek();
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(now.getDate() - 14);
  const allowed = new Set(['assignment', 'quiz']);

  return items.filter(item => {
    if (!allowed.has(item.plannable_type)) return false;
    if (item.submissions && item.submissions.submitted === true) return false;
    const due = new Date(item.plannable_date);
    if (due < twoWeeksAgo) return false;
    if (due > endOfWeek) return false;
    return true;
  });
}

// 4. Canvas Fetching ----------

async function fetchCanvasTasks() {
  const today = new Date().toISOString().split('T')[0];
  const url = `/api/v1/planner/items?per_page=50&start_date=${today}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[Versatile] Canvas API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;

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

function normalizeExternalUrl(rawUrl) {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function buildTaskCard(task, taskPriorities, canvasTasks, shadowTasks) {
  const priority = taskPriorities[task.id] || null;
  const card = document.createElement('div');
  card.className = 'cp-task-card' + (priority ? ` priority-${priority}` : '');

  const badge = task.source === 'shadow'
    ? '<span class="vtask-badge">custom</span>'
    : '';

  const safeTitle = sanitize(task.title);
  const safeCoursePrefix = task.courseName ? `${sanitize(task.courseName)} — ` : '';
  const hasExternalLink = task.source === 'shadow' && !!task.externalLink;
  const externalLinkHtml = hasExternalLink
    ? `<p class="cp-task-link"><a href="${sanitize(task.externalLink)}" target="_blank" rel="noopener noreferrer">Open external link</a></p>`
    : '';
  const taskActionHtml = task.source === 'shadow'
    ? `<div class="vtask-actions-row"><button class="vtask-delete-btn" data-id="${task.id}" title="Delete custom task">Delete</button></div>`
    : '';

  card.innerHTML = `
    <p class="cp-title">${safeTitle}  ${badge}</p>
    <p class="cp-task-date">${safeCoursePrefix}${formatDueDate(task.dueAt)}</p>
    ${externalLinkHtml}
    <div class="vtask-priority-row">
      <button class="vtask-dot vtask-dot-low  ${priority === 'low' ? 'vtask-dot-active' : ''}" data-priority="low"  data-id="${task.id}"></button>
      <button class="vtask-dot vtask-dot-med  ${priority === 'med' ? 'vtask-dot-active' : ''}" data-priority="med"  data-id="${task.id}"></button>
      <button class="vtask-dot vtask-dot-xtrm ${priority === 'xtrm' ? 'vtask-dot-active' : ''}" data-priority="xtrm" data-id="${task.id}"></button>
    </div>
    ${taskActionHtml}
  `;

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
      renderTodoSection(canvasTasks, shadowTasks, updated);
    });
  });

  card.querySelectorAll('.vtask-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const taskId = btn.dataset.id;
      const updatedShadow = shadowTasks.filter(taskItem => taskItem.id !== taskId);
      const updatedPriorities = { ...taskPriorities };
      delete updatedPriorities[taskId];
      await saveStorage(updatedShadow, updatedPriorities);
      renderTodoSection(canvasTasks, updatedShadow, updatedPriorities);
    });
  });

  return card;
}

const PRIORITY_RANK = { xtrm: 0, med: 1, low: 2 };
let sortMode = 'date'; // 'date' | 'priority'

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

function renderTodoSection(canvasTasks, shadowTasks, taskPriorities) {
  const container = document.getElementById('versatile-todo-list');
  if (!container) return;
  container.innerHTML = '';

  const allTasks = sortTasks([
    ...canvasTasks.map(normalizeCanvasItem),
    ...shadowTasks
  ], taskPriorities);

  if (allTasks.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No tasks due this week.</p>';
    return;
  }

  allTasks.forEach(task => {
    container.appendChild(buildTaskCard(task, taskPriorities, canvasTasks, shadowTasks));
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

function renderNotificationsSection(notifications) {
  const container = document.getElementById('versatile-notifications-list');
  if (!container) return;
  container.innerHTML = '';

  if (!notifications || notifications.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No recent notifications.</p>';
    return;
  }

  // Limit to the 10 most recent notifications
  const recentNotifs = notifications.slice(0, 10);

  recentNotifs.forEach(notif => {
    const card = document.createElement('div');
    card.className = 'cp-topic-card';

    const rawTitle = notif.title || notif.message || `New ${notif.type}`;

    const cleanText = rawTitle.replace(/<[^>]*>?/gm, '');
    const textTitle = sanitize(cleanText).substring(0, 80) + (cleanText.length > 80 ? '...' : '');

    card.innerHTML = `<p class="cp-title">${textTitle}</p>`;

    if (notif.html_url) {
      card.innerHTML += `<p class="cp-task-link"><a href="${sanitize(notif.html_url)}" target="_blank">View details</a></p>`;
    }

    container.appendChild(card);
  });
}

// 6. Course Detail Sub-Render Functions -------

function renderDetailTasks(course, context, container) {
  const { canvasTasks, shadowTasks, taskPriorities } = context;
  const section = document.createElement('div');
  section.className = 'cp-section';

  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Tasks';
  section.appendChild(titleEl);

  const allTasks = sortTasks([
    ...canvasTasks.map(normalizeCanvasItem),
    ...shadowTasks
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
      section.appendChild(buildTaskCard(task, taskPriorities, canvasTasks, shadowTasks));
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

      card.innerHTML = `<p class="cp-title">${textTitle}</p>`;
      if (notif.html_url) {
        card.innerHTML += `<p class="cp-task-link"><a href="${sanitize(notif.html_url)}" target="_blank" rel="noopener noreferrer">View details</a></p>`;
      }

      const dismissRow = document.createElement('div');
      dismissRow.className = 'vtask-actions-row';
      const dismissBtn = document.createElement('button');
      dismissBtn.className = 'vtask-delete-btn';
      dismissBtn.textContent = 'Mark as Read';
      dismissBtn.addEventListener('click', async () => {
        const hash = notifHash(notif);
        const updatedDismissed = {
          ...context.dismissedNotifications,
          [courseKey]: [...dismissed, hash]
        };
        context.dismissedNotifications = updatedDismissed;
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

      const displayLabel = link.label || link.url;
      const safeUrl = sanitize(link.url);
      const safeLabel = sanitize(displayLabel);

      card.innerHTML = `
        <p class="cp-title" style="font-weight:normal;">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="cp-link-anchor">${safeLabel}</a>
        </p>
      `;

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


function initSidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'Versatile';

  sidebar.innerHTML = `
    <div id="versatile-header">
      <h2>Versatile</h2>
      <button id="versatile-collapse-btn" title="Hide sidebar">&#x2715;</button>
    </div>

    <div id="versatile-main-view">
      <div class="cp-section" id="versatile-todo-section">
        <div class="vtask-section-header">
          <div class="section-title">To-Do</div>
          <button id="versatile-sort-btn" title="Sort by date">Date</button>
        </div>
        <div id="versatile-todo-list"></div>
        <button id="versatile-add-task-btn">+ Add Task</button>
        <div id="versatile-add-task-form" style="display:none;">
          <input type="text" id="vtask-title" placeholder="Title" />
          <input type="text" id="vtask-course" placeholder="Course (optional)" />
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
  document.body.style.paddingRight = '350px';

  // FAB (floating button shown when sidebar is collapsed)
  const fab = document.createElement('button');
  fab.id = 'versatile-fab';
  fab.title = 'Open Versatile';
  fab.textContent = 'V';
  document.body.appendChild(fab);

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

  document.getElementById('Versatile').scrollTop = 0;
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

// 9. Bootstrap -------------

async function initVersatile() {
  try {
    initSidebar();
    console.debug('[Versatile] Sidebar skeleton built.');

    const [storageData, rawItems, courses, notifications] = await Promise.all([
      loadStorage(),
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
      courseNotes, dismissedNotifications, courseLinks
    } = storageData;
    const canvasTasks = rawItems ? filterCanvasItems(rawItems) : [];

    if (rawItems && rawItems.length > 0 && canvasTasks.length === 0) {
      console.warn(`[Versatile] Canvas returned ${rawItems.length} item(s) but 0 passed the week filter — all may be outside this week's range or already submitted.`);
    } else if (canvasTasks.length > 0) {
      console.debug(`[Versatile] ${canvasTasks.length} Canvas task(s) due this week.`);
    }

    const context = {
      canvasTasks,
      shadowTasks,
      taskPriorities,
      notifications,
      courseNotes,
      dismissedNotifications,
      courseLinks,
      courses
    };

    renderTopicsSection(courses, context);

    renderNotificationsSection(notifications);

    sortMode = savedSortMode;

    if (sidebarCollapsed) collapseSidebar();

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
      renderTodoSection(canvasTasks, latestStorage.shadowTasks, latestStorage.taskPriorities);
    });

    document.getElementById('vtask-submit').addEventListener('click', () => {
      handleAddTask(canvasTasks);
    });

    renderTodoSection(canvasTasks, shadowTasks, taskPriorities);

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

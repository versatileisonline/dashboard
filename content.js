// 1. Storage Helper Functions ---------

function loadStorage() {
  return new Promise(resolve => {
    // TODO add notes, links, etc. here
    chrome.storage.local.get(['shadowTasks', 'taskPriorities', 'sidebarCollapsed', 'sortMode'], result => {
      resolve({
        shadowTasks: result.shadowTasks || [],
        taskPriorities: result.taskPriorities || {},
        sidebarCollapsed: result.sidebarCollapsed || false,
        sortMode: result.sortMode || 'date'
      });
    });
  });
}

function saveStorage(shadowTasks, taskPriorities) {
  return new Promise(resolve => {
    chrome.storage.local.set({ shadowTasks, taskPriorities }, resolve);
  });
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

// 3. Data Nomization ----------

function normalizeCanvasItem(item) {
  return {
    id: String(item.plannable_id),
    title: item.plannable.title,
    courseName: item.context_name || '',
    dueAt: item.plannable_date,
    source: 'canvas',
    description: ''
  };
}

function filterCanvasItems(items) {
  const now = new Date();
  const endOfWeek = getEndOfWeek();
  const allowed = new Set(['assignment', 'quiz']);

  return items.filter(item => {
    if (!allowed.has(item.plannable_type)) return false;
    const due = new Date(item.plannable_date);
    if (due < now || due > endOfWeek) return false;
    if (item.submissions && item.submissions.submitted === true) return false;
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

function renderTopicsSection(courses) {
  const container = document.getElementById('versatile-topics-list');
  if (!container) return;
  container.innerHTML = '';

  if (courses.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No active courses found.</p>';
    return;
  }

  courses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'cp-topic-card';
    card.innerHTML = `<p class="cp-title">${sanitize(course.name)}</p>`;
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

// 6. Handlers -------

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

// 7. Sidebar Skeleton -------

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
      <div id="versatile-topics-list">
        </div>
    </div>

    <div class="cp-section">
      <div class="section-title">Notifications</div>
      <div id="versatile-notifications-list">
        </div>
    </div>
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

// 8. Bootstrap -------------

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

    const { shadowTasks, taskPriorities, sidebarCollapsed, sortMode: savedSortMode } = storageData;
    const canvasTasks = rawItems ? filterCanvasItems(rawItems) : [];

    if (rawItems && rawItems.length > 0 && canvasTasks.length === 0) {
      console.warn(`[Versatile] Canvas returned ${rawItems.length} item(s) but 0 passed the week filter — all may be outside this week's range or already submitted.`);
    } else if (canvasTasks.length > 0) {
      console.debug(`[Versatile] ${canvasTasks.length} Canvas task(s) due this week.`);
    }

    renderTopicsSection(courses);

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

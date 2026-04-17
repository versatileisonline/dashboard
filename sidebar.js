// sidebar.js — Sidebar DOM skeleton, collapse/expand, form handlers, and URL watcher

// Dependencies: sanitize (utils.js)
//               getCourseIdFromUrl (utils.js)
//               resetAddTaskForm, handleAddTask (taskHandlers.js)
//               openCourseDetail, closeCourseDetail, activeCourseId (courseDetail.js)

/**
 * Hides the sidebar and shows the floating action button.
 * Persists collapsed state to Chrome storage.
 */
function collapseSidebar() {
  document.getElementById('Versatile').style.display = 'none';
  document.getElementById('versatile-fab').style.display = 'flex';
  document.body.style.paddingRight = '';
  document.body.classList.add('versatile-hidden');
  chrome.storage.local.set({ sidebarCollapsed: true });
}

/**
 * Shows the sidebar and hides the floating action button.
 * Persists expanded state to Chrome storage.
 */
function expandSidebar() {
  document.getElementById('Versatile').style.display = 'flex';
  document.getElementById('versatile-fab').style.display = 'none';
  document.body.style.paddingRight = '350px';
  document.body.classList.remove('versatile-hidden');
  chrome.storage.local.set({ sidebarCollapsed: false });
}

/**
 * Builds the full sidebar DOM skeleton and appends it to the page body.
 * Also creates the floating action button and wires up collapse/expand and form toggle events.
 * @param {boolean} collapsed whether the sidebar should start collapsed.
 */
function initSidebar(collapsed = false) {
  const sidebar = document.createElement('div');
  sidebar.id = 'Versatile';

  sidebar.innerHTML = `
    <div id="versatile-header">
      <h2>Canvas+</h2>
      <div class="versatile-header-actions">
        <button id="theme-toggle-btn" title="Toggle light/dark mode" aria-label="Toggle light and dark mode">
          <span class="theme-toggle-track">
            <span class="theme-toggle-thumb"></span>
          </span>
        </button>
        <button id="versatile-collapse-btn" title="Hide sidebar">&#x2715;</button>
      </div>
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
        <div class="section-title">Courses</div>
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

/**
 * Renders the Topics (courses) section in the sidebar.
 * Each course card opens the course detail panel on click.
 * @param {Array} courses the list of Canvas course objects.
 * @param {object} context the shared app context object.
 */
function renderTopicsSection(courses, context) {
  const container = document.getElementById('versatile-topics-list');
  if (!container) return;
  container.innerHTML = '';

  if (courses.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No active courses found.</p>';
    return;
  }

  const hidden = context.hiddenTopics || [];
  const visibleCourses = courses.filter(c => !hidden.includes(String(c.id)));

  if (visibleCourses.length === 0) {
    container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No active courses found.</p>';
    return;
  }

  visibleCourses.forEach(course => {
    const card = document.createElement('div');
    card.className = 'cp-topic-card cp-topic-card--clickable';
    card.innerHTML = `
      <p class="cp-title">${sanitize(course.name)}</p>
      <p class="cp-task-date">Tap to view details &rsaquo;</p>
    `;
    card.addEventListener('click', () => openCourseDetail(course, context));

    const actionsRow = document.createElement('div');
    actionsRow.className = 'vtask-actions-row';
    const hideBtn = document.createElement('button');
    hideBtn.className = 'vtask-delete-btn';
    hideBtn.textContent = 'Hide';
    hideBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const updated = [...(context.hiddenTopics || []), String(course.id)];
      context.hiddenTopics = updated;
      await saveHiddenTopics(updated);
      card.remove();
      if (container.querySelectorAll('.cp-topic-card').length === 0) {
        container.innerHTML = '<p class="cp-task-date" style="padding:4px 0;">No active courses found.</p>';
      }
    });
    actionsRow.appendChild(hideBtn);
    card.appendChild(actionsRow);

    container.appendChild(card);
  });
}

/**
 * Initializes an autocomplete dropdown for the course name input in the Add Task form.
 * @param {Array} courses the list of Canvas course objects.
 */
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

/**
 * Watches for Canvas URL navigation changes and automatically opens/closes
 * the course detail panel based on the current URL's course ID.
 * Patches history.pushState and history.replaceState and listens to popstate.
 * @param {object} context the shared app context object.
 */
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

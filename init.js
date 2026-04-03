// init.js — Bootstrap entry point for the Versatile sidebar extension

// Dependencies:
//  storage.js
//  dateUtils.js
//  utils.js
//  canvasApi.js
//  notifications.js
//  tasks.js
//  taskHandlers.js
//  courseDetail.js
//  sidebar.js

/**
 * Initializes the Versatile sidebar. Loads storage, builds the sidebar skeleton,
 * fetches Canvas data, and renders all sections.
 * Exits early if the sidebar has already been injected.
 */
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
      courseNotes, dismissedNotifications, courseLinks, customDueDates, theme
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
      customDueDates,
      theme
    };

    renderTopicsSection(courses, context);
    initCourseDropdown(courses);

    renderNotificationsSection(notifications, context);

    // Light/Dark mode button toggle
    function applyTheme(theme) {
      const isDark = theme === 'dark';
      document.body.classList.toggle('dark-mode', isDark);

      const btn = document.getElementById('theme-toggle-btn');
      if (btn) {
        btn.setAttribute(
          'title',
          isDark ? 'Switch to light mode' : 'Switch to dark mode'
        );
        btn.setAttribute(
          'aria-label',
          isDark ? 'Switch to light mode' : 'Switch to dark mode'
        );
        btn.setAttribute('aria-pressed', String(isDark));
      }
    }

    applyTheme(theme);

    document.getElementById('theme-toggle-btn').addEventListener('click', async () => {
      const newTheme = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      applyTheme(newTheme);
      chrome.storage.local.set({ theme: newTheme });
    });

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

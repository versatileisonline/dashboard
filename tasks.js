// tasks.js — Task sorting, card building, and todo section rendering

// Dependencies: formatDueDate, toDatetimeLocalValue, getWeekBounds (dateUtils.js)
//               sanitize, isSafeCanvasUrl (utils.js)
//               saveStorage, saveCustomDueDates (storage.js)
//               normalizeCanvasItem, filterCanvasItems (canvasApi.js)

const PRIORITY_RANK = { xtrm: 0, med: 1, low: 2 };
let sortMode = 'date'; // 'date' | 'priority'
let weekOffset = 0;
let rawCanvasTasks = [];

/**
 * Sorts a list of tasks by the current sortMode (date or priority).
 * Within priority sort, ties are broken by due date.
 * @param {Array} tasks the tasks to sort.
 * @param {object} taskPriorities a map of task ID to priority string.
 * @returns a new sorted array of tasks.
 */
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

/**
 * Builds a task card DOM element with priority dots, delete/edit controls, and optional badges.
 * @param {object} task the normalized task object to render.
 * @param {object} taskPriorities a map of task ID to priority string.
 * @param {Array} canvasTasks the current filtered Canvas tasks list.
 * @param {Array} shadowTasks the current custom (shadow) tasks list.
 * @param {Function} refreshCallback optional callback to re-render after mutations.
 * @param {object} customDueDates a map of Canvas task ID to custom ISO due date strings.
 * @returns the constructed card HTMLElement.
 */
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
    anchor.className = "cp-title-name";
    anchor.href = task.url;
    anchor.textContent = task.title;
    titleEl.appendChild(anchor);
  } else {
    titleEl.textContent = task.title;
    if (task.source === 'shadow') {
      const badge = document.createElement('span');
      badge.className = 'vtask-badge';
      badge.textContent = 'custom';
      titleEl.appendChild(document.createTextNode('\u00A0\u00A0'));
      titleEl.appendChild(badge);
    }
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

/**
 * Renders the main To-Do section with all tasks due in the current week offset.
 * Merges Canvas tasks and shadow tasks, sorts them, and builds cards for each.
 * @param {Array} canvasTasks the filtered Canvas tasks for the current week.
 * @param {Array} shadowTasks the user's custom tasks.
 * @param {object} taskPriorities a map of task ID to priority string.
 * @param {object} customDueDates a map of Canvas task ID to custom ISO due date strings.
 */
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

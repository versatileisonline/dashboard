// courseDetail.js — Course detail panel sub-render functions

// Dependencies: sortTasks, buildTaskCard, renderTodoSection (tasks.js)
//               normalizeCanvasItem, filterCanvasItems (canvasApi.js)
//               getWeekBounds (dateUtils.js)
//               sanitize, isSafeCanvasUrl, notifHash, normalizeExternalUrl (utils.js)
//               notifTypeLabel, formatNotifDate (notifications.js)
//               saveCourseNotes, saveDismissedNotifications, saveCourseLinks (storage.js)
//               debounce (utils.js)
//               weekOffset, rawCanvasTasks (tasks.js)

let activeCourseId = null;

/**
 * Closes the course detail panel and returns to the main sidebar view.
 */
function closeCourseDetail() {
  activeCourseId = null;
  document.getElementById('versatile-course-detail').style.display = 'none';
  document.getElementById('versatile-main-view').style.display = 'block';
  document.getElementById('Versatile').scrollTop = 0;
}

/**
 * Opens the course detail panel for the given course and renders all sub-sections.
 * Scrolls to top if switching to a different course.
 * @param {object} course a Canvas course object.
 * @param {object} context the shared app context object.
 */
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

/**
 * Renders the tasks sub-section for a specific course in the detail panel.
 * @param {object} course a Canvas course object.
 * @param {object} context the shared app context object.
 * @param {HTMLElement} container the parent element to append the section to.
 */
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

/**
 * Renders the notes sub-section for a specific course in the detail panel.
 * Auto-saves note content to storage with debounce.
 * @param {object} course a Canvas course object.
 * @param {object} context the shared app context object.
 * @param {HTMLElement} container the parent element to append the section to.
 */
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

/**
 * Renders the announcements/notifications sub-section for a specific course in the detail panel.
 * @param {object} course a Canvas course object.
 * @param {object} context the shared app context object.
 * @param {HTMLElement} container the parent element to append the section to.
 */
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

/**
 * Renders the links sub-section for a specific course in the detail panel.
 * Includes an inline form for adding new links and a remove button per link.
 * @param {object} course a Canvas course object.
 * @param {object} context the shared app context object.
 * @param {HTMLElement} container the parent element to append the section to.
 */
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

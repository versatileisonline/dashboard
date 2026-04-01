// taskHandlers.js — Add task form submission and reset handlers

// Dependencies: normalizeExternalUrl (utils.js)
//               loadStorage, saveStorage (storage.js)
//               renderTodoSection (tasks.js)

/**
 * Handles the Add Task form submission.
 * Validates inputs, creates a new shadow task, saves it to storage, and re-renders the To-Do section.
 * @param {Array} canvasTasks the current filtered Canvas tasks for the week.
 */
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

/**
 * Resets the Add Task form to its default hidden state with all fields cleared.
 */
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

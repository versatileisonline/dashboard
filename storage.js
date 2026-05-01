// storage.js — Chrome LocalStorage helper functions

/**
 * An asynchronous function that loads relevant keys from Chrome's LocalStorage and copies to relevant variables.
 * @returns a Promise once completed whose resolve represents the data retrieved from storage.
 */
function loadStorage() {
  return new Promise(resolve => {
    chrome.storage.local.get(
      ['shadowTasks', 'taskPriorities', 'coursePriorities', 'courseSortMode', 'sidebarCollapsed', 'sortMode',
        'courseNotes', 'dismissedNotifications', 'courseLinks', 'customDueDates', 'theme', 'hiddenTopics'],
      result => {
        resolve({
          shadowTasks: result.shadowTasks || [],
          taskPriorities: result.taskPriorities || {},
          sidebarCollapsed: result.sidebarCollapsed || false,
          sortMode: result.sortMode || 'date',
          coursePriorities: result.coursePriorities || {},
          courseSortMode: result.courseSortMode || 'az',
          courseNotes: result.courseNotes || {},
          dismissedNotifications: result.dismissedNotifications || {},
          courseLinks: result.courseLinks || {},
          customDueDates: result.customDueDates || {},
          theme: result.theme || 'light',
          hiddenTopics: result.hiddenTopics || []
        });
      }
    );
  });
}

/**
 * An asynchronous function that saves shadowTasks and taskPriorities to Chrome's LocalStorage.
 * @param {*} shadowTasks
 * @param {*} taskPriorities
 * @returns a Promise that returns a resolve if a successful save has taken place and throws an error if it fails.
 */
function saveStorage(shadowTasks, taskPriorities, coursePriorities) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ shadowTasks, taskPriorities, coursePriorities }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Versatile] saveStorage failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * An asynchronous function that saves course notes to Chrome's LocalStorage.
 * @param {*} courseNotes
 * @returns a Promise that returns a resolve if a successful save has taken place and throws an error if it fails.
 */
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

/**
 * An asynchronous function that saves dismissed notifications to Chrome's LocalStorage.
 * @param {*} dismissedNotifications
 * @returns a Promise that returns a resolve if a successful save has taken place and throws an error if it fails.
 */
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

/**
 * An asynchronous function that saves custom due dates to Chrome's LocalStorage.
 * @param {*} customDueDates
 * @returns a Promise that returns a resolve if a successful save has taken place and throws an error if it fails.
 */
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

/**
 * An asynchronous function that saves hidden topic IDs to Chrome's LocalStorage.
 * @param {*} hiddenTopics
 * @returns a Promise that returns a resolve if a successful save has taken place and throws an error if it fails.
 */
function saveHiddenTopics(hiddenTopics) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ hiddenTopics }, () => {
      if (chrome.runtime.lastError) {
        console.error('[Versatile] saveHiddenTopics failed:', chrome.runtime.lastError.message);
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * An asynchronous function that saves course links to Chrome's LocalStorage.
 * @param {*} courseLinks
 * @returns a Promise that returns a resolve if a successful save has taken place and throws an error if it fails.
 */
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

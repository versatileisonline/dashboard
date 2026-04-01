// notifications.js — Notification hashing, labeling, and rendering

// Dependencies: sanitize, isSafeCanvasUrl, notifHash, notifTypeLabel, formatNotifDate (utils.js, dateUtils.js)
//               saveDismissedNotifications (storage.js)

/**
 * Generates a unique hash string for a notification, used to track dismissed state.
 * @param {object} notif a Canvas notification object.
 * @returns a string key identifying the notification.
 */
function notifHash(notif) {
  return notif.html_url || `${notif.type}::${notif.title}::${notif.course_id}`;
}

/**
 * Returns a human-readable label for a notification type.
 * @param {object} notif a Canvas notification object.
 * @returns a display label string.
 */
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

/**
 * Renders the global notifications section in the sidebar.
 * Filters out already-dismissed notifications and shows up to 10.
 * @param {Array} notifications the full list of Canvas notification objects.
 * @param {object} context the shared app context object.
 */
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

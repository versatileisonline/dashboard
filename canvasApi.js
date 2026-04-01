// canvasApi.js — Canvas API fetching and data normalization

// Dependencies: getWeekBounds (dateUtils.js)

/**
 * Normalizes a raw Canvas planner item into a consistent task object.
 * @param {object} item a raw Canvas API planner item.
 * @returns a normalized task object.
 */
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

/**
 * Filters Canvas planner items to only include assignments/quizzes due within a given week
 * that have not been submitted. Respects custom due dates.
 * @param {Array} items the raw Canvas planner items to filter.
 * @param {number} offset the week offset (0 = current week).
 * @param {object} customDueDates a map of task ID to custom ISO due date strings.
 * @returns a filtered array of Canvas planner items.
 */
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

/**
 * Fetches planner items from the Canvas API for a window of ±4 weeks around the current week.
 * Handles pagination via Link headers.
 * @returns an array of raw Canvas planner items, or null on failure.
 */
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

/**
 * Fetches the current user's favorite courses from the Canvas API.
 * Filters out courses with no name or with restricted access.
 * @returns an array of course objects, or an empty array on failure.
 */
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

/**
 * Fetches the current user's activity stream (notifications) from the Canvas API.
 * @returns an array of notification objects, or an empty array on failure.
 */
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

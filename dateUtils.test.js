// Test cases for dateUtils.

const {formatWeekLabel, getWeekBounds, formatDueDate, toDatetimeLocalValue, formatNotifDate} = require('./dateUtils');


/**
 * Tests getting the week. It should always start on midnight on Sunday and end at 11:59:59 PM on Saturday.
 */
test('Week Bounds', () => {

    const {start, end} = getWeekBounds()
    
    // Testing midnight Sunday
    expect(start.getDay()).toBe(0)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)

    // Testing 23:59:59 Saturday
    expect(end.getDay()).toBe(6)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
})

test('Format Week Label', () => {
    // This test depends on being ran before Apr 5, 2026.
    expect(formatWeekLabel()).toBe("Mar 29 – Apr 4");
});

/**
 * Tests translating ISO into the string format used for due dates and times.
 */
test('Due Date Formatting', () => {
    const isostring = "2026-04-02T18:19:38.000Z"
    const isostringAm = "2026-04-02T04:25:44.000Z"

    // This test depends on being ran in Eastern Daylight Time.
    expect(formatDueDate(isostring)).toBe("Due: Thu Apr 2 at 2:19 PM")
    expect(formatDueDate(isostringAm)).toBe("Due: Thu Apr 2 at 12:25 AM")
})

/**
 * Translates ISO time to local time.
 */
test('Date Time Local Value', () => {
    
    const isostring = "2026-04-02T18:19:38.000Z"
    
    // Invalid input should return an empty string.
    expect(toDatetimeLocalValue(null)).toBe('')
    expect(toDatetimeLocalValue("THIS IS A VERY BAD STRING")).toBe('')

    // This test depends on being ran in Eastern Daylight Time.
    expect(toDatetimeLocalValue(isostring)).toBe("2026-04-02T14:19")
})

/**
 * Tests translating ISO into the string format used for notifications.
 */
test('Notification Date Formatting', () => {
    const isostring = "2026-04-02T18:19:38.000Z"

    // Invalid input should return null.
    expect(formatNotifDate(null)).toBeNull()
    expect(formatNotifDate("THIS SHOULD NOT WORK")).toBeNull()

    // This test depends on being ran in Eastern Daylight Time.
    expect(formatNotifDate(isostring)).toBe("Apr 2, 2026")
})
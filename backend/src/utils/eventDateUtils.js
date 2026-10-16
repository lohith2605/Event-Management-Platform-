/**
 * Parses the event's start and end date/time respecting timezone specifications.
 * UTSAV default timezone is IST (UTC+05:30).
 */

const parseTimePart = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?(?:\s*([A-Z]{3}))?/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = (match[3] || '').toUpperCase();
  const tz = (match[4] || '').toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  // Offset in minutes: default IST (+05:30 = 330 minutes)
  const tzOffsetMinutes = tz === 'UTC' || tz === 'GMT' ? 0 : 330;

  return { hours, minutes, tzOffsetMinutes };
};

/**
 * Calculates the exact UTC end timestamp for an event.
 * @param {Object} event
 * @returns {Date|null}
 */
export const getEventEndDateTime = (event) => {
  if (!event) return null;

  // 1. Determine base end date
  let baseDate = null;
  if (event.endDate) {
    const parsed = new Date(event.endDate);
    if (!isNaN(parsed.getTime())) baseDate = parsed;
  } else if (event.isoDate) {
    const parsed = new Date(event.isoDate);
    if (!isNaN(parsed.getTime())) baseDate = parsed;
  } else if (event.startDate) {
    const parsed = new Date(event.startDate);
    if (!isNaN(parsed.getTime())) baseDate = parsed;
  }

  if (!baseDate) return null;

  // 2. Check if event.time specifies an end time range (e.g. '10:00 AM - 5:00 PM IST' or '10:00 AM to 6:30 PM')
  if (event.time && typeof event.time === 'string') {
    const rangeParts = event.time.split(/\s*(?:-|–|to)\s*/i);
    if (rangeParts.length >= 2) {
      const endTimeObj = parseTimePart(rangeParts[1]);
      if (endTimeObj) {
        const endUtc = new Date(baseDate);
        endUtc.setUTCHours(endTimeObj.hours, endTimeObj.minutes, 0, 0);
        endUtc.setTime(endUtc.getTime() - endTimeObj.tzOffsetMinutes * 60 * 1000);
        return endUtc;
      }
    }
  }

  // 3. If baseDate already has specific non-midnight hours/minutes in UTC, use it directly
  if (baseDate.getUTCHours() !== 0 || baseDate.getUTCMinutes() !== 0) {
    return baseDate;
  }

  // 4. If single start time is provided, assume event concludes 4 hours after start time or end of that day
  if (event.time && typeof event.time === 'string') {
    const startTimeObj = parseTimePart(event.time);
    if (startTimeObj) {
      const endUtc = new Date(baseDate);
      // Conclude 4 hours after start time
      endUtc.setUTCHours(startTimeObj.hours + 4, startTimeObj.minutes, 0, 0);
      endUtc.setTime(endUtc.getTime() - startTimeObj.tzOffsetMinutes * 60 * 1000);
      return endUtc;
    }
  }

  // 5. Fallback: Conclude at 23:59:59.999 IST on the event date (which is 18:29:59.999 UTC)
  const endOfDayUtc = new Date(baseDate);
  endOfDayUtc.setUTCHours(23, 59, 59, 999);
  endOfDayUtc.setTime(endOfDayUtc.getTime() - 330 * 60 * 1000);
  return endOfDayUtc;
};

/**
 * Returns true if the event has officially ended based on the current timestamp.
 * @param {Object} event
 * @param {Date} [referenceDate=new Date()]
 * @returns {boolean}
 */
export const hasEventEnded = (event, referenceDate = new Date()) => {
  const endDateTime = getEventEndDateTime(event);
  if (!endDateTime) return false;
  return referenceDate.getTime() >= endDateTime.getTime();
};

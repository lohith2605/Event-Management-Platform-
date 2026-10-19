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

export const getEventEndDateTime = (event) => {
  if (!event) return null;

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

  // If time range is provided (e.g. '10:00 AM - 5:00 PM IST')
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

  if (baseDate.getUTCHours() !== 0 || baseDate.getUTCMinutes() !== 0) {
    return baseDate;
  }

  // Single start time fallback: conclude 4 hours after start
  if (event.time && typeof event.time === 'string') {
    const startTimeObj = parseTimePart(event.time);
    if (startTimeObj) {
      const endUtc = new Date(baseDate);
      endUtc.setUTCHours(startTimeObj.hours + 4, startTimeObj.minutes, 0, 0);
      endUtc.setTime(endUtc.getTime() - startTimeObj.tzOffsetMinutes * 60 * 1000);
      return endUtc;
    }
  }

  // Fallback: 23:59:59.999 IST (18:29:59.999 UTC)
  const endOfDayUtc = new Date(baseDate);
  endOfDayUtc.setUTCHours(23, 59, 59, 999);
  endOfDayUtc.setTime(endOfDayUtc.getTime() - 330 * 60 * 1000);
  return endOfDayUtc;
};

export const hasEventEnded = (event, referenceDate = new Date()) => {
  const endDateTime = getEventEndDateTime(event);
  if (!endDateTime) return false;
  return referenceDate.getTime() >= endDateTime.getTime();
};

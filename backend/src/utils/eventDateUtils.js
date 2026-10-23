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

/**
 * Calculates the exact UTC start timestamp for an event.
 * Handles isoDate and time string parsing with timezone support (default IST = UTC+05:30).
 *
 * @param {Object} event - Event document or plain object with isoDate and optional time
 * @returns {Date|null} Exact UTC start Date, or null if invalid or ambiguous
 */
export const getEventStartDateTime = (event) => {
  if (!event || !event.isoDate) return null;
  const iso = new Date(event.isoDate);
  if (isNaN(iso.getTime())) return null;

  // If isoDate has hours, minutes, or seconds explicitly set (non-zero UTC), return directly
  if (iso.getUTCHours() !== 0 || iso.getUTCMinutes() !== 0 || iso.getUTCSeconds() !== 0) {
    return iso;
  }

  // If time string is present
  if (event.time && typeof event.time === 'string' && event.time.trim()) {
    const rawTime = event.time.trim();
    // Split range if present (e.g. '10:00 AM - 5:00 PM IST')
    const rangeParts = rawTime.split(/\s*(?:-|–|to)\s*/i);
    const startPart = rangeParts[0].trim();

    // Check timezone across full string or startPart
    const tzMatch = rawTime.match(/\b(IST|UTC|GMT)\b/i) || startPart.match(/\b(IST|UTC|GMT)\b/i);
    const tz = tzMatch ? tzMatch[1].toUpperCase() : '';
    const tzOffsetMinutes = tz === 'UTC' || tz === 'GMT' ? 0 : 330; // default IST (+05:30)

    const match = startPart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const meridiem = (match[3] || '').toUpperCase();

      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;

      const startUtc = new Date(iso);
      startUtc.setUTCHours(hours, minutes, 0, 0);
      startUtc.setTime(startUtc.getTime() - tzOffsetMinutes * 60 * 1000);
      return startUtc;
    }
  }

  // Ambiguous: isoDate has 00:00:00 UTC and time is missing or unparseable
  return null;
};

/**
 * Checks whether an event has reached or passed its start time.
 * @param {Object} event
 * @param {Date} [referenceDate=new Date()]
 * @returns {boolean} true if event has started or concluded
 */
export const isEventStarted = (event, referenceDate = new Date()) => {
  const startDateTime = getEventStartDateTime(event);
  if (!startDateTime || isNaN(startDateTime.getTime())) return true;
  return referenceDate.getTime() >= startDateTime.getTime();
};

/**
 * Validates whether an event is eligible to accept a new booking.
 * Requirements:
 * - Must exist.
 * - Must be published and not cancelled.
 * - Must have a valid, unambiguous start timestamp.
 * - Must have a start timestamp strictly later than the reference instant.
 * - Must have available inventory for the requested quantity.
 *
 * @param {Object} event - Event document or object
 * @param {number} [quantity=1] - Requested ticket quantity
 * @param {Object} [options]
 * @param {Date} [options.referenceDate=new Date()]
 * @returns {{ eligible: boolean, reason?: string, message?: string, status?: number, startDateTime?: Date, spotsLeft?: number }}
 */
export const checkBookingEligibility = (event, quantity = 1, options = {}) => {
  const referenceDate = options.referenceDate ? new Date(options.referenceDate) : new Date();

  if (!event) {
    return {
      eligible: false,
      reason: 'EVENT_NOT_FOUND',
      message: 'This event is unavailable or not found.',
      status: 404,
    };
  }

  if (event.status === 'cancelled') {
    return {
      eligible: false,
      reason: 'EVENT_CANCELLED',
      message: 'This event has been cancelled and is no longer accepting bookings.',
      status: 400,
    };
  }

  if (event.status !== 'published') {
    return {
      eligible: false,
      reason: 'EVENT_NOT_PUBLISHED',
      message: 'This event is either unpublished or not accepting bookings.',
      status: 400,
    };
  }

  const startDateTime = getEventStartDateTime(event);
  if (!startDateTime || isNaN(startDateTime.getTime())) {
    return {
      eligible: false,
      reason: 'INVALID_START_TIME',
      message: 'This event has an invalid or missing start date/time and cannot accept bookings.',
      status: 400,
    };
  }

  // Event must have a start timestamp strictly later than the current instant
  if (startDateTime.getTime() <= referenceDate.getTime()) {
    return {
      eligible: false,
      reason: 'EVENT_ALREADY_STARTED',
      message: 'This event has already started or concluded and is no longer accepting new bookings.',
      status: 400,
      startDateTime,
    };
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty < 1) {
    return {
      eligible: false,
      reason: 'INVALID_QUANTITY',
      message: 'Please choose at least 1 ticket.',
      status: 400,
    };
  }

  const spotsLeft = event.spotsLeft !== undefined ? Number(event.spotsLeft) : 0;
  if (spotsLeft < qty) {
    return {
      eligible: false,
      reason: 'INSUFFICIENT_CAPACITY',
      message: spotsLeft <= 0
        ? 'Sorry, this event is sold out.'
        : `Sorry, there are not enough tickets available. Remaining spots: ${spotsLeft}.`,
      status: 400,
      spotsLeft,
    };
  }

  return {
    eligible: true,
    startDateTime,
  };
};

/**
 * Returns UTC Date boundaries for IST calendar filters (today, weekend, week, month).
 * India Standard Time is UTC+05:30 (+330 minutes).
 *
 * @param {Date} [referenceDate=new Date()]
 * @returns {{
 *   startOfToday: Date,
 *   endOfToday: Date,
 *   startOfWeekend: Date,
 *   endOfWeekend: Date,
 *   startOfWeek: Date,
 *   endOfWeek: Date,
 *   startOfMonth: Date,
 *   endOfMonth: Date
 * }}
 */
export const getIstDateBounds = (referenceDate = new Date()) => {
  const istOffsetMs = 330 * 60 * 1000;
  const istNow = new Date(referenceDate.getTime() + istOffsetMs);

  const y = istNow.getUTCFullYear();
  const m = istNow.getUTCMonth();
  const d = istNow.getUTCDate();
  const dayOfWeek = istNow.getUTCDay(); // 0 is Sunday, 5 is Friday, 6 is Saturday

  const createIstInstant = (year, month, date, hours, minutes, seconds, ms) => {
    const utc = new Date(Date.UTC(year, month, date, hours, minutes, seconds, ms));
    return new Date(utc.getTime() - istOffsetMs);
  };

  const startOfToday = createIstInstant(y, m, d, 0, 0, 0, 0);
  const endOfToday = createIstInstant(y, m, d, 23, 59, 59, 999);

  // Weekend: Friday 00:00:00 IST to Sunday 23:59:59.999 IST
  const daysToFriday = (5 - dayOfWeek + 7) % 7;
  const fridayOffset = dayOfWeek === 6 ? -1 : dayOfWeek === 0 ? -2 : daysToFriday;
  const daysToSunday = (7 - dayOfWeek) % 7;
  const startOfWeekend = createIstInstant(y, m, d + fridayOffset, 0, 0, 0, 0);
  const endOfWeekend = createIstInstant(y, m, d + daysToSunday, 23, 59, 59, 999);

  // This week: start of today through Sunday 23:59:59.999 IST
  const startOfWeek = createIstInstant(y, m, d, 0, 0, 0, 0);
  const endOfWeek = createIstInstant(y, m, d + (7 - dayOfWeek) % 7, 23, 59, 59, 999);

  // This month: 1st of month 00:00:00 IST to last day of month 23:59:59.999 IST
  const startOfMonth = createIstInstant(y, m, 1, 0, 0, 0, 0);
  const endOfMonth = createIstInstant(y, m + 1, 0, 23, 59, 59, 999);

  return {
    startOfToday,
    endOfToday,
    startOfWeekend,
    endOfWeekend,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
  };
};

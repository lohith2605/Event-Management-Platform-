/**
 * Utility functions for chat participant identification, formatting, and receipts.
 */

/**
 * Safely extracts a string ID from an ObjectId string, populated user object, or null/undefined.
 *
 * @param {string|object|null|undefined} val
 * @returns {string|null}
 */
export const extractId = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val.trim();
  if (val._id) return (val._id._id || val._id).toString();
  if (val.id) return val.id.toString();
  return val.toString();
};

/**
 * Determines the target recipient / other participant's user ID for read receipts and participant tracking.
 *
 * Handles:
 * - attendee_organizer conversations:
 *     - If current user is attendee (by role or attendeeId match), returns organizerId.
 *     - If current user is organizer (by role or organizerId match), returns attendeeId.
 * - admin_organizer conversations:
 *     - If current user is admin (by role), returns organizerId.
 *     - If current user is organizer (by role or organizerId match), returns admin participant ID if present in participants array, or null.
 *
 * Handles both populated User objects and plain ObjectId strings.
 *
 * @param {object|null|undefined} conversation - Active conversation object
 * @param {object|null|undefined} currentUser - Authenticated user object from AuthContext
 * @returns {string|null} - The other participant's user ID as string, or null
 */
export const getOtherParticipantId = (conversation, currentUser) => {
  if (!conversation) return null;

  const currentUserId = extractId(currentUser?._id || currentUser?.id || currentUser);
  const currentUserRole = currentUser?.role;

  const organizerId = extractId(conversation.organizerId);
  const attendeeId = extractId(conversation.attendeeId);

  // 1. Admin-Organizer Support conversations
  if (conversation.type === 'admin_organizer') {
    // If current user is admin, the other party is the organizer
    if (currentUserRole === 'admin') {
      return organizerId;
    }

    // If current user is organizer (or matches organizerId), other party is the admin
    if (currentUserRole === 'organizer' || (currentUserId && currentUserId === organizerId)) {
      if (Array.isArray(conversation.participants) && conversation.participants.length > 0) {
        const adminParticipant = conversation.participants.find((p) => {
          const pId = extractId(p);
          return pId && pId !== organizerId;
        });
        if (adminParticipant) {
          return extractId(adminParticipant);
        }
      }
      return null;
    }

    // Generic fallback for admin_organizer: if current user is organizer, return null; else organizerId
    return currentUserId === organizerId ? null : organizerId;
  }

  // 2. Attendee-Organizer conversations
  // Check exact ID match first if current user ID is available
  if (currentUserId) {
    if (attendeeId && currentUserId === attendeeId) {
      return organizerId;
    }
    if (organizerId && currentUserId === organizerId) {
      return attendeeId;
    }
  }

  // Fall back to role check if ID comparison didn't resolve
  if (currentUserRole === 'attendee') {
    return organizerId;
  }
  if (currentUserRole === 'organizer') {
    return attendeeId;
  }

  // Fall back to participants array if present
  if (Array.isArray(conversation.participants) && conversation.participants.length > 0 && currentUserId) {
    const other = conversation.participants.find((p) => {
      const pId = extractId(p);
      return pId && pId !== currentUserId;
    });
    if (other) return extractId(other);
  }

  return organizerId || attendeeId || null;
};

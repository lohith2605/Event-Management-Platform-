import assert from 'node:assert/strict';
import { extractId, getOtherParticipantId } from './chatUtils.js';

console.log('Running chatUtils unit tests...');

// 1. Test extractId
assert.equal(extractId(null), null);
assert.equal(extractId(undefined), null);
assert.equal(extractId('65a1234567890abcdef12345'), '65a1234567890abcdef12345');
assert.equal(extractId({ _id: '65a1234567890abcdef12345' }), '65a1234567890abcdef12345');
assert.equal(extractId({ id: '65a1234567890abcdef12345' }), '65a1234567890abcdef12345');
assert.equal(extractId({ _id: { _id: '65a1234567890abcdef12345' } }), '65a1234567890abcdef12345');
console.log('✓ extractId tests passed');

// 2. Test attendee in attendee_organizer (with populated objects)
const convAttendeeOrganizerPopulated = {
  type: 'attendee_organizer',
  organizerId: { _id: 'org_100', name: 'Tech Events LLC' },
  attendeeId: { _id: 'att_200', name: 'John Doe' },
  participants: [{ _id: 'org_100' }, { _id: 'att_200' }],
};

const attendeeUser = { _id: 'att_200', role: 'attendee', name: 'John Doe' };
const organizerUser = { _id: 'org_100', role: 'organizer', name: 'Tech Events LLC' };

assert.equal(
  getOtherParticipantId(convAttendeeOrganizerPopulated, attendeeUser),
  'org_100',
  'Attendee in attendee_organizer should resolve organizer ID'
);

assert.equal(
  getOtherParticipantId(convAttendeeOrganizerPopulated, organizerUser),
  'att_200',
  'Organizer in attendee_organizer should resolve attendee ID'
);
console.log('✓ attendee_organizer (populated) tests passed');

// 3. Test attendee in attendee_organizer (with plain ID strings)
const convAttendeeOrganizerStrings = {
  type: 'attendee_organizer',
  organizerId: 'org_100',
  attendeeId: 'att_200',
  participants: ['org_100', 'att_200'],
};

assert.equal(
  getOtherParticipantId(convAttendeeOrganizerStrings, attendeeUser),
  'org_100',
  'Attendee in attendee_organizer (string IDs) should resolve organizer ID'
);

assert.equal(
  getOtherParticipantId(convAttendeeOrganizerStrings, organizerUser),
  'att_200',
  'Organizer in attendee_organizer (string IDs) should resolve attendee ID'
);
console.log('✓ attendee_organizer (string IDs) tests passed');

// 4. Test admin_organizer
const convAdminOrganizer = {
  type: 'admin_organizer',
  organizerId: { _id: 'org_100', name: 'Tech Events LLC' },
  attendeeId: null,
  participants: [{ _id: 'org_100' }, { _id: 'admin_999' }],
};

const adminUser = { _id: 'admin_999', role: 'admin', name: 'Super Admin' };

assert.equal(
  getOtherParticipantId(convAdminOrganizer, adminUser),
  'org_100',
  'Admin in admin_organizer should resolve organizer ID'
);

assert.equal(
  getOtherParticipantId(convAdminOrganizer, organizerUser),
  'admin_999',
  'Organizer in admin_organizer should resolve admin ID from participants'
);
console.log('✓ admin_organizer (with admin participant) tests passed');

// 5. Test admin_organizer without admin participant assigned yet
const convAdminOrganizerNoAdminYet = {
  type: 'admin_organizer',
  organizerId: 'org_100',
  attendeeId: null,
  participants: ['org_100'],
};

assert.equal(
  getOtherParticipantId(convAdminOrganizerNoAdminYet, adminUser),
  'org_100',
  'Admin in unassigned admin_organizer should resolve organizer ID'
);

assert.equal(
  getOtherParticipantId(convAdminOrganizerNoAdminYet, organizerUser),
  null,
  'Organizer in unassigned admin_organizer should return null'
);
console.log('✓ admin_organizer (unassigned) tests passed');

// 6. Test edge cases: null conversation or user
assert.equal(getOtherParticipantId(null, attendeeUser), null);
assert.equal(getOtherParticipantId(convAttendeeOrganizerPopulated, null), 'org_100'); // defaults to organizerId
console.log('✓ edge case tests passed');

console.log('ALL CHAT UTILS UNIT TESTS PASSED SUCCESSFULLY!');

import { meetingRoomInvitationTokenFromUrl } from '../src/utils/meetingRoomInvitation';

const token = 'A'.repeat(64);

describe('meeting-room invitation links', () => {
  it('extracts a valid invitation token', () => {
    expect(
      meetingRoomInvitationTokenFromUrl(
        `harborshield360://meeting-room-invitation/${token}`,
      ),
    ).toBe(token);
  });

  it('rejects malformed and unrelated links', () => {
    expect(meetingRoomInvitationTokenFromUrl('harborshield360://profile')).toBeNull();
    expect(
      meetingRoomInvitationTokenFromUrl(
        'harborshield360://meeting-room-invitation/short-token',
      ),
    ).toBeNull();
  });
});

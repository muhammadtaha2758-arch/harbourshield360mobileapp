const INVITATION_URL_PATTERN =
  /^harborshield360:\/\/meeting-room-invitation\/([A-Za-z0-9]{64})\/?$/i;

export function meetingRoomInvitationTokenFromUrl(url: string): string | null {
  return url.match(INVITATION_URL_PATTERN)?.[1] ?? null;
}

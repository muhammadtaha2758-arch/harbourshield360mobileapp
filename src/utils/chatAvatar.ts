/** Same placeholder as ChatScreen — ui-avatars from display name. */
export function placeholderAvatarUri(displayName: string): string {
  const name = displayName.trim() || 'User';
  const q = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${q}&size=128&background=3480E9&color=EAF6FF&bold=true`;
}

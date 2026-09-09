import { env } from '../config/env';

type AvatarFields = {
  avatar?: string | null;
  avatar_url?: string | null;
};

/**
 * Resolve users.avatar (filename or URL) to a loadable image URI.
 */
export function resolveUserAvatarUrl(user?: AvatarFields | null): string | null {
  const direct = typeof user?.avatar_url === 'string' ? user.avatar_url.trim() : '';
  if (direct && /^https?:\/\//i.test(direct)) {
    return direct;
  }

  const avatar = typeof user?.avatar === 'string' ? user.avatar.trim() : '';
  if (!avatar || avatar.toLowerCase() === 'no_avatar.png') {
    return null;
  }
  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }

  return `${env.apiOrigin}/images/avatar/${encodeURIComponent(avatar)}`;
}

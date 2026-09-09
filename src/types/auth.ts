export interface MobileApiUser {
  id: number;
  firstname?: string;
  lastname?: string;
  username?: string;
  email?: string;
  phone?: string;
  avatar?: string | null;
  avatar_url?: string | null;
  role_id?: number;
  statut?: number;
  user_type?: string;
  ClientID?: number | null;
  roofr_id?: number | null;
}

export interface UserProfile {
  id?: number | string;
  name?: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  username?: string;
  phone?: string;
  avatar?: string | null;
  avatar_url?: string | null;
  user_type?: string;
  ClientID?: number | null;
  [key: string]: unknown;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isInitializing: boolean;
}

export function mapMobileApiUserToProfile(user: MobileApiUser): UserProfile {
  const name =
    [user.firstname, user.lastname].filter(Boolean).join(' ').trim() ||
    user.username ||
    user.email ||
    'User';

  return {
    id: user.id,
    name,
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    username: user.username,
    phone: user.phone,
    avatar: user.avatar,
    avatar_url: user.avatar_url,
    user_type: user.user_type,
    ClientID: user.ClientID,
    role_id: user.role_id,
    statut: user.statut,
  };
}

export interface UserItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export async function listUsers(): Promise<UserItem[]> {
  const res = await fetch('/api/users', { credentials: 'include' });
  if (!res.ok) throw new Error(`listUsers failed: ${res.status}`);
  return res.json() as Promise<UserItem[]>;
}

export async function fetchCurrentUser(): Promise<UserItem> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) throw new Error(`fetchCurrentUser failed: ${res.status}`);
  return res.json() as Promise<UserItem>;
}

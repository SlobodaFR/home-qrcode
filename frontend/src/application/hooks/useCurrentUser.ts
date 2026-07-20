import { useEffect, useState } from 'react';
import { fetchCurrentUser, UserItem } from '../../infrastructure/api/users.client';

export function useCurrentUser(): UserItem | null {
  const [user, setUser] = useState<UserItem | null>(null);

  useEffect(() => {
    void fetchCurrentUser().then(setUser).catch(() => {});
  }, []);

  return user;
}

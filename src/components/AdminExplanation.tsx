import type { ReactNode } from 'react';
import { useApp } from '../context';

/** Keep general workflow guidance in the Admin workspace. */
export function AdminExplanation({ children }: { children: ReactNode }) {
  const { user } = useApp();
  return user.role === 'ADMIN' ? <>{children}</> : null;
}

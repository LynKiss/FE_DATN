import { useSyncExternalStore } from 'react';
import {
  getSuperAdminSession,
  isSuperAdminSessionActive,
  setSuperAdminSession,
  subscribeSuperAdminSession,
  type SuperAdminSession,
} from '../lib/super-admin-session';

function getActiveSession(): SuperAdminSession | null {
  return isSuperAdminSessionActive() ? getSuperAdminSession() : null;
}

export function useSuperAdminSession() {
  const session = useSyncExternalStore(
    subscribeSuperAdminSession,
    getActiveSession,
    getActiveSession,
  );

  return {
    session,
    setSession: (nextSession: SuperAdminSession | null) =>
      setSuperAdminSession(nextSession),
  };
}

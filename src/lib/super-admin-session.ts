export type SuperAdminSession = {
  accessToken: string;
  user: {
    _id: string;
    email: string;
    fullName?: string | null;
    isSuperAdmin: true;
    mfaEnabled?: boolean;
  };
};

const STORAGE_KEY = 'fe_super_admin_session';

let currentSession: SuperAdminSession | null = readSession();
const listeners = new Set<() => void>();

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() / 1000 >= payload.exp;
  } catch {
    return true;
  }
}

function isValidSession(value: unknown): value is SuperAdminSession {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.accessToken === 'string' &&
    s.accessToken.length > 0 &&
    typeof s.user === 'object' &&
    s.user !== null &&
    typeof (s.user as Record<string, unknown>).email === 'string'
  );
}

function readSession(): SuperAdminSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSession(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    // Clear if access token already expired (refresh will handle renewal on next API call)
    if (isTokenExpired(parsed.accessToken)) {
      // Don't remove — super-admin-api.ts will try to refresh on next 401
      // Just return the session so the refresh flow can run
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function emitChange() {
  for (const listener of listeners) listener();
}

export function getSuperAdminSession() {
  return currentSession;
}

export function setSuperAdminSession(session: SuperAdminSession | null) {
  currentSession = session;

  if (typeof window !== 'undefined') {
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  emitChange();
}

export function isSuperAdminSessionActive(): boolean {
  if (!currentSession) return false;
  return !isTokenExpired(currentSession.accessToken);
}

export function subscribeSuperAdminSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

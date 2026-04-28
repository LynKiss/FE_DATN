export type AdminSession = {
  accessToken: string;
  user: {
    _id: string;
    username: string;
    email: string;
    fullName?: string | null;
    phoneNumber?: string | null;
    avatarUrl?: string | null;
    role?: {
      _id: string;
      name: string;
    };
    permissions?: Array<{
      _id?: string;
      key?: string;
      name?: string;
    }>;
  };
};

const STORAGE_KEY = 'fe_admin_session';

let currentSession: AdminSession | null = readSession();
const listeners = new Set<() => void>();

function readSession(): AdminSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function getAdminSession() {
  return currentSession;
}

export function hasAdminPermission(permissionKey: string) {
  return (
    currentSession?.user.permissions?.some(
      (permission) => permission.key === permissionKey,
    ) ?? false
  );
}

export function setAdminSession(session: AdminSession | null) {
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

export function subscribeAdminSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

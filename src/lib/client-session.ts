export type ClientSession = {
  accessToken: string;
  user: {
    _id: string;
    username: string;
    email: string;
    fullName?: string;
    avatar?: string;
    avatarUrl?: string | null;
    phoneNumber?: string;
    role: string;
  };
};

const STORAGE_KEY = 'fe_client_session';

let currentSession: ClientSession | null = readSession();
const listeners = new Set<() => void>();

function readSession(): ClientSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClientSession;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function emitChange() {
  for (const listener of listeners) listener();
}

export function getClientSession() {
  return currentSession;
}

export function setClientSession(session: ClientSession | null) {
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

export function subscribeClientSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

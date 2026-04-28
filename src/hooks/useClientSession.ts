import { useSyncExternalStore } from 'react';
import { getClientSession, setClientSession, subscribeClientSession, type ClientSession } from '../lib/client-session';

export function useClientSession() {
  const session = useSyncExternalStore(
    subscribeClientSession,
    getClientSession,
    () => null,
  );
  return {
    session,
    setSession: (nextSession: ClientSession | null) => setClientSession(nextSession),
  };
}

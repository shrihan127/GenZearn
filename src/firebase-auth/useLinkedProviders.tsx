import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Auth } from 'firebase/auth';
import {
  getLinkedProviders,
  linkEmailPasswordProvider,
  linkGoogleProvider,
  unlinkProvider,
  SupportedProviderId,
} from './firebaseAuth';
import { Firestore } from 'firebase/firestore';
import { upsertUserDocument } from './firestoreUsers';

interface UseLinkedProvidersResult {
  user: User | null;
  loading: boolean;
  providerIds: string[];
  hasGoogle: boolean;
  hasPassword: boolean;
  linkGoogle: () => Promise<void>;
  linkPassword: (email: string, password: string) => Promise<void>;
  unlink: (providerId: SupportedProviderId) => Promise<void>;
}

export function useLinkedProviders(auth: Auth, db: Firestore): UseLinkedProvidersResult {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
  }, [auth]);

  const linked = useMemo(() => (user ? getLinkedProviders(user) : { providerIds: [], hasGoogle: false, hasPassword: false }), [user]);

  const sync = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
    await upsertUserDocument(db, auth.currentUser);
  }, [auth, db]);

  const linkGoogle = useCallback(async () => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await linkGoogleProvider(auth.currentUser);
    await sync();
  }, [auth, sync]);

  const linkPassword = useCallback(async (email: string, password: string) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await linkEmailPasswordProvider(auth.currentUser, email, password);
    await sync();
  }, [auth, sync]);

  const unlinkFn = useCallback(async (providerId: SupportedProviderId) => {
    if (!auth.currentUser) throw new Error('Not signed in');
    await unlinkProvider(auth.currentUser, providerId);
    await sync();
  }, [auth, sync]);

  return {
    user,
    loading,
    providerIds: linked.providerIds,
    hasGoogle: linked.hasGoogle,
    hasPassword: linked.hasPassword,
    linkGoogle,
    linkPassword,
    unlink: unlinkFn,
  };
}

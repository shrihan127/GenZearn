import { Auth, User } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  Firestore,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

export interface AppUserDoc {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  linkedProviders: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function upsertUserDocument(db: Firestore, user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const linkedProviders = user.providerData.map((p) => p.providerId);

  const payload = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    linkedProviders,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  };

  await setDoc(userRef, payload, { merge: true });
}

export async function getUserDocument(db: Firestore, uid: string): Promise<AppUserDoc | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as AppUserDoc;
}

export async function upsertCurrentUserDocument(db: Firestore, auth: Auth): Promise<void> {
  if (!auth.currentUser) throw new Error('No authenticated user');
  await upsertUserDocument(db, auth.currentUser);
}

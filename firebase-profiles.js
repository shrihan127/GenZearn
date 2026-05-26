import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from './firebase.js';

/**
 * Firestore Security Rules (example)
 *
 * match /databases/{database}/documents {
 *   match /users/{uid} {
 *     allow read: if request.auth != null;
 *     allow write: if request.auth != null && request.auth.uid == uid;
 *   }
 * }
 */

/**
 * Create or update the authenticated user's base account record in users/{uid}.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {{name: string, email: string, roles?: string[]}} account
 */
export async function saveUserAccount(db, account) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be authenticated to save account data.');
  }

  const userRef = doc(db, 'users', user.uid);
  const roles = ['student', 'tutor'];

  await setDoc(
    userRef,
    {
      name: account.name,
      email: account.email,
      roles,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    },
    { merge: true }
  );

  return user.uid;
}

/**
 * Fetch any user document by uid.
 *
 * @param {import('firebase/firestore').Firestore} db
 * @param {string} uid
 */
export async function getUserByUid(db, uid) {
  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    uid: snapshot.id,
    ...snapshot.data()
  };
}

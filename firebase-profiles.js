import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Firestore Security Rules (example)
 *
 * match /databases/{database}/documents {
 *   match /profiles/{uid} {
 *     allow read: if true; // public profiles are readable by anyone
 *     allow write: if request.auth != null && request.auth.uid == uid; // only owner can write
 *   }
 * }
 */

/**
 * Create or update the currently authenticated user's public profile.
 * Uses merge mode so existing fields are preserved unless overwritten.
 *
 * @param {import('firebase/firestore').Firestore} db - Initialized Firestore instance.
 * @param {{displayName: string, bio: string, photoURL: string}} profile
 */
export async function savePublicProfile(db, profile) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be authenticated to save a profile.');
  }

  const profileRef = doc(db, 'profiles', user.uid);

  await setDoc(
    profileRef,
    {
      displayName: profile.displayName,
      bio: profile.bio,
      photoURL: profile.photoURL,
      createdAt: serverTimestamp()
    },
    { merge: true }
  );

  return user.uid;
}

/**
 * Fetches a public profile by uid for any visitor.
 *
 * @param {import('firebase/firestore').Firestore} db - Initialized Firestore instance.
 * @param {string} uid
 * @returns {Promise<{uid: string, displayName: string, bio: string, photoURL: string, createdAt: unknown} | null>}
 */
export async function getPublicProfile(db, uid) {
  const profileRef = doc(db, 'profiles', uid);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    uid: snapshot.id,
    ...snapshot.data()
  };
}

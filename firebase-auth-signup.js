import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from './firebase.js';

export async function signUp(email, password, name) {
  const result = await createUserWithEmailAndPassword(auth, email, password);

  if (name && String(name).trim()) {
    await updateProfile(result.user, {
      displayName: String(name).trim(),
    });
  }

  return result;
}

if (typeof window !== 'undefined') {
  window.firebaseAuthSignUp = signUp;
}

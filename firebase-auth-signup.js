import { createUserWithEmailAndPassword, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
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

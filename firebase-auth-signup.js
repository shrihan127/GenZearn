import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase.js';

export async function signUp(email, password, name) {
  const methods = await fetchSignInMethodsForEmail(auth, email);
  if (methods.length > 0) {
    throw new Error('An account already exists for this email. Sign in with your existing provider and link additional providers from account settings.');
  }

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

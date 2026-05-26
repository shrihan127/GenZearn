import { auth } from './firebase.js';
import { signUpUnified } from './src/auth/resolveAuth.js';

export async function signUp(email, password, name) {
  return await signUpUnified(auth, email, password, name);
}

if (typeof window !== 'undefined') {
  window.firebaseAuthSignUp = signUp;
}

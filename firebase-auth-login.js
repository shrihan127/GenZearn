import { auth } from './firebase.js';
import { signInUnified } from './src/auth/resolveAuth.js';

export async function login(email, password) {
  return await signInUnified(auth, email, password);
}

if (typeof window !== 'undefined') {
  window.firebaseAuthLogin = login;
}

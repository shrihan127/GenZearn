import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase.js';

export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

if (typeof window !== 'undefined') {
  window.firebaseAuthLogin = login;
}

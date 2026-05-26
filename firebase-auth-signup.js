import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase.js';

export async function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

if (typeof window !== 'undefined') {
  window.firebaseAuthSignUp = signUp;
}

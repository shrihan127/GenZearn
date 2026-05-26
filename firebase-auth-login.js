import { signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { auth } from './firebase.js';

export async function login(email, password) {
  return await signInWithEmailAndPassword(auth, email, password);
}

if (typeof window !== 'undefined') {
  window.firebaseAuthLogin = login;
}

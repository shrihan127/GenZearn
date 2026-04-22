import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

if (!window.firebaseConfig) {
  console.warn('Firebase config is missing. Firebase Auth sign-up is unavailable.');
} else {
  if (!getApps().length) {
    initializeApp(window.firebaseConfig);
  }

  const auth = getAuth();

  async function signUp(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  }

  window.firebaseAuthSignUp = signUp;
}

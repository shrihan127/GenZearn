import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  updateProfile,
  signOut,
  linkWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  ref,
  get,
  set,
  push,
  onValue,
  off
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

import { auth, db } from "./firebase.js";

export const FirebaseAuth = {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  updateProfile,
  signOut,
  linkWithCredential,
  EmailAuthProvider
};

export const FirebaseDB = {
  db,
  ref,
  get,
  set,
  push,
  onValue,
  off
};

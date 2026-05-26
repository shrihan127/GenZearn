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
} from "firebase/auth";

import {
  ref,
  get,
  set,
  push,
  onValue,
  off
} from "firebase/database";

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

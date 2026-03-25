import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase web app configuration.
 *
 * Replace these placeholder values with your real Firebase project credentials
 * from: Firebase Console → Project settings → Your apps → SDK setup and configuration.
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

/**
 * Firestore database instance for app-wide usage.
 */
const db = getFirestore(app);

export { app, db };

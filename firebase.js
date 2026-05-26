import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

export const firebaseConfig = window.firebaseConfig;

export const app = initializeApp(firebaseConfig);

export const auth = getAuth();
export const db = getDatabase(app);

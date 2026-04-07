import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCna2awece-Xe7d_l0IeJ97cGXrnxZE0es",
  authDomain: "genzearn-a0313.firebaseapp.com",
  projectId: "genzearn-a0313",
  storageBucket: "genzearn-a0313.firebasestorage.app",
  messagingSenderId: "514449582943",
  appId: "1:514449582943:web:58dea5dcf7d88263db64ea",
  measurementId: "G-TD6NPH9PVE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, db, analytics, firebaseConfig };

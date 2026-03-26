import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase.js";

const tutorsQuery = query(collection(db, "tutors"), orderBy("createdAt", "desc"));

onSnapshot(
  tutorsQuery,
  (snapshot) => {
    const tutors = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    renderTutors(tutors);
  },
  (error) => {
    console.error("Failed to fetch tutors in real time:", error);
  }
);

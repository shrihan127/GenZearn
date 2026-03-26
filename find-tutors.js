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

function renderTutors(tutors) {
  const tutorsContainer = document.getElementById("tutorsContainer");

  if (!tutorsContainer) {
    console.error("Missing #tutorsContainer element.");
    return;
  }

  tutorsContainer.innerHTML = "";

  const fallbackImage = "logo.png";

  tutors.forEach((tutor) => {
    const card = document.createElement("article");
    card.className = "tutor-card";

    const subjects =
      Array.isArray(tutor.subjects) && tutor.subjects.length > 0
        ? tutor.subjects.join(", ")
        : "Not specified";

    const hourlyRate =
      tutor.hourlyRate !== undefined && tutor.hourlyRate !== null
        ? `$${tutor.hourlyRate}/hr`
        : "Rate not listed";

    card.innerHTML = `
      <img
        src="${tutor.profileImage || fallbackImage}"
        alt="${tutor.name || "Tutor"} profile image"
        class="tutor-card__image"
      />
      <h3 class="tutor-card__name">${tutor.name || "Unnamed Tutor"}</h3>
      <p class="tutor-card__subjects"><strong>Subjects:</strong> ${subjects}</p>
      <p class="tutor-card__bio">${tutor.bio || "No bio available."}</p>
      <p class="tutor-card__rate"><strong>Rate:</strong> ${hourlyRate}</p>
    `;

    tutorsContainer.appendChild(card);
  });
}

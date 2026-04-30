import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase.js";

const tutorsContainer = document.getElementById("tutorsContainer");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStatus(message) {
  if (!tutorsContainer) return;
  tutorsContainer.innerHTML = `<p class="status-message">${escapeHtml(message)}</p>`;
}

function renderError(message) {
  if (!tutorsContainer) return;
  tutorsContainer.innerHTML = `<p class="status-message error">${escapeHtml(message)}</p>`;
}

function renderTutorCards(tutors) {
  if (!tutorsContainer) return;

  if (!Array.isArray(tutors) || tutors.length === 0) {
    renderStatus("No tutors available yet");
    return;
  }

  tutorsContainer.innerHTML = tutors
    .map((tutor) => {
      const name = escapeHtml(tutor.name || "Tutor");
      const email = escapeHtml(tutor.email || "Email unavailable");

      return `
        <article class="tutor-card">
          <p class="tutor-availability">Tutor account active</p>
          <h3 class="tutor-name">${name}</h3>
          <p class="tutor-subjects">Contact: ${email}</p>
          <p class="tutor-bio">This tutor can be contacted for availability and subjects.</p>
          <p class="tutor-rate">Rate shared on request</p>
        </article>
      `;
    })
    .join("");
}

if (tutorsContainer) {
  renderStatus("Loading tutors...");

  const tutorsQuery = query(
    collection(db, "users"),
    where("roles", "array-contains", "tutor"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(
    tutorsQuery,
    (snapshot) => {
      const tutors = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }));

      renderTutorCards(tutors);
    },
    (error) => {
      console.error("Failed to fetch tutors in real time:", error);
      renderError("Could not load tutors right now. Please try again.");
    }
  );
}

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase.js';

/**
 * Updates the authenticated user's account record in users/{uid}
 * using the single-user model.
 */
export async function saveTutorProfile() {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be authenticated to update account roles.');
  }

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    name: user.displayName || '',
    email: user.email || '',
    roles: ['student', 'tutor'],
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });

  return user.uid;
}

export async function handleTutorFormSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Form submission target is invalid.');
  }

  const statusEl = document.getElementById('tutorApplicationStatus');

  try {
    await saveTutorProfile();

    if (statusEl) {
      statusEl.textContent = 'Account updated with tutor role successfully.';
      statusEl.className = 'status-message success';
    }

    form.reset();
  } catch (error) {
    console.error('Failed to submit tutor profile:', error);

    if (statusEl) {
      statusEl.textContent = error instanceof Error
        ? error.message
        : 'Failed to submit tutor profile. Please try again.';
      statusEl.className = 'status-message error';
    }
  }
}

const tutorForm = document.getElementById('tutorApplicationForm');
if (tutorForm) {
  tutorForm.addEventListener('submit', handleTutorFormSubmit);
}

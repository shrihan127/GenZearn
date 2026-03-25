import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';

/**
 * Creates a tutor profile document in Firestore.
 *
 * @param {{
 *  name: string,
 *  subjects: string,
 *  bio: string,
 *  hourlyRate: number,
 *  email: string,
 *  profileImageURL: string
 * }} tutorData
 * @returns {Promise<string>} Firestore document id.
 */
export async function createTutorProfile(tutorData) {
  const requiredFields = ['name', 'subjects', 'bio', 'hourlyRate', 'email', 'profileImageURL'];

  for (const field of requiredFields) {
    const value = tutorData[field];
    if (value === null || value === undefined || value === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  const hourlyRate = Number(tutorData.hourlyRate);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
    throw new Error('Hourly rate must be a valid positive number.');
  }

  const data = {
    name: String(tutorData.name).trim(),
    subjects: String(tutorData.subjects).trim(),
    bio: String(tutorData.bio).trim(),
    hourlyRate,
    email: String(tutorData.email).trim(),
    profileImageURL: String(tutorData.profileImageURL).trim(),
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'tutors'), data);
  return docRef.id;
}

/**
 * Handles tutor profile form submission.
 *
 * @param {SubmitEvent} event
 */
export async function handleTutorFormSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Form submission target is invalid.');
  }

  const formData = new FormData(form);
  const tutorData = {
    name: String(formData.get('name') || '').trim(),
    subjects: String(formData.get('subjects') || '').trim(),
    bio: String(formData.get('bio') || '').trim(),
    hourlyRate: Number(formData.get('hourlyRate')),
    email: String(formData.get('email') || '').trim(),
    profileImageURL: String(formData.get('profileImageURL') || '').trim()
  };

  const statusEl = document.getElementById('tutorApplicationStatus');

  try {
    const tutorId = await createTutorProfile(tutorData);

    if (statusEl) {
      statusEl.textContent = `Tutor profile saved successfully (ID: ${tutorId}).`;
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

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from './firebase.js';

/**
 * Creates or updates tutor data inside users/{uid}.tutorProfile
 * and ensures the tutor role exists.
 */
export async function saveTutorProfile(tutorData) {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    throw new Error('User must be authenticated to create a tutor profile.');
  }

  const requiredFields = ['subjects', 'qualifications', 'hourlyRate', 'availability'];

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

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    roles: ['student', 'tutor'],
    tutorProfile: {
      subjects: String(tutorData.subjects).trim(),
      qualifications: String(tutorData.qualifications).trim(),
      hourlyRate,
      availability: String(tutorData.availability).trim(),
      bio: String(tutorData.bio || '').trim()
    },
    updatedAt: serverTimestamp()
  }, { merge: true });

  return user.uid;
}

export async function handleTutorFormSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) {
    throw new Error('Form submission target is invalid.');
  }

  const formData = new FormData(form);
  const workDays = formData.getAll('workDays').map((day) => String(day));
  const tutorData = {
    subjects: String(formData.get('subjects') || '').trim(),
    qualifications: String(formData.get('qualifications') || '').trim(),
    bio: String(formData.get('experience') || '').trim(),
    hourlyRate: Number(formData.get('hourlyRate')),
    availability: workDays.length === 7 ? 'high' : 'low'
  };

  const statusEl = document.getElementById('tutorApplicationStatus');

  try {
    await saveTutorProfile(tutorData);

    if (statusEl) {
      statusEl.textContent = 'Tutor profile saved successfully.';
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

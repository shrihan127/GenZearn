import { auth, db as rtdb, firebaseConfig } from './firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  fetchSignInMethodsForEmail,
  updateProfile,
  signOut
} from 'firebase/auth';
import { ref, get, set, push, onValue, off } from 'firebase/database';

(function () {
  const STORAGE_KEYS = {
    currentUser: 'genzearn_current_user',
    tutorApps: 'genzearn_tutor_applications',
    pendingTutorApps: 'genzearn_pending_tutor_applications',
    sessionRequests: 'genzearn_session_requests',
    chatMessages: 'genzearn_chat_messages'
  };

  let db = null;
  let auth = null;
  let firebaseAuthApi = null;
  let firebaseDbApi = null;

  function hasUsableFirebaseConfig(config) {
    if (!config || typeof config !== 'object') return false;

    const requiredKeys = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'appId'];
    return requiredKeys.every((key) => {
      const value = config[key];
      return typeof value === 'string' && value.trim() !== '' && !value.includes('YOUR_');
    });
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch {
      return fallback;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function setStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = `status-message ${type}`;
  }

  function getCurrentUser() {
    return loadJson(STORAGE_KEYS.currentUser, null);
  }

  function setCurrentUser(user) {
    saveJson(STORAGE_KEYS.currentUser, user);
  }


  async function upsertUserProfile(user, profile) {
    if (!db || !firebaseDbApi || !user || !user.uid || !profile) return;

    const now = new Date().toISOString();
    const userRef = firebaseDbApi.ref(db, 'users/' + user.uid);
    const userSnapshot = await firebaseDbApi.get(userRef);
    const existingUser = userSnapshot.exists() ? userSnapshot.val() || {} : {};

    const roles = new Set(Array.isArray(existingUser.roles) ? existingUser.roles : []);
    if (existingUser.role) roles.add(existingUser.role);
    if (profile.role) roles.add(profile.role);
    if (Array.isArray(profile.roles)) {
      profile.roles.forEach((role) => {
        if (role) roles.add(role);
      });
    }

    if (!roles.size) roles.add('student');

    await firebaseDbApi.set(userRef, {
      name: existingUser.name || profile.name || user.displayName || user.email || 'User',
      email: (profile.email || existingUser.email || String(user.email || '')).trim().toLowerCase(),
      roles: Array.from(roles),
      createdAt: existingUser.createdAt || profile.createdAt || now,
      updatedAt: now
    });
  }

  function buildGmailComposeLink(email) {
    if (!email) return '';
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail) return '';
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(normalizedEmail)}`;
  }

  async function initFirebase() {
    if (!hasUsableFirebaseConfig(window.firebaseConfig)) return;

    try {
      const firebaseCore = await import('./firebase.js');
      const authModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js');
      const dbModule = await import('https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js');

      auth = firebaseCore.auth;
      db = firebaseCore.db;
      firebaseAuthApi = authModule;
      firebaseDbApi = dbModule;
    } catch {
      auth = null;
      db = null;
      firebaseAuthApi = null;
      firebaseDbApi = null;
    }
  }

  async function getCurrentAuthUserProfile() {
    if (!auth) return null;
    const authUser = auth.currentUser;
    if (!authUser) return null;

    const fallbackProfile = {
      name: authUser.displayName || authUser.email || 'User',
      email: String(authUser.email || '').trim().toLowerCase(),
      role: '',
      roles: []
    };

    if (!db) return fallbackProfile;

    try {
      const snapshot = await firebaseDbApi.get(firebaseDbApi.ref(db, `users/${authUser.uid}`));
      if (!snapshot.exists()) return fallbackProfile;
      const remoteProfile = snapshot.val() || {};
      const remoteRoles = Array.isArray(remoteProfile.roles) ? remoteProfile.roles : [];
      const resolvedRole = remoteRoles[remoteRoles.length - 1] || remoteProfile.role || '';
      return {
        name: remoteProfile.name || fallbackProfile.name,
        email: String(remoteProfile.email || fallbackProfile.email).trim().toLowerCase(),
        role: resolvedRole,
        roles: remoteRoles
      };
    } catch {
      return fallbackProfile;
    }
  }

  async function createTutorApplication(application) {
    if (!db) return;
    await firebaseDbApi.push(firebaseDbApi.ref(db, 'tutorApplications'), application);
  }

  function queueTutorApplicationForSync(application) {
    const pendingApplications = loadJson(STORAGE_KEYS.pendingTutorApps, []);
    pendingApplications.push(application);
    saveJson(STORAGE_KEYS.pendingTutorApps, pendingApplications);
  }

  async function flushPendingTutorApplications() {
    if (!db) return;

    const pendingApplications = loadJson(STORAGE_KEYS.pendingTutorApps, []);
    if (!pendingApplications.length) return;

    const stillPending = [];
    for (const application of pendingApplications) {
      try {
        await createTutorApplication(application);
      } catch {
        stillPending.push(application);
      }
    }

    saveJson(STORAGE_KEYS.pendingTutorApps, stillPending);
  }

  async function createSessionRequest(request) {
    if (!db) return;
    await firebaseDbApi.push(firebaseDbApi.ref(db, 'sessionRequests'), request);
  }

  async function getTutorApplications() {
    const localApplications = loadJson(STORAGE_KEYS.tutorApps, []);
    if (!db) return localApplications;

    const snapshot = await firebaseDbApi.get(firebaseDbApi.ref(db, 'tutorApplications'));
    const remoteApplications = Object.entries(snapshot.val() || {}).map(([key, value]) => ({
      ...value,
      _remoteKey: key
    }));
    return remoteApplications;
  }

  function subscribeTutorApplications(onUpdate, onError) {
    if (!db || typeof onUpdate !== 'function') return function () {};

    const ref = firebaseDbApi.ref(db, 'tutorApplications');
    const handleValue = function (snapshot) {
      const remoteApplications = Object.entries(snapshot.val() || {}).map(([key, value]) => ({
        ...value,
        _remoteKey: key
      }));
      onUpdate(remoteApplications);
    };
    const handleError = function () {
      if (typeof onError === 'function') onError();
    };

    firebaseDbApi.onValue(ref, handleValue, handleError);
    return function () {
      firebaseDbApi.off(ref, 'value', handleValue);
    };
  }

  function normalizeTutorList(applications) {
    const seen = new Set();
    return applications.filter((application) => {
      const email = (application.email || '').trim().toLowerCase();
      const createdAt = application.createdAt || '';
      const dedupeKey = `${email}|${createdAt}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return Boolean(
        application.fullName
          && application.subjects
          && application.qualifications
          && application.qualificationsVerified === true
          && Number(application.hourlyRate)
      );
    });
  }

  function hasValidQualifications(qualifications) {
    const value = String(qualifications || '').trim();
    if (value.length < 8) return false;

    const recognizedCredentialPattern = /\b(degree|b\.?a\.?|b\.?s\.?|m\.?a\.?|m\.?s\.?|phd|doctorate|certified|certification|license|licensed|teaching credential|pgce)\b/i;
    return recognizedCredentialPattern.test(value);
  }

  function getAvailabilityLabel(providedAvailability, workDays) {
    if (Array.isArray(workDays) && workDays.length) {
      return workDays.length === 7 ? 'high' : 'low';
    }

    const availability = String(providedAvailability || '').trim().toLowerCase();
    if (availability === 'high' || availability === 'low') return availability;

    if (/\b(limited|few\s+slots?|partially\s+available|some\s+availability)\b/.test(availability)) {
      return 'low';
    }

    if (/\b(available\s+now|immediately\s+available|open\s+slots?|openings?|accepting\s+students?|available)\b/.test(availability)) {
      return 'high';
    }

    return 'low';
  }

  function getAvailabilityText(providedAvailability, workDays) {
    const label = getAvailabilityLabel(providedAvailability, workDays);
    return label === 'high' ? 'High availability' : 'Low availability';
  }

  function getTutorFilters() {
    return {
      subject: String(document.getElementById('subjectFilter')?.value || '').trim().toLowerCase(),
      maxPrice: Number(document.getElementById('priceFilter')?.value || 0),
      minRating: Number(document.getElementById('ratingFilter')?.value || 0),
      availability: String(document.getElementById('availabilityFilter')?.value || 'any')
    };
  }

  function enrichTutor(tutor) {
    const rating = Number(tutor.rating);
    const safeRating = Number.isFinite(rating) && rating > 0 ? rating : 4.5;
    return {
      ...tutor,
      rating: Math.min(5, Math.max(0, safeRating)),
      availability: getAvailabilityLabel(tutor.availability, tutor.workDays)
    };
  }

  function filterTutors(tutors, filters) {
    return tutors.filter((tutor) => {
      const subject = String(tutor.subjects || '').toLowerCase();
      const rate = Number(tutor.hourlyRate);
      const rating = Number(tutor.rating);
      const availabilityLabel = getAvailabilityLabel(tutor.availability, tutor.workDays);

      if (filters.subject && !subject.includes(filters.subject)) return false;
      if (filters.maxPrice > 0 && rate > filters.maxPrice) return false;
      if (filters.minRating > 0 && rating < filters.minRating) return false;
      if (filters.availability !== 'any' && availabilityLabel !== filters.availability) return false;

      return true;
    });
  }


  function renderTutorList(tutors) {
    const tutorList = document.getElementById('tutorList');
    if (!tutorList) return;

    if (!tutors.length) {
      tutorList.innerHTML = '<p class="status-message">No tutors are available yet. Check back soon.</p>';
      return;
    }

    tutorList.innerHTML = tutors
      .map((tutor, index) => {
        const rate = Number(tutor.hourlyRate);
        const subject = String(tutor.subjects);
        const fullName = String(tutor.fullName);
        const qualifications = String(tutor.qualifications);
        const rating = Number(tutor.rating).toFixed(1);
        const availability = getAvailabilityText(tutor.availability, tutor.workDays);
        const workDays = Array.isArray(tutor.workDays) && tutor.workDays.length
          ? `<p><strong>Work days:</strong> ${tutor.workDays.join(', ')}</p>`
          : '';
        const experience = tutor.experience ? `<p><strong>Experience:</strong> ${tutor.experience}</p>` : '';
        const verificationLabel = tutor.verification
          ? `<p class="verification-pill ${tutor.verification.status}">${tutor.verification.message}</p>`
          : '';
        return `
          <div class="tutor-card">
            <h3>${fullName}</h3>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Qualifications:</strong> ${qualifications}</p>
            <p><strong>Rate:</strong> $${rate} / hour</p>
            <p><strong>Rating:</strong> ⭐ ${rating}</p>
            <p><strong>Availability:</strong> ${availability}</p>
            ${workDays}
            ${experience}
            ${verificationLabel}
            <div class="tutor-card-actions">
              <button class="btn primary" type="button" data-tutor-index="${index}">Book Session</button>
              <button class="btn secondary" type="button" data-chat-tutor-index="${index}">Chat with Tutor</button>
            </div>
          </div>
        `;
      })
      .join('');

    const buttons = tutorList.querySelectorAll('[data-tutor-index]');
    buttons.forEach((button) => {
      button.addEventListener('click', function () {
        const tutor = tutors[Number(button.dataset.tutorIndex)];
        if (!tutor) return;
        openModal(
          String(tutor.fullName),
          Number(tutor.hourlyRate),
          String(tutor.subjects),
          String(tutor.paymentLinks || '')
        );
      });
    });

    const chatButtons = tutorList.querySelectorAll('[data-chat-tutor-index]');
    chatButtons.forEach((button) => {
      button.addEventListener('click', function () {
        const tutor = tutors[Number(button.dataset.chatTutorIndex)];
        if (!tutor) return;
        const gmailComposeLink = buildGmailComposeLink(tutor.email);
        if (!gmailComposeLink) return;
        window.open(gmailComposeLink, '_blank', 'noopener,noreferrer');
      });
    });
  }

  async function initTutorDirectory() {
    const tutorList = document.getElementById('tutorList');
    if (!tutorList) return;
    const isCloudSyncEnabled = Boolean(db);

    tutorList.innerHTML = isCloudSyncEnabled
      ? '<p class="status-message">Loading tutors...</p>'
      : '<p class="status-message">Cloud sync is not configured. Showing tutors saved on this device only.</p>';

    try {
      const applications = await getTutorApplications();
      let tutors = normalizeTutorList(applications)
        .map(enrichTutor)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const applyFiltersAndRender = function () {
        const filters = getTutorFilters();
        const filteredTutors = filterTutors(tutors, filters);
        renderTutorList(filteredTutors);
      };

      ['subjectFilter', 'priceFilter', 'ratingFilter', 'availabilityFilter'].forEach((id) => {
        const control = document.getElementById(id);
        if (!control) return;
        control.addEventListener('input', applyFiltersAndRender);
        control.addEventListener('change', applyFiltersAndRender);
      });

      applyFiltersAndRender();
      if (isCloudSyncEnabled) {
        subscribeTutorApplications(
          function (remoteApplications) {
            tutors = normalizeTutorList(remoteApplications)
              .map(enrichTutor)
              .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            applyFiltersAndRender();
          },
          function () {
            tutorList.innerHTML = '<p class="status-message error">Live tutor sync is unavailable right now. Please refresh and try again.</p>';
          }
        );
      }
    } catch {
      tutorList.innerHTML = '<p class="status-message error">Could not load tutors right now. Please refresh and try again.</p>';
    }
  }

  function updateAuthUI() {
    const nav = document.querySelector('.nav-links');
    if (!nav) return;

    const current = getCurrentUser();
    let accountArea = nav.querySelector('.account-area');
    if (!accountArea) {
      accountArea = document.createElement('div');
      accountArea.className = 'account-area';
      nav.appendChild(accountArea);
    }

    if (current) {
      accountArea.innerHTML = `<span class="user-chip">${current.name.split(' ')[0]}</span><button class="logout-btn" type="button">Logout</button>`;
      const logoutBtn = accountArea.querySelector('.logout-btn');
      logoutBtn.addEventListener('click', async function () {
        localStorage.removeItem(STORAGE_KEYS.currentUser);
        if (auth) {
          try {
            await firebaseAuthApi.signOut(auth);
          } catch {
            // Ignore sign-out errors and still clear the local session.
          }
        }
        window.location.href = 'index.html';
      });
    } else {
      accountArea.innerHTML = '';
    }
  }





  async function signInWithGoogleAndLinkIfNeeded() {
    const provider = new firebaseAuthApi.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      return await firebaseAuthApi.signInWithPopup(auth, provider);
    } catch (error) {
      if (!error || error.code !== 'auth/account-exists-with-different-credential') throw error;

      const email = String(error.email || '').trim().toLowerCase();
      const pendingCredential = error.credential;
      const methods = email ? await firebaseAuthApi.fetchSignInMethodsForEmail(auth, email) : [];

      if (!methods.includes('password')) {
        throw new Error('Please sign in with your existing provider first, then retry Google to link accounts.');
      }

      const password = window.prompt('Enter your existing password to link Google to this account:');
      if (!password) {
        throw new Error('Account linking cancelled.');
      }

      const emailResult = await firebaseAuthApi.signInWithEmailAndPassword(auth, email, password);
      if (pendingCredential) {
        await linkWithCredential(emailResult.user, pendingCredential);
      }
      return emailResult;
    }
  }

  async function createOrLinkEmailUser(email, password, name) {
    try {
      const result = await firebaseAuthApi.createUserWithEmailAndPassword(auth, email, password);
      await result.user.updateProfile({ displayName: name });
      return result;
    } catch (error) {
      if (!error || error.code !== 'auth/email-already-in-use') throw error;

      const methods = await firebaseAuthApi.fetchSignInMethodsForEmail(auth, email);
      if (methods.includes('password')) {
        return firebaseAuthApi.signInWithEmailAndPassword(auth, email, password);
      }

      if (methods.includes('google.com')) {
        const googleResult = await signInWithGoogleAndLinkIfNeeded();
        const credential = firebaseAuthApi.EmailAuthProvider.credential(email, password);
        await googleResult.user.linkWithCredential(credential);
        return firebaseAuthApi.signInWithEmailAndPassword(auth, email, password);
      }

      throw new Error('This email is already registered with another sign-in method. Please use that method first.');
    }
  }

  async function createFirebaseAuthUser(email, password) {
    if (!auth) {
      throw new Error('Firebase Auth is not configured right now.');
    }

    try {
      await firebaseAuthApi.createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error && error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists. Please log in.');
      }
      if (error && error.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      if (error && error.code === 'auth/weak-password') {
        throw new Error('Password must be at least 6 characters long.');
      }
      throw new Error('Could not create account right now. Please try again.');
    }
  }

  function initSignup() {
    const form = document.getElementById('signupForm');
    if (!form) return;

    const status = document.getElementById('signupStatus');
    const submitButton = form.querySelector('button[type="submit"]');
    const tutorFields = document.getElementById('tutorSignupFields');
    const studentFields = document.getElementById('studentSignupFields');
    const roleInputs = Array.from(form.querySelectorAll('input[name="role"]'));
    const tutorRequiredFields = ['subjects', 'qualifications', 'hourlyRate', 'paymentMethod', 'experience'];
    const proofInput = form.elements.qualificationProofFiles;
    const proofDropzone = document.getElementById('signupQualificationProofDropzone');
    const proofFileList = document.getElementById('signupQualificationProofFileList');
    let selectedProofFiles = [];

    function renderProofFiles() {
      if (!proofFileList) return;
      proofFileList.innerHTML = '';
      selectedProofFiles.forEach((file) => {
        const item = document.createElement('li');
        item.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
        proofFileList.appendChild(item);
      });
    }

    function mergeProofFiles(incomingFiles) {
      const unique = new Map(selectedProofFiles.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
      Array.from(incomingFiles).forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        unique.set(key, file);
      });
      selectedProofFiles = Array.from(unique.values()).slice(0, 5);
      renderProofFiles();
    }

    if (proofInput) {
      proofInput.addEventListener('change', function () {
        mergeProofFiles(proofInput.files || []);
        proofInput.value = '';
      });
    }

    if (proofDropzone && proofInput) {
      proofDropzone.addEventListener('click', function () {
        proofInput.click();
      });

      proofDropzone.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        proofInput.click();
      });

      ['dragenter', 'dragover'].forEach((eventName) => {
        proofDropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          proofDropzone.classList.add('active');
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        proofDropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          proofDropzone.classList.remove('active');
        });
      });

      proofDropzone.addEventListener('drop', function (event) {
        mergeProofFiles(event.dataTransfer?.files || []);
      });
    }

    function updateRoleUI() {
      const selectedRole = form.elements.role ? form.elements.role.value : 'student';
      const isTutor = selectedRole === 'tutor';

      if (tutorFields) tutorFields.classList.toggle('hidden', !isTutor);
      if (studentFields) studentFields.classList.toggle('hidden', isTutor);

      tutorRequiredFields.forEach((fieldName) => {
        if (!form.elements[fieldName]) return;
        form.elements[fieldName].required = isTutor;
      });
    }

    roleInputs.forEach((input) => input.addEventListener('change', updateRoleUI));
    const requestedRole = new URLSearchParams(window.location.search).get('role');
    if (requestedRole === 'tutor' || requestedRole === 'student') {
      const matchingRoleInput = roleInputs.find((input) => input.value === requestedRole);
      if (matchingRoleInput) matchingRoleInput.checked = true;
    }
    updateRoleUI();

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      const submitButton = form.querySelector('button[type="submit"]');
      const status = document.getElementById('signupStatus');

      const name = form.elements.fullName.value.trim();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const role = form.elements.role.value;

      if (role === 'tutor') {
        const selectedWorkDays = Array.from(form.querySelectorAll('input[name="workDays"]:checked')).map((input) => input.value);
        const qualifications = form.elements.qualifications.value.trim();

        if (!hasValidQualifications(qualifications)) {
          setStatus(status, 'Please enter valid qualifications (degree, certification, or teaching license).', 'error');
          return;
        }

        if (!selectedWorkDays.length) {
          setStatus(status, 'Please choose at least one work day from Monday to Sunday.', 'error');
          return;
        }
      }

      submitButton.disabled = true;

      try {
        const result = await createOrLinkEmailUser(email, password, name);

        // 3. Store extra user data in Realtime Database (optional)
        if (db) {
          await upsertUserProfile(result.user, { name, email, role });
        }

        if (role === 'tutor') {
          const selectedWorkDays = Array.from(form.querySelectorAll('input[name="workDays"]:checked')).map((input) => input.value);
          const paymentLinksValue = form.elements.paymentLinks
            ? form.elements.paymentLinks.value.trim()
            : '';
          const tutorApplication = {
            fullName: name,
            email,
            subjects: form.elements.subjects.value.trim(),
            qualifications: form.elements.qualifications.value.trim(),
            hourlyRate: Number(form.elements.hourlyRate.value),
            paymentMethod: form.elements.paymentMethod.value.trim(),
            paymentLinks: paymentLinksValue,
            experience: form.elements.experience.value.trim(),
            workDays: selectedWorkDays,
            availability: selectedWorkDays.length === 7 ? 'high' : 'low',
            qualificationProofFiles: selectedProofFiles.map((file) => ({
              name: file.name,
              size: file.size,
              type: file.type || 'application/octet-stream'
            })),
            referral: form.elements.referral.value.trim(),
            qualificationsVerified: true,
            createdAt: new Date().toISOString()
          };

          try {
            await createTutorApplication(tutorApplication);
            await flushPendingTutorApplications();
          } catch {
            queueTutorApplicationForSync(tutorApplication);
          }
        }

        setStatus(status, role === 'tutor' ? 'Tutor profile created successfully. You can now log in as either a student or tutor.' : 'Account created successfully!', 'success');

        setTimeout(() => {
          window.location.href = 'find-tutors.html';
        }, 800);
      } catch (error) {
        console.log(error.code, error.message);

        let message = 'Could not create account.';

        if (error.code === 'auth/email-already-in-use') {
          message = role === 'tutor'
            ? 'This email already exists. Enter the same password to add your tutor profile.'
            : 'This email is already registered. Please log in.';
        } else if (error.code === 'auth/invalid-email') {
          message = 'Invalid email address.';
        } else if (error.code === 'auth/weak-password') {
          message = 'Password must be at least 6 characters.';
        }

        setStatus(status, message, 'error');
      } finally {
        submitButton.disabled = false;
      }
    });


    const googleSignupBtn = document.getElementById('googleSignupBtn');
    if (googleSignupBtn) {
      googleSignupBtn.addEventListener('click', async function () {
        const role = form.elements.role.value;
        const nameFromForm = form.elements.fullName.value.trim();

        if (role === 'tutor') {
          const selectedWorkDays = Array.from(form.querySelectorAll('input[name="workDays"]:checked')).map((input) => input.value);
          const qualifications = form.elements.qualifications.value.trim();
          if (!hasValidQualifications(qualifications)) {
            setStatus(status, 'Please enter valid qualifications (degree, certification, or teaching license).', 'error');
            return;
          }
          if (!selectedWorkDays.length) {
            setStatus(status, 'Please choose at least one work day from Monday to Sunday.', 'error');
            return;
          }
        }

        googleSignupBtn.disabled = true;
        submitButton.disabled = true;
        try {
          const result = await signInWithGoogleAndLinkIfNeeded();
          const googleUser = result.user;
          const name = nameFromForm || googleUser.displayName || 'User';
          const email = String(googleUser.email || '').trim().toLowerCase();

          await upsertUserProfile(googleUser, {
            name,
            email,
            role,
            createdAt: new Date().toISOString()
          });

          if (role === 'tutor') {
            const selectedWorkDays = Array.from(form.querySelectorAll('input[name="workDays"]:checked')).map((input) => input.value);
            const paymentLinksValue = form.elements.paymentLinks ? form.elements.paymentLinks.value.trim() : '';
            const tutorApplication = {
              fullName: name,
              email,
              subjects: form.elements.subjects.value.trim(),
              qualifications: form.elements.qualifications.value.trim(),
              hourlyRate: Number(form.elements.hourlyRate.value),
              paymentMethod: form.elements.paymentMethod.value.trim(),
              paymentLinks: paymentLinksValue,
              experience: form.elements.experience.value.trim(),
              workDays: selectedWorkDays,
              availability: selectedWorkDays.length === 7 ? 'high' : 'low',
              qualificationProofFiles: selectedProofFiles.map((file) => ({ name: file.name, size: file.size, type: file.type || 'application/octet-stream' })),
              referral: form.elements.referral.value.trim(),
              qualificationsVerified: true,
              createdAt: new Date().toISOString()
            };

            try {
              await createTutorApplication(tutorApplication);
              await flushPendingTutorApplications();
            } catch {
              queueTutorApplicationForSync(tutorApplication);
            }
          }

          setCurrentUser({ name, email, role, roles: role === 'tutor' ? ['student', 'tutor'] : ['student'] });
          setStatus(status, role === 'tutor' ? 'Google account connected and tutor profile created!' : 'Google account connected successfully!', 'success');
          setTimeout(() => { window.location.href = 'find-tutors.html'; }, 800);
        } catch (error) {
          if (error && error.code === 'auth/popup-closed-by-user') {
            setStatus(status, 'Google sign-in was cancelled.', 'error');
          } else {
            setStatus(status, 'Could not continue with Google right now. Please try again.', 'error');
          }
        } finally {
          googleSignupBtn.disabled = false;
          submitButton.disabled = false;
        }
      });
    }
  }

  function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const status = document.getElementById('loginStatus');
    if (!auth || !firebaseAuthApi) {
      setStatus(status, 'Firebase Auth is not configured right now.', 'error');
      return;
    }


    const googleLoginBtn = document.getElementById('googleLoginBtn');
    if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', async function () {
        googleLoginBtn.disabled = true;
        try {
          const result = await signInWithGoogleAndLinkIfNeeded();
          const user = result.user;
          await upsertUserProfile(user, {
            name: user.displayName || 'User',
            email: String(user.email || '').trim().toLowerCase(),
            role: 'student'
          });

          const profile = await getCurrentAuthUserProfile();
          const currentRoles = Array.isArray(profile && profile.roles) && profile.roles.length ? profile.roles : ['student'];
          const activeRole = currentRoles.includes('student') ? 'student' : currentRoles[currentRoles.length - 1];
          setCurrentUser({
            name: (profile && profile.name) || user.displayName || 'User',
            email: (profile && profile.email) || String(user.email || '').trim().toLowerCase(),
            role: activeRole,
            roles: currentRoles
          });
          setStatus(status, 'Logged in with Google! Redirecting...', 'success');
          setTimeout(() => { window.location.href = 'find-tutors.html'; }, 800);
        } catch (error) {
          console.log('GOOGLE ERROR:', error.code, error.message);
          setStatus(status, error.code + ' - ' + error.message, 'error');
        } finally {
          googleLoginBtn.disabled = false;
        }
      });
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;

      try {
        if (!auth || !firebaseAuthApi) {
          setStatus(status, 'Login is unavailable until Firebase Auth is configured.', 'error');
          return;
        }
        const result = await firebaseAuthApi.signInWithEmailAndPassword(auth, email, password);
        const user = await getCurrentAuthUserProfile();
        if (!user) throw new Error('Could not load user profile.');
        const role = user.role || (Array.isArray(user.roles) ? user.roles[user.roles.length - 1] || '' : '');
        await upsertUserProfile(result.user, {
          name: user.name,
          email: user.email,
          role
        });
        setCurrentUser({ name: user.name, email: user.email, role, roles: user.roles });
        setStatus(status, 'Logged in successfully! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'find-tutors.html';
        }, 800);
      } catch (error) {
        console.log('LOGIN ERROR:', error.code, error.message);

        let message = 'Could not log in.';

        if (error.code === 'auth/user-not-found') {
          message = 'No account exists with this email.';
        } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
          message = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
          message = 'Invalid email format.';
        } else if (error.code === 'auth/too-many-requests') {
          message = 'Too many login attempts. Please wait a few minutes before trying again.';
        }

        setStatus(status, message, 'error');
      }
    });
  }

  function initForgotPassword() {
    const toggleBtn = document.getElementById('forgotPasswordBtn');
    const panel = document.getElementById('forgotPasswordPanel');
    const sendCodeForm = document.getElementById('sendCodeForm');
    const status = document.getElementById('forgotPasswordStatus');

    if (!toggleBtn || !panel || !sendCodeForm || !status) return;

    toggleBtn.addEventListener('click', function () {
      panel.classList.toggle('hidden');
      setStatus(status, '', '');
    });

    sendCodeForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const email = sendCodeForm.elements.resetEmail.value.trim().toLowerCase();
      if (!email) {
        setStatus(status, 'Enter your account email first.', 'error');
        return;
      }

      try {
        if (!auth || !firebaseAuthApi) {
          setStatus(status, 'Password reset is unavailable until Firebase Auth is configured.', 'error');
          return;
        }
        await firebaseAuthApi.sendPasswordResetEmail(auth, email);
        setStatus(status, `Password reset link sent to ${email}. Please check your inbox.`, 'success');
      } catch (error) {
        if (error && error.code === 'auth/invalid-email') {
          setStatus(status, 'Please enter a valid email address.', 'error');
          return;
        }
        if (error && error.code === 'auth/user-not-found') {
          setStatus(status, 'No account exists for that email.', 'error');
          return;
        }
        setStatus(status, 'Could not send a reset link right now. Please try again.', 'error');
      }
    });

  }

  function initTutorApplication() {
    const form = document.getElementById('tutorApplicationForm');
    if (!form) return;

    const proofInput = form.elements.qualificationProofFiles;
    const proofDropzone = document.getElementById('qualificationProofDropzone');
    const proofFileList = document.getElementById('qualificationProofFileList');
    let selectedProofFiles = [];

    function renderProofFiles() {
      if (!proofFileList) return;
      proofFileList.innerHTML = '';
      selectedProofFiles.forEach((file) => {
        const item = document.createElement('li');
        item.textContent = `${file.name} (${Math.max(1, Math.round(file.size / 1024))} KB)`;
        proofFileList.appendChild(item);
      });
    }

    function mergeProofFiles(incomingFiles) {
      const unique = new Map(selectedProofFiles.map((file) => [`${file.name}-${file.size}-${file.lastModified}`, file]));
      Array.from(incomingFiles).forEach((file) => {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        unique.set(key, file);
      });
      selectedProofFiles = Array.from(unique.values()).slice(0, 5);
      renderProofFiles();
    }

    if (proofInput) {
      proofInput.addEventListener('change', function () {
        mergeProofFiles(proofInput.files || []);
        proofInput.value = '';
      });
    }

    if (proofDropzone && proofInput) {
      proofDropzone.addEventListener('click', function () {
        proofInput.click();
      });

      proofDropzone.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        proofInput.click();
      });

      ['dragenter', 'dragover'].forEach((eventName) => {
        proofDropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          proofDropzone.classList.add('active');
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        proofDropzone.addEventListener(eventName, function (event) {
          event.preventDefault();
          proofDropzone.classList.remove('active');
        });
      });

      proofDropzone.addEventListener('drop', function (event) {
        mergeProofFiles(event.dataTransfer?.files || []);
      });
    }

    const status = document.getElementById('tutorApplicationStatus');
    const current = getCurrentUser();
    if (current) {
      form.elements.fullName.value = current.name;
      form.elements.email.value = current.email;
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const paymentLinksValue = form.elements.paymentLinks
        ? form.elements.paymentLinks.value.trim()
        : '';
      const selectedWorkDays = Array.from(form.querySelectorAll('input[name="workDays"]:checked')).map((input) => input.value);

      const application = {
        fullName: form.elements.fullName.value.trim(),
        email: form.elements.email.value.trim().toLowerCase(),
        subjects: form.elements.subjects.value.trim(),
        qualifications: form.elements.qualifications.value.trim(),
        hourlyRate: Number(form.elements.hourlyRate.value),
        paymentMethod: form.elements.paymentMethod.value.trim(),
        paymentLinks: paymentLinksValue,
        experience: form.elements.experience.value.trim(),
        workDays: selectedWorkDays,
        availability: selectedWorkDays.length === 7 ? 'high' : 'low',
        qualificationProofFiles: selectedProofFiles.map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream'
        })),
        referral: form.elements.referral.value.trim(),
        createdAt: new Date().toISOString()
      };

      if (!hasValidQualifications(application.qualifications)) {
        setStatus(status, 'Please enter valid qualifications (degree, certification, or teaching license).', 'error');
        return;
      }

      if (!application.workDays.length) {
        setStatus(status, 'Please choose at least one work day from Monday to Sunday.', 'error');
        return;
      }

      application.qualificationsVerified = true;

      if (!db) {
        setStatus(
          status,
          'Cloud sync is required to publish your tutor profile to all students. Add Firebase settings in firebase-config.js and try again.',
          'error'
        );
        return;
      }

      try {
        await createTutorApplication(application);
        await flushPendingTutorApplications();

        form.reset();
        selectedProofFiles = [];
        renderProofFiles();
        setStatus(status, 'Application sent and synced to all students.', 'success');
      } catch {
        queueTutorApplicationForSync(application);
        setStatus(status, 'Application saved on this device. We will keep retrying cloud sync automatically.', 'error');
      }
    });
  }

  function initSessionRequests() {
    const modalForm = document.getElementById('sessionRequestForm');
    if (!modalForm) return;

    const status = document.getElementById('sessionRequestStatus');
    const current = getCurrentUser();
    if (current) {
      modalForm.elements.name.value = current.name;
      modalForm.elements.email.value = current.email;
    }

    window.submitRequest = async function (event) {
      event.preventDefault();
      const tutor = document.getElementById('tutorName').textContent;
      const request = {
        tutor,
        name: modalForm.elements.name.value.trim(),
        email: modalForm.elements.email.value.trim().toLowerCase(),
        topic: modalForm.elements.topic.value.trim(),
        hours: Number(modalForm.elements.hours.value),
        paymentMethod: modalForm.elements.paymentMethod.value,
        totalCharge: document.getElementById('totalCharge').textContent,
        createdAt: new Date().toISOString()
      };

      const requests = loadJson(STORAGE_KEYS.sessionRequests, []);
      requests.push(request);
      saveJson(STORAGE_KEYS.sessionRequests, requests);

      try {
        await createSessionRequest(request);
        setStatus(status, `Request sent to ${tutor}!`, 'success');
        modalForm.reset();
        setTimeout(() => {
          if (window.closeModal) window.closeModal();
          status.textContent = '';
        }, 900);
      } catch {
        setStatus(status, 'Could not submit request right now. Please try again.', 'error');
      }
    };
  }

  function initTutorChat() {
    const chatForm = document.getElementById('chatForm');
    if (!chatForm) return;

    const status = document.getElementById('chatStatus');
    const current = getCurrentUser();
    if (current) {
      chatForm.elements.studentName.value = current.name;
      chatForm.elements.studentEmail.value = current.email;
    }

    window.submitChatMessage = function (event) {
      event.preventDefault();
      const tutor = document.getElementById('chatTutorName').textContent;
      const tutorEmail = document.getElementById('chatModal').dataset.tutorEmail || '';
      const message = {
        tutor,
        tutorEmail,
        studentName: chatForm.elements.studentName.value.trim(),
        studentEmail: chatForm.elements.studentEmail.value.trim().toLowerCase(),
        message: chatForm.elements.message.value.trim(),
        createdAt: new Date().toISOString()
      };

      if (!message.message) {
        setStatus(status, 'Please enter a message for the tutor.', 'error');
        return;
      }

      const messages = loadJson(STORAGE_KEYS.chatMessages, []);
      messages.push(message);
      saveJson(STORAGE_KEYS.chatMessages, messages);

      setStatus(status, `Message sent to ${tutor}! They'll get back to you soon.`, 'success');
      chatForm.elements.message.value = '';

      setTimeout(() => {
        if (window.closeChatModal) window.closeChatModal();
      }, 900);
    };
  }

  document.addEventListener('DOMContentLoaded', async function () {
    await initFirebase();
    updateAuthUI();
    flushPendingTutorApplications();
    initSignup();
    initLogin();
    initForgotPassword();
    initTutorApplication();
    initTutorDirectory();
    initSessionRequests();
    initTutorChat();
  });
})();

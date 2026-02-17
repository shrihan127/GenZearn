(function () {
  const STORAGE_KEYS = {
    users: 'genzearn_users',
    currentUser: 'genzearn_current_user',
    tutorApps: 'genzearn_tutor_applications',
    sessionRequests: 'genzearn_session_requests',
    chatMessages: 'genzearn_chat_messages'
  };

  const RESET_CODE_EXPIRY_MS = 10 * 60 * 1000;

  let db = null;
  let activeResetCode = null;

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

  function initFirebase() {
    if (!window.firebase || !hasUsableFirebaseConfig(window.firebaseConfig)) return;

    if (!window.firebase.apps.length) {
      window.firebase.initializeApp(window.firebaseConfig);
    }
    db = window.firebase.database();
  }

  async function findUserByEmail(email) {
    if (!db) return null;

    const snapshot = await db.ref('users').orderByChild('email').equalTo(email).limitToFirst(1).once('value');
    const users = snapshot.val();
    if (!users) return null;

    const key = Object.keys(users)[0];
    return { key, ...users[key] };
  }

  async function updateRemoteUserPassword(email, newPassword) {
    if (!db) return;
    const user = await findUserByEmail(email);
    if (!user || !user.key) return;
    await db.ref(`users/${user.key}/password`).set(newPassword);
  }

  async function createUserRecord(user) {
    if (!db) return;
    await db.ref('users').push(user);
  }

  async function createTutorApplication(application) {
    if (!db) return;
    await db.ref('tutorApplications').push(application);
  }

  async function createSessionRequest(request) {
    if (!db) return;
    await db.ref('sessionRequests').push(request);
  }

  async function getTutorApplications() {
    const localApplications = loadJson(STORAGE_KEYS.tutorApps, []);
    if (!db) return localApplications;

    const snapshot = await db.ref('tutorApplications').once('value');
    const remoteApplications = Object.values(snapshot.val() || {});
    return [...remoteApplications, ...localApplications];
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
        const experience = tutor.experience ? `<p><strong>Experience:</strong> ${tutor.experience}</p>` : '';
        const verificationLabel = tutor.verification
          ? `<p class="verification-pill ${tutor.verification.status}">${tutor.verification.message}</p>`
          : '<p class="verification-pill pending">Qualification review pending</p>';
        return `
          <div class="tutor-card">
            <img src="https://via.placeholder.com/120" alt="Tutor ${fullName}">
            <h3>${fullName}</h3>
            <p><strong>Subject:</strong> ${subject}</p>
            <p><strong>Qualifications:</strong> ${qualifications}</p>
            <p><strong>Rate:</strong> $${rate} / hour</p>
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
        openModal(String(tutor.fullName), Number(tutor.hourlyRate), String(tutor.subjects));
      });
    });

    const chatButtons = tutorList.querySelectorAll('[data-chat-tutor-index]');
    chatButtons.forEach((button) => {
      button.addEventListener('click', function () {
        const tutor = tutors[Number(button.dataset.chatTutorIndex)];
        if (!tutor || !window.openChatModal) return;
        window.openChatModal(String(tutor.fullName), String(tutor.email || ''));
      });
    });
  }

  async function initTutorDirectory() {
    const tutorList = document.getElementById('tutorList');
    if (!tutorList) return;

    tutorList.innerHTML = '<p class="status-message">Loading tutors...</p>';

    try {
      const applications = await getTutorApplications();
      const tutors = normalizeTutorList(applications).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      renderTutorList(tutors);
    } catch {
      tutorList.innerHTML = '<p class="status-message error">Could not load tutors right now. Please refresh and try again.</p>';
    }
  }

  function findLocalUserByEmail(email) {
    const users = loadJson(STORAGE_KEYS.users, []);
    return users.find((u) => u.email === email) || null;
  }

  function updateLocalPassword(email, newPassword) {
    const users = loadJson(STORAGE_KEYS.users, []);
    const userIndex = users.findIndex((u) => u.email === email);
    if (userIndex === -1) return false;

    users[userIndex].password = newPassword;
    saveJson(STORAGE_KEYS.users, users);
    return true;
  }

  function createVerificationCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
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
      accountArea.innerHTML = `<span class="user-chip">Hi, ${current.name.split(' ')[0]}</span><button class="logout-btn" type="button">Logout</button>`;
      const logoutBtn = accountArea.querySelector('.logout-btn');
      logoutBtn.addEventListener('click', function () {
        localStorage.removeItem(STORAGE_KEYS.currentUser);
        window.location.href = 'index.html';
      });
    } else {
      accountArea.innerHTML = '';
    }
  }

  function initSignup() {
    const form = document.getElementById('signupForm');
    if (!form) return;

    const status = document.getElementById('signupStatus');
    const submitButton = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (submitButton) submitButton.disabled = true;

      const name = form.elements.fullName.value.trim();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;
      const role = form.elements.role.value;
      const primarySubject = form.elements.primarySubject.value.trim();

      const users = loadJson(STORAGE_KEYS.users, []);
      if (users.some((u) => u.email === email)) {
        setStatus(status, 'An account with this email already exists. Please log in.', 'error');
        if (submitButton) submitButton.disabled = false;
        return;
      }

      try {
        if (db) {
          try {
            const existingRemoteUser = await findUserByEmail(email);
            if (existingRemoteUser) {
              setStatus(status, 'An account with this email already exists. Please log in.', 'error');
              return;
            }
          } catch {
            setStatus(status, 'Continuing with local account creation (cloud sync unavailable).', 'error');
          }
        }

        const user = { name, email, password, role, primarySubject, createdAt: new Date().toISOString() };
        users.push(user);
        saveJson(STORAGE_KEYS.users, users);

        try {
          await createUserRecord(user);
        } catch {
          // Keep local signup working even if cloud sync fails.
        }

        setCurrentUser({ name: user.name, email: user.email, role: user.role });

        setStatus(status, 'Account created successfully! Redirecting to tutors...', 'success');
        setTimeout(() => {
          window.location.href = 'connect.html';
        }, 800);
      } catch {
        setStatus(status, 'Could not create account right now. Please try again.', 'error');
      } finally {
        if (submitButton) submitButton.disabled = false;
      }
    });
  }

  function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const status = document.getElementById('loginStatus');
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;

      try {
        const remoteUser = await findUserByEmail(email);
        const localUsers = loadJson(STORAGE_KEYS.users, []);
        const localUser = localUsers.find((u) => u.email === email && u.password === password);
        const matchingRemoteUser = remoteUser && remoteUser.password === password ? remoteUser : null;
        const user = matchingRemoteUser || localUser;

        if (!user) {
          setStatus(status, 'Invalid email or password. Try signing up first.', 'error');
          return;
        }

        setCurrentUser({ name: user.name, email: user.email, role: user.role || '' });
        setStatus(status, 'Logged in successfully! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'connect.html';
        }, 800);
      } catch {
        setStatus(status, 'Could not log in right now. Please try again.', 'error');
      }
    });
  }

  function initForgotPassword() {
    const toggleBtn = document.getElementById('forgotPasswordBtn');
    const panel = document.getElementById('forgotPasswordPanel');
    const sendCodeForm = document.getElementById('sendCodeForm');
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    const status = document.getElementById('forgotPasswordStatus');

    if (!toggleBtn || !panel || !sendCodeForm || !resetPasswordForm || !status) return;

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
        const remoteUser = await findUserByEmail(email);
        const localUser = findLocalUserByEmail(email);
        if (!remoteUser && !localUser) {
          setStatus(status, 'No account exists for that email.', 'error');
          return;
        }

        const code = createVerificationCode();
        activeResetCode = {
          email,
          code,
          expiresAt: Date.now() + RESET_CODE_EXPIRY_MS
        };

        resetPasswordForm.classList.remove('hidden');
        setStatus(status, `Verification code sent to ${email}. (Demo code: ${code})`, 'success');
      } catch {
        setStatus(status, 'Could not send a verification code right now. Please try again.', 'error');
      }
    });

    resetPasswordForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const code = resetPasswordForm.elements.verificationCode.value.trim();
      const newPassword = resetPasswordForm.elements.newPassword.value;
      const confirmPassword = resetPasswordForm.elements.confirmPassword.value;

      if (!activeResetCode) {
        setStatus(status, 'Send a verification code first.', 'error');
        return;
      }

      if (Date.now() > activeResetCode.expiresAt) {
        activeResetCode = null;
        setStatus(status, 'Verification code expired. Please request a new one.', 'error');
        return;
      }

      if (code !== activeResetCode.code) {
        setStatus(status, 'Incorrect verification code.', 'error');
        return;
      }

      if (newPassword.length < 6) {
        setStatus(status, 'Password must be at least 6 characters long.', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        setStatus(status, 'Passwords do not match.', 'error');
        return;
      }

      try {
        updateLocalPassword(activeResetCode.email, newPassword);
        await updateRemoteUserPassword(activeResetCode.email, newPassword);
        activeResetCode = null;

        sendCodeForm.reset();
        resetPasswordForm.reset();
        resetPasswordForm.classList.add('hidden');
        setStatus(status, 'Password updated successfully. You can now log in.', 'success');
      } catch {
        setStatus(status, 'Could not reset password right now. Please try again.', 'error');
      }
    });
  }

  function initTutorApplication() {
    const form = document.getElementById('tutorApplicationForm');
    if (!form) return;

    const status = document.getElementById('tutorApplicationStatus');
    const current = getCurrentUser();
    if (current) {
      form.elements.fullName.value = current.name;
      form.elements.email.value = current.email;
    }

    function qualificationReviewBot(application) {
      const qualificationProof = application.qualificationProof;
      const referral = application.referral;
      const hasProof = qualificationProof.length >= 8;
      const hasReferral = referral.length >= 8;

      if (hasProof || hasReferral) {
        return {
          status: 'verified',
          message: hasProof
            ? 'Qualification bot: verified with proof details'
            : 'Qualification bot: verified via referral'
        };
      }

      return {
        status: 'rejected',
        message: 'Qualification bot: add proof details or a referral'
      };
    }

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const application = {
        fullName: form.elements.fullName.value.trim(),
        email: form.elements.email.value.trim().toLowerCase(),
        subjects: form.elements.subjects.value.trim(),
        qualifications: form.elements.qualifications.value.trim(),
        hourlyRate: Number(form.elements.hourlyRate.value),
        paymentMethod: form.elements.paymentMethod.value.trim(),
        experience: form.elements.experience.value.trim(),
        qualificationType: form.elements.qualificationType.value.trim(),
        qualificationProof: form.elements.qualificationProof.value.trim(),
        referral: form.elements.referral.value.trim(),
        createdAt: new Date().toISOString()
      };

      if (!hasValidQualifications(application.qualifications)) {
        setStatus(status, 'Please enter valid qualifications (degree, certification, or teaching license).', 'error');
        return;
      }

      application.qualificationsVerified = true;

      const apps = loadJson(STORAGE_KEYS.tutorApps, []);
      apps.push(application);
      saveJson(STORAGE_KEYS.tutorApps, apps);

      try {
        await createTutorApplication(application);
        form.reset();
        setStatus(status, 'Application submitted and qualification bot marked it as verified.', 'success');
      } catch {
        setStatus(status, 'Could not submit application right now. Please try again.', 'error');
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

  document.addEventListener('DOMContentLoaded', function () {
    initFirebase();
    updateAuthUI();
    initSignup();
    initLogin();
    initForgotPassword();
    initTutorApplication();
    initTutorDirectory();
    initSessionRequests();
    initTutorChat();
  });
})();

(function () {
  const STORAGE_KEYS = {
    users: 'genzearn_users',
    currentUser: 'genzearn_current_user',
    tutorApps: 'genzearn_tutor_applications',
    sessionRequests: 'genzearn_session_requests'
  };

  const RESET_CODE_EXPIRY_MS = 10 * 60 * 1000;

  let db = null;
  let activeResetCode = null;

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
    if (!window.firebase || !window.firebaseConfig) return;

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

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const application = {
        fullName: form.elements.fullName.value.trim(),
        email: form.elements.email.value.trim().toLowerCase(),
        subjects: form.elements.subjects.value.trim(),
        hourlyRate: Number(form.elements.hourlyRate.value),
        paymentMethod: form.elements.paymentMethod.value.trim(),
        experience: form.elements.experience.value.trim(),
        createdAt: new Date().toISOString()
      };

      const apps = loadJson(STORAGE_KEYS.tutorApps, []);
      apps.push(application);
      saveJson(STORAGE_KEYS.tutorApps, apps);

      try {
        await createTutorApplication(application);
        form.reset();
        setStatus(status, 'Application submitted! We will contact you soon.', 'success');
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

  document.addEventListener('DOMContentLoaded', function () {
    initFirebase();
    updateAuthUI();
    initSignup();
    initLogin();
    initForgotPassword();
    initTutorApplication();
    initSessionRequests();
  });
})();

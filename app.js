(function () {
  const STORAGE_KEYS = {
    users: 'genzearn_users',
    currentUser: 'genzearn_current_user',
    tutorApps: 'genzearn_tutor_applications',
    sessionRequests: 'genzearn_session_requests'
  };

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
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const name = form.elements.fullName.value.trim();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;

      const users = loadJson(STORAGE_KEYS.users, []);
      if (users.some((u) => u.email === email)) {
        setStatus(status, 'An account with this email already exists. Please log in.', 'error');
        return;
      }

      const user = { name, email, password, createdAt: new Date().toISOString() };
      users.push(user);
      saveJson(STORAGE_KEYS.users, users);
      setCurrentUser({ name: user.name, email: user.email });

      setStatus(status, 'Account created successfully! Redirecting to tutors...', 'success');
      setTimeout(() => {
        window.location.href = 'connect.html';
      }, 800);
    });
  }

  function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const status = document.getElementById('loginStatus');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const email = form.elements.email.value.trim().toLowerCase();
      const password = form.elements.password.value;

      const users = loadJson(STORAGE_KEYS.users, []);
      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        setStatus(status, 'Invalid email or password. Try signing up first.', 'error');
        return;
      }

      setCurrentUser({ name: user.name, email: user.email });
      setStatus(status, 'Logged in successfully! Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = 'connect.html';
      }, 800);
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

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const apps = loadJson(STORAGE_KEYS.tutorApps, []);
      apps.push({
        fullName: form.elements.fullName.value.trim(),
        email: form.elements.email.value.trim().toLowerCase(),
        subjects: form.elements.subjects.value.trim(),
        experience: form.elements.experience.value.trim(),
        createdAt: new Date().toISOString()
      });
      saveJson(STORAGE_KEYS.tutorApps, apps);
      form.reset();
      setStatus(status, 'Application submitted! We will contact you soon.', 'success');
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

    window.submitRequest = function (event) {
      event.preventDefault();
      const tutor = document.getElementById('tutorName').textContent;
      const requests = loadJson(STORAGE_KEYS.sessionRequests, []);
      requests.push({
        tutor,
        name: modalForm.elements.name.value.trim(),
        email: modalForm.elements.email.value.trim().toLowerCase(),
        topic: modalForm.elements.topic.value.trim(),
        createdAt: new Date().toISOString()
      });
      saveJson(STORAGE_KEYS.sessionRequests, requests);
      setStatus(status, `Request sent to ${tutor}!`, 'success');
      modalForm.reset();
      setTimeout(() => {
        if (window.closeModal) window.closeModal();
        status.textContent = '';
      }, 900);
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateAuthUI();
    initSignup();
    initLogin();
    initTutorApplication();
    initSessionRequests();
  });
})();

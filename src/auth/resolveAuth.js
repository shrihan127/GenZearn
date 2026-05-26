import {
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithCredential,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

export async function signInUnified(auth, email, password) {
  const methods = await fetchSignInMethodsForEmail(auth, email);

  const hasGoogle = methods.includes('google.com');

  if (password) {
    const result = await signInWithEmailAndPassword(auth, email, password);

    if (hasGoogle) {
      try {
        const googleCred = GoogleAuthProvider.credential(null, null);
        await linkWithCredential(result.user, googleCred);
      } catch {
        // ignore if already linked
      }
    }

    return result;
  }

  throw new Error('Password required for email login flow.');
}

export async function signInWithGoogleUnified(auth) {
  const provider = new GoogleAuthProvider();

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (error.code !== 'auth/account-exists-with-different-credential') {
      throw error;
    }

    const email = error.customData?.email;
    const pendingCred = GoogleAuthProvider.credentialFromError(error);

    const methods = await fetchSignInMethodsForEmail(auth, email);

    if (methods.includes('password')) {
      const password = window.prompt('Enter your password to link Google:');
      if (!password) throw new Error('Account linking cancelled.');

      const userCred = await signInWithEmailAndPassword(auth, email, password);

      await linkWithCredential(userCred.user, pendingCred);

      return userCred;
    }

    throw new Error('Sign in with existing method first.');
  }
}

export async function signUpUnified(auth, email, password, name) {
  const methods = await fetchSignInMethodsForEmail(auth, email);

  if (methods.length > 0) {
    throw new Error('Account already exists. Please log in instead.');
  }

  const result = await createUserWithEmailAndPassword(auth, email, password);

  await updateProfile(result.user, {
    displayName: name
  });

  return result;
}

export async function linkPasswordToCurrentUser(auth, email, password) {
  const credential = EmailAuthProvider.credential(email, password);
  return linkWithCredential(auth.currentUser, credential);
}

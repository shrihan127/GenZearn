import {
  Auth,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  UserCredential,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

export async function signInWithGoogleHandlingDuplicates(auth: Auth): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    const e = error as { code?: string; customData?: { email?: string } };
    if (e?.code !== 'auth/account-exists-with-different-credential') {
      throw error;
    }

    const email = String(e.customData?.email || '').trim().toLowerCase();
    if (!email) {
      throw new Error('Email was not returned by Firebase for duplicate-account resolution.');
    }

    const pendingCredential = GoogleAuthProvider.credentialFromError(error as Error);
    if (!pendingCredential) {
      throw new Error('Could not recover Google credential for account linking.');
    }

    const methods = await fetchSignInMethodsForEmail(auth, email);

    if (methods.includes('password')) {
      const promptFn = typeof window !== 'undefined' ? window.prompt : undefined;
      const password = promptFn ? promptFn('Enter your password to link Google:') : null;

      if (!password) {
        throw new Error('Account linking cancelled.');
      }

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await linkWithCredential(userCred.user, pendingCredential);
      return userCred;
    }

    throw new Error('Please sign in with your existing provider first, then link Google from account settings.');
  }
}

export async function signInWithPasswordThenLinkPendingGoogle(
  auth: Auth,
  email: string,
  password: string,
  pendingGoogleCredential?: ReturnType<typeof GoogleAuthProvider.credentialFromError>
): Promise<UserCredential> {
  const result = await signInWithEmailAndPassword(auth, email, password);

  if (pendingGoogleCredential) {
    await linkWithCredential(result.user, pendingGoogleCredential);
  }

  return result;
}

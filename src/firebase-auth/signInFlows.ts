import {
  Auth,
  GoogleAuthProvider,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  UserCredential,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';

export async function resolveAccount(auth: Auth, email: string): Promise<{ hasPassword: boolean; hasGoogle: boolean; methods: string[] }> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);

  return {
    hasPassword: methods.includes('password'),
    hasGoogle: methods.includes('google.com'),
    methods,
  };
}

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

    const pendingCredential = GoogleAuthProvider.credentialFromError(error as {
      customData?: { email?: string };
      code?: string;
    });
    if (!pendingCredential) {
      throw new Error('Could not recover Google credential for account linking.');
    }

    const { hasPassword } = await resolveAccount(auth, email);

    if (hasPassword) {
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
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const { hasPassword, hasGoogle } = await resolveAccount(auth, normalizedEmail);

  if (hasGoogle && !hasPassword) {
    throw new Error('This account uses Google. Please sign in with Google.');
  }

  const result = await signInWithEmailAndPassword(auth, normalizedEmail, password);

  if (pendingGoogleCredential) {
    await linkWithCredential(result.user, pendingGoogleCredential);
  }

  return result;
}

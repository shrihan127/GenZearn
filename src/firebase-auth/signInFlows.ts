import {
  Auth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  UserCredential,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  completePendingCredentialSignIn,
  handleAccountExistsWithDifferentCredential,
} from './firebaseAuth';

export async function signInWithGoogleHandlingDuplicates(auth: Auth): Promise<UserCredential> {
  try {
    return await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    const resolution = await handleAccountExistsWithDifferentCredential(auth, error);
    if (!resolution) throw error;

    if (resolution.existingMethods.includes('password')) {
      throw new Error(
        `An account already exists for ${resolution.email} using email/password. Sign in with password first, then link Google from account settings.`
      );
    }

    throw new Error(`Account exists for ${resolution.email} with providers: ${resolution.existingMethods.join(', ')}`);
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
    await completePendingCredentialSignIn(auth, pendingGoogleCredential);
  }

  return result;
}

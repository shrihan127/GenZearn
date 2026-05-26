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

    const enhanced = new Error(
      `An account already exists for ${resolution.email}. Sign in with your existing method, then link Google.`
    ) as Error & {
      code?: string;
      email?: string;
      existingMethods?: string[];
      pendingCredential?: ReturnType<typeof GoogleAuthProvider.credentialFromError>;
    };

    enhanced.code = 'auth/account-exists-with-different-credential';
    enhanced.email = resolution.email;
    enhanced.existingMethods = resolution.existingMethods;
    enhanced.pendingCredential = resolution.pendingCredential;
    throw enhanced;
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

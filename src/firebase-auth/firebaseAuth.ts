import {
  Auth,
  EmailAuthProvider,
  FacebookAuthProvider,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  linkWithPopup,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  signInWithCredential,
  unlink,
  updateEmail,
  updatePassword,
  User,
  UserCredential,
} from 'firebase/auth';

export type SupportedProviderId = 'password' | 'google.com';

export interface AccountExistsResolution {
  existingMethods: string[];
  email: string;
  pendingCredential?: ReturnType<typeof GoogleAuthProvider.credentialFromError>;
}

export interface LinkedProviders {
  hasPassword: boolean;
  hasGoogle: boolean;
  providerIds: string[];
}

export function getLinkedProviders(user: User): LinkedProviders {
  const providerIds = user.providerData.map((p) => p.providerId);
  return {
    hasPassword: providerIds.includes('password'),
    hasGoogle: providerIds.includes('google.com'),
    providerIds,
  };
}

export async function handleAccountExistsWithDifferentCredential(auth: Auth, error: unknown): Promise<AccountExistsResolution | null> {
  const e = error as { code?: string; customData?: { email?: string } };
  if (e?.code !== 'auth/account-exists-with-different-credential') return null;

  const email = e.customData?.email;
  if (!email) {
    throw new Error('Email was not returned by Firebase for duplicate-account resolution.');
  }

  const existingMethods = await fetchSignInMethodsForEmail(auth, email);
  return {
    email,
    existingMethods,
    pendingCredential: GoogleAuthProvider.credentialFromError(error as Error),
  };
}

export async function linkGoogleProvider(user: User): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return linkWithPopup(user, provider);
}

export async function linkEmailPasswordProvider(user: User, email: string, password: string): Promise<UserCredential> {
  const credential = EmailAuthProvider.credential(email, password);
  return linkWithCredential(user, credential);
}

export async function unlinkProvider(user: User, providerId: SupportedProviderId): Promise<User> {
  return unlink(user, providerId);
}

export async function reauthenticateForSensitiveAction(user: User, opts: { providerId: SupportedProviderId; email?: string; password?: string }): Promise<UserCredential> {
  if (opts.providerId === 'google.com') {
    const provider = new GoogleAuthProvider();
    return reauthenticateWithPopup(user, provider);
  }

  if (!opts.email || !opts.password) {
    throw new Error('Email and password are required to reauthenticate with password provider.');
  }

  const credential = EmailAuthProvider.credential(opts.email, opts.password);
  return reauthenticateWithCredential(user, credential);
}

export async function addPasswordToGoogleAccount(user: User, email: string, password: string): Promise<void> {
  // If user was created with Google and has no password provider yet, set email/password.
  await linkEmailPasswordProvider(user, email, password);
}

export async function completePendingCredentialSignIn(auth: Auth, pendingCredential: NonNullable<AccountExistsResolution['pendingCredential']>): Promise<UserCredential> {
  return signInWithCredential(auth, pendingCredential);
}

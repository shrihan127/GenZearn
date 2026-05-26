# Firebase Auth Provider Linking (v9 modular, TypeScript)

## Security best practices

1. Enforce **verified email ownership** before linking providers if you rely on email-based identity.
2. Require recent login (`reauthenticateWithPopup`/`reauthenticateWithCredential`) before sensitive operations such as unlinking last provider, email changes, or password updates.
3. Never allow a user to unlink their **last sign-in method**; always keep at least one provider linked.
4. Persist linked provider state in Firestore (`users/{uid}.linkedProviders`) and verify auth in Firestore rules.
5. Use `fetchSignInMethodsForEmail` to prevent accidental duplicate accounts and guide users to the existing method.
6. Keep OAuth scopes minimal (`profile`, `email` for Google by default).
7. Store only non-sensitive profile fields in Firestore; never store plaintext passwords.
8. Handle `auth/requires-recent-login`, `auth/provider-already-linked`, `auth/credential-already-in-use`, and `auth/account-exists-with-different-credential` explicitly.

## Firestore rules baseline

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

## Example usage

Render `<LinkedProvidersPanel auth={auth} db={db} />` in your account settings page.

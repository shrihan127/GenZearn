import React, { FormEvent, useState } from 'react';
import { Auth } from 'firebase/auth';
import { Firestore } from 'firebase/firestore';
import { useLinkedProviders } from './useLinkedProviders';

export function LinkedProvidersPanel({ auth, db }: { auth: Auth; db: Firestore }) {
  const { user, loading, hasGoogle, hasPassword, providerIds, linkGoogle, linkPassword, unlink } = useLinkedProviders(auth, db);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onAddPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await linkPassword(email, password);
      setPassword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not link password provider';
      setError(message);
    }
  };

  if (loading) return <p>Loading provider settings…</p>;
  if (!user) return <p>Please sign in.</p>;

  return (
    <section>
      <h2>Linked sign-in providers</h2>
      <p>Current providers: {providerIds.join(', ') || 'None'}</p>

      <button disabled={hasGoogle} onClick={() => linkGoogle()}>
        {hasGoogle ? 'Google linked' : 'Link Google'}
      </button>
      {hasGoogle && (
        <button onClick={() => unlink('google.com')}>
          Unlink Google
        </button>
      )}

      {!hasPassword ? (
        <form onSubmit={onAddPassword}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create password" minLength={8} required />
          <button type="submit">Add email/password</button>
        </form>
      ) : (
        <button onClick={() => unlink('password')}>Unlink email/password</button>
      )}

      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}

import { useSearchParams } from 'react-router-dom';

/**
 * Public landing after a service-initiated logout (PC10): never starts /authorize by itself,
 * the user logs in again by choice.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
  const loggedOut = searchParams.get('logged_out') === '1';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-bold">QR Code</h1>
      {loggedOut && (
        <p role="status" className="text-gray-500">
          Vous avez été déconnecté.
        </p>
      )}
      <a
        href="/api/auth/login"
        className="rounded-full bg-gray-900 px-8 py-3 font-medium text-white"
      >
        Se connecter
      </a>
    </main>
  );
}

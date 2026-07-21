export function LoggedOutPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Vous êtes déconnecté</h1>
        <p className="text-sm text-gray-500">Vos tokens ont été supprimés de cet appareil.</p>
      </div>
      <a
        href="/api/auth/login"
        className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        Se connecter
      </a>
    </div>
  );
}

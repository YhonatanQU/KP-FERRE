import { Link, Outlet, useLocation } from 'react-router';
import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { useAuth } from './auth/AuthProvider';
import { getFirstAllowedPath, getRequiredPermissionForPath } from './auth/permissions';

export function Root() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { hasPermission, user } = useAuth();
  const requiredPermission = getRequiredPermissionForPath(location.pathname);
  const isAllowed = requiredPermission ? hasPermission(requiredPermission) : true;
  const fallbackPath = getFirstAllowedPath(user?.permissions ?? []);

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar open={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header onSidebarToggle={() => setIsSidebarOpen((prev) => !prev)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isAllowed ? (
            <Outlet />
          ) : (
            <div className="mx-auto mt-10 max-w-2xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900/40 dark:bg-gray-900">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-500">Acceso restringido</p>
              <h1 className="mt-4 text-3xl font-semibold text-gray-900 dark:text-white">No tienes permisos para este módulo</h1>
              <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                Tu sesión está activa, pero tu rol actual no incluye acceso a esta sección. Usa un perfil con permisos
                adecuados o vuelve al primer módulo habilitado.
              </p>
              <Link
                to={fallbackPath}
                className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Ir a módulo disponible
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

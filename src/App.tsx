import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useAuth } from './context/AuthContext';
import LoadingScreen from './components/LoadingScreen';
import LoginView from './components/LoginView';
import MarketingSite from './components/MarketingSite';

const WorkspaceApp = lazy(() => import('./WorkspaceApp'));

const PRODUCT_PATHS = new Set([
  '/dashboard',
  '/favoritos',
  '/pipeline',
  '/configuracoes',
]);

function normalizePath(value: string) {
  if (!value || value === '/') return '/';
  return value.replace(/\/+$/, '') || '/';
}

export default function App() {
  const { user, loading } = useAuth();
  const [pathname, setPathname] = useState(() => normalizePath(window.location.pathname));

  const navigate = useCallback((target: string, replace = false) => {
    const url = new URL(target, window.location.origin);
    const next = `${url.pathname}${url.search}${url.hash}`;

    if (replace) window.history.replaceState({}, '', next);
    else window.history.pushState({}, '', next);

    setPathname(normalizePath(url.pathname));
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  useEffect(() => {
    const onPopState = () => setPathname(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (loading) return;

    if (pathname === '/login' && user) {
      const params = new URLSearchParams(window.location.search);
      const requested = String(params.get('next') || '').trim();
      const nextPath = PRODUCT_PATHS.has(normalizePath(requested))
        ? normalizePath(requested)
        : '/dashboard';
      navigate(nextPath, true);
      return;
    }

    if (PRODUCT_PATHS.has(pathname) && !user) {
      const next = encodeURIComponent(pathname);
      navigate(`/login?next=${next}`, true);
      return;
    }

    const known = pathname === '/' || pathname === '/login' || PRODUCT_PATHS.has(pathname);
    if (!known) {
      navigate(user ? '/dashboard' : '/', true);
    }
  }, [loading, navigate, pathname, user]);

  if (pathname === '/') {
    return (
      <MarketingSite
        isAuthenticated={Boolean(user)}
        onLogin={() => navigate(user ? '/dashboard' : '/login')}
        onStart={() => navigate(user ? '/dashboard' : '/login?mode=signup')}
        onOpenDashboard={() => navigate('/dashboard')}
      />
    );
  }

  if (loading) return <LoadingScreen />;

  if (pathname === '/login') {
    if (user) return <LoadingScreen />;
    return <LoginView />;
  }

  if (!user) return <LoadingScreen />;

  return (
    <Suspense fallback={<LoadingScreen />}>
      <WorkspaceApp />
    </Suspense>
  );
}

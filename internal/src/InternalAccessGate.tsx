import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import {
  authorizeInternalSession,
  clearInternalGateSession,
  hasInternalGateSession,
  verifyInternalCode,
} from './api';

function Shell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background:
          'radial-gradient(circle at 50% -10%, rgba(255,90,18,.14), transparent 34%), #07090c',
        color: '#fff',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 430,
          border: '1px solid rgba(255,255,255,.09)',
          background: 'rgba(14,17,21,.96)',
          borderRadius: 28,
          padding: '34px 32px 30px',
          boxShadow: '0 32px 110px rgba(0,0,0,.55)',
        }}
      >
        {children}
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div style={{ marginBottom: 30 }}>
      <img
        src="/logo_white.png"
        alt="Scoutly"
        style={{ display: 'block', height: 42, width: 'auto', maxWidth: 180, objectFit: 'contain' }}
      />
      <div
        style={{
          marginTop: 14,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          border: '1px solid rgba(255,255,255,.08)',
          background: 'rgba(255,255,255,.035)',
          borderRadius: 999,
          padding: '6px 10px',
          color: '#8e8e93',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '.13em',
        }}
      >
        <ShieldCheck size={12} /> SCOUTLY INTERNAL
      </div>
    </div>
  );
}

export default function InternalAccessGate({ children }: { children: ReactNode }) {
  const resumeExistingSession = useRef(hasInternalGateSession());
  const autoResumeAttempted = useRef(false);
  const [gateReady, setGateReady] = useState(hasInternalGateSession());
  const [authorized, setAuthorized] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() =>
    onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    }),
  []);

  useEffect(() => {
    if (!resumeExistingSession.current || autoResumeAttempted.current || !authReady || !firebaseUser || !gateReady) return;
    autoResumeAttempted.current = true;
    setLoading(true);
    authorizeInternalSession()
      .then(() => setAuthorized(true))
      .catch(async (err: any) => {
        if (err?.status === 401) {
          clearInternalGateSession();
          setGateReady(false);
        } else if (err?.status === 403) {
          await signOut(auth).catch(() => undefined);
          setError(err?.message || 'Esta conta não possui acesso interno.');
        }
      })
      .finally(() => setLoading(false));
  }, [authReady, firebaseUser, gateReady]);

  const submitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code) || loading) return;
    setLoading(true);
    setError('');
    try {
      await verifyInternalCode(code);
      resumeExistingSession.current = false;
      setGateReady(true);
      setCode('');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível validar o código.');
    } finally {
      setLoading(false);
    }
  };

  const loginGoogle = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
      await authorizeInternalSession();
      setAuthorized(true);
    } catch (err: any) {
      const status = Number(err?.status || 0);
      if (status === 401) {
        clearInternalGateSession();
        setGateReady(false);
      }
      if (status === 403) {
        await signOut(auth).catch(() => undefined);
      }
      const cancelled = String(err?.code || '').includes('popup-closed');
      if (!cancelled) setError(err?.message || 'Não foi possível autorizar esta conta.');
    } finally {
      setLoading(false);
    }
  };

  if (authorized) return <>{children}</>;

  if (!authReady || (resumeExistingSession.current && loading && gateReady)) {
    return (
      <Shell>
        <Brand />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#a1a1aa', fontSize: 13 }}>
          <Loader2 size={17} className="spin" /> Validando acesso interno…
        </div>
      </Shell>
    );
  }

  if (!gateReady) {
    return (
      <Shell>
        <Brand />
        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              display: 'grid',
              placeItems: 'center',
              color: '#ff6a26',
              background: 'rgba(255,90,18,.09)',
              border: '1px solid rgba(255,90,18,.18)',
              marginBottom: 18,
            }}
          >
            <LockKeyhole size={20} />
          </div>
          <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.12, letterSpacing: '-.035em', fontWeight: 650 }}>
            Acesso interno
          </h1>
          <p style={{ margin: '10px 0 0', color: '#71717a', fontSize: 13, lineHeight: 1.6 }}>
            Insira o código de segurança para continuar para a autenticação da equipe.
          </p>
        </div>

        <form onSubmit={submitCode}>
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-label="Código de acesso de 6 dígitos"
            placeholder="••••••"
            style={{
              boxSizing: 'border-box',
              width: '100%',
              height: 62,
              borderRadius: 17,
              border: error ? '1px solid rgba(244,63,94,.42)' : '1px solid rgba(255,255,255,.10)',
              background: '#090c10',
              outline: 'none',
              color: '#fff',
              textAlign: 'center',
              fontSize: 25,
              fontWeight: 650,
              letterSpacing: '.36em',
              paddingLeft: '.36em',
            }}
          />
          {error && <div style={{ color: '#fb7185', fontSize: 11, lineHeight: 1.5, marginTop: 10 }}>{error}</div>}
          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            style={{
              width: '100%',
              height: 48,
              marginTop: 16,
              border: 0,
              borderRadius: 14,
              background: '#ff5a12',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              cursor: code.length === 6 && !loading ? 'pointer' : 'not-allowed',
              opacity: code.length === 6 && !loading ? 1 : .42,
            }}
          >
            {loading ? 'Validando…' : 'Continuar'}
          </button>
        </form>
        <p style={{ margin: '20px 0 0', color: '#52525b', fontSize: 10, lineHeight: 1.5, textAlign: 'center' }}>
          Área restrita. Tentativas de acesso são registradas.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <Brand />
      <div style={{ marginBottom: 26 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 15,
            display: 'grid',
            placeItems: 'center',
            color: '#34d399',
            background: 'rgba(16,185,129,.08)',
            border: '1px solid rgba(16,185,129,.18)',
            marginBottom: 18,
          }}
        >
          <CheckCircle2 size={20} />
        </div>
        <h1 style={{ margin: 0, fontSize: 27, lineHeight: 1.12, letterSpacing: '-.035em', fontWeight: 650 }}>
          Código confirmado
        </h1>
        <p style={{ margin: '10px 0 0', color: '#71717a', fontSize: 13, lineHeight: 1.6 }}>
          Agora autentique sua conta Google. O acesso só será liberado para contas cadastradas como equipe interna.
        </p>
      </div>

      {error && <div style={{ color: '#fb7185', fontSize: 11, lineHeight: 1.5, marginBottom: 12 }}>{error}</div>}
      <button
        type="button"
        onClick={() => void loginGoogle()}
        disabled={loading}
        style={{
          width: '100%',
          height: 50,
          borderRadius: 14,
          border: '1px solid rgba(255,255,255,.11)',
          background: '#fff',
          color: '#111827',
          fontSize: 12,
          fontWeight: 700,
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {loading ? <Loader2 size={17} className="spin" /> : (
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.24-.2-1.8H12v3.4h5.52a4.7 4.7 0 0 1-2.05 3.08v2.2h3.32c1.94-1.79 2.81-4.43 2.81-6.88Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.62-2.42l-3.32-2.2c-.9.6-2.07.97-3.3.97-2.6 0-4.8-1.76-5.59-4.12H2.99v2.27A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.41 14.23A6 6 0 0 1 6.1 12c0-.78.13-1.53.36-2.23V7.5H2.99A10 10 0 0 0 2 12c0 1.61.38 3.14.99 4.5l3.42-2.27Z" />
            <path fill="#EA4335" d="M12 5.65c1.47 0 2.79.5 3.82 1.5l2.87-2.87A9.62 9.62 0 0 0 12 2 10 10 0 0 0 2.99 7.5l3.47 2.27C7.2 7.41 9.4 5.65 12 5.65Z" />
          </svg>
        )}
        Entrar com Google
      </button>
      <p style={{ margin: '18px 0 0', color: '#52525b', fontSize: 10, lineHeight: 1.5, textAlign: 'center' }}>
        Uma conta Google válida não é suficiente: o backend também verifica a lista interna de acesso.
      </p>
    </Shell>
  );
}

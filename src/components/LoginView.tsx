import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../login.css';

type Language = 'pt' | 'en';

const COPY = {
  pt: {
    back: 'Voltar ao site',
    heroStart: 'Encontre empresas.',
    heroAccent: 'Descubra oportunidades.',
    heroEnd: 'Transforme dados em ação.',
    heroBody: 'Do primeiro negócio encontrado à próxima conversa, tudo acontece no mesmo lugar.',
    signInEyebrow: 'Bem-vindo de volta',
    signUpEyebrow: 'Comece com a Scoutly',
    resetEyebrow: 'Recuperação de acesso',
    signInTitle: 'Acesse seu workspace.',
    signUpTitle: 'Crie sua conta.',
    resetTitle: 'Recupere sua senha.',
    signInDescription: 'Entre para continuar de onde sua prospecção parou.',
    signUpDescription: 'Descubra novas oportunidades. Comece gratuitamente.',
    resetDescription: 'Enviaremos um link de redefinição para o seu e-mail.',
    email: 'E-mail',
    emailPlaceholder: 'seu.email@empresa.com',
    password: 'Senha',
    passwordPlaceholder: 'Digite sua senha',
    newPasswordPlaceholder: 'Crie uma senha com 6 caracteres ou mais',
    showPassword: 'Mostrar senha',
    hidePassword: 'Ocultar senha',
    forgot: 'Esqueceu a senha?',
    signIn: 'Entrar',
    signUp: 'Criar conta',
    reset: 'Enviar link de recuperação',
    or: 'ou continue com',
    google: 'Continuar com Google',
    noAccount: 'Ainda não tem uma conta?',
    hasAccount: 'Já tem uma conta?',
    createAccount: 'Comece gratuitamente',
    backToSignIn: 'Voltar para o login',
    resetSuccess: 'Link enviado! Confira sua caixa de entrada e a pasta de spam.',
    resetEmailRequired: 'Informe seu e-mail para redefinir a senha.',
    invalidCredentials: 'E-mail ou senha incorretos.',
    emailInUse: 'Este e-mail já está cadastrado. Faça login para continuar.',
    weakPassword: 'Use uma senha com pelo menos 6 caracteres.',
    invalidEmail: 'Informe um e-mail válido.',
    tooManyRequests: 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    networkError: 'Não foi possível conectar. Confira sua internet e tente novamente.',
    popupClosed: 'O login com Google foi cancelado.',
    generalError: 'Não foi possível concluir a autenticação. Tente novamente.',
  },
  en: {
    back: 'Back to website',
    heroStart: 'Find businesses.',
    heroAccent: 'Discover opportunities.',
    heroEnd: 'Turn insight into action.',
    heroBody: 'From the first business you find to your next conversation, it all happens in one place.',
    signInEyebrow: 'Welcome back',
    signUpEyebrow: 'Get started with Scoutly',
    resetEyebrow: 'Account recovery',
    signInTitle: 'Enter your workspace.',
    signUpTitle: 'Create your account.',
    resetTitle: 'Reset your password.',
    signInDescription: 'Sign in and pick up right where you left off.',
    signUpDescription: 'Find your next opportunity. Get started for free.',
    resetDescription: "We'll send a password reset link to your email.",
    email: 'Email',
    emailPlaceholder: 'you@company.com',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    newPasswordPlaceholder: 'Create a password with 6 or more characters',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    forgot: 'Forgot password?',
    signIn: 'Sign in',
    signUp: 'Create account',
    reset: 'Send reset link',
    or: 'or continue with',
    google: 'Continue with Google',
    noAccount: "Don't have an account?",
    hasAccount: 'Already have an account?',
    createAccount: 'Get started for free',
    backToSignIn: 'Back to sign in',
    resetSuccess: 'Reset link sent! Check your inbox and spam folder.',
    resetEmailRequired: 'Enter your email to reset your password.',
    invalidCredentials: 'Incorrect email or password.',
    emailInUse: 'This email is already registered. Sign in to continue.',
    weakPassword: 'Use a password with at least 6 characters.',
    invalidEmail: 'Enter a valid email address.',
    tooManyRequests: 'Too many attempts. Please wait and try again.',
    networkError: 'Could not connect. Check your internet and try again.',
    popupClosed: 'Google sign-in was canceled.',
    generalError: 'Authentication failed. Please try again.',
  },
};

function getInitialLanguage(): Language {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'pt' || requested === 'en') return requested;
  const saved = window.sessionStorage.getItem('scoutly_language');
  if (saved === 'pt' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" role="img" aria-label="Google">
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.95H1.2v3.15C3.18 21.3 7.24 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.25c-.25-.72-.38-1.49-.38-2.25s.13-1.53.38-2.25V6.6H1.2C.44 8.14 0 9.99 0 12s.44 3.86 1.2 5.4l4.08-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.24 0 3.18 2.7 1.2 6.6l4.08 3.15c.95-2.84 3.6-4.95 6.72-4.95z" />
    </svg>
  );
}

function ScoutlyIdentity({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/scoutly-mark.png" alt="" className={compact ? 'h-8 w-8 object-contain' : 'h-9 w-9 object-contain'} />
      <span className={`font-semibold tracking-[-0.055em] text-white ${compact ? 'text-[21px]' : 'text-[24px]'}`}>
        Scoutly<span className="text-[#ff5a12]">.</span>
      </span>
    </div>
  );
}

export default function LoginView() {
  const { signIn, signInWithGoogle, signUp, resetPassword } = useAuth();
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [isSignUp, setIsSignUp] = useState(() => new URLSearchParams(window.location.search).get('mode') === 'signup');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const t = COPY[language];

  useEffect(() => {
    document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en';
    window.sessionStorage.setItem('scoutly_language', language);
  }, [language]);

  useEffect(() => {
    document.documentElement.classList.add('scoutly-auth-active');
    document.body.classList.add('scoutly-auth-active');
    return () => {
      document.documentElement.classList.remove('scoutly-auth-active');
      document.body.classList.remove('scoutly-auth-active');
    };
  }, []);

  const changeMode = (signUpMode: boolean) => {
    setIsSignUp(signUpMode);
    setIsForgotPassword(false);
    setError(null);
    setSuccessMessage(null);
    setPassword('');
    setShowPassword(false);
    const url = new URL(window.location.href);
    if (signUpMode) url.searchParams.set('mode', 'signup');
    else url.searchParams.delete('mode');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const translateError = (err: any) => {
    const code = String(err?.code || '');
    const message = String(err?.message || '');
    if (/user-not-found|invalid-credential|wrong-password|invalid-login-credentials/.test(code + message)) return t.invalidCredentials;
    if (/email-already-in-use/.test(code + message)) return t.emailInUse;
    if (/weak-password/.test(code + message)) return t.weakPassword;
    if (/invalid-email/.test(code + message)) return t.invalidEmail;
    if (/too-many-requests/.test(code + message)) return t.tooManyRequests;
    if (/network-request-failed/.test(code + message)) return t.networkError;
    if (/popup-closed-by-user|cancelled-popup-request/.test(code + message)) return t.popupClosed;
    return t.generalError;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isForgotPassword) {
        if (!email.trim()) throw new Error(t.resetEmailRequired);
        await resetPassword(email.trim());
        setSuccessMessage(t.resetSuccess);
        setIsForgotPassword(false);
      } else if (isSignUp) {
        await signUp(email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      setError(err?.message === t.resetEmailRequired ? t.resetEmailRequired : translateError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLoading) return;
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(translateError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="scoutly-auth-page h-[100dvh] overflow-hidden text-white lg:p-4 xl:p-5">
      <div className="scoutly-auth-layout mx-auto grid h-full w-full max-w-[1512px] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)] lg:rounded-[27px] lg:border lg:border-white/[0.085]">
        <section className="scoutly-auth-story relative hidden min-h-0 flex-col overflow-hidden px-[clamp(32px,4.4vw,76px)] py-[clamp(24px,3vw,40px)] lg:flex">
          <div className="scoutly-auth-orb scoutly-auth-orb-one" />
          <div className="scoutly-auth-orb scoutly-auth-orb-two" />
          <div className="relative z-10">
            <ScoutlyIdentity />
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-[600px] flex-1 flex-col justify-center py-8">
            <div className="scoutly-auth-accent mb-9 h-[3px] w-11 rounded-full bg-[#ff5a12]" aria-hidden="true" />
            <h2 className="max-w-[600px] text-[clamp(38px,3.8vw,64px)] font-semibold leading-[1.105] tracking-[-0.06em] text-white">
              {t.heroStart}<br />
              <span className="scoutly-auth-gradient-text">{t.heroAccent}</span><br />
              {t.heroEnd}
            </h2>
            <p className="mt-7 max-w-[455px] text-[clamp(12px,1.03vw,15px)] leading-[1.9] text-[#a9acb4]">
              {t.heroBody}
            </p>
          </div>
        </section>

        <section className="scoutly-auth-form-section relative flex h-full min-h-0 flex-col overflow-y-auto border-l border-white/[0.055] bg-[#0d0f13] px-5 pb-5 pt-5 sm:px-8 lg:px-[clamp(32px,4.2vw,80px)] lg:pb-6 lg:pt-6">
          <div className="absolute right-[-130px] top-[-190px] h-[350px] w-[350px] rounded-full bg-[#ff5a12]/[0.035] blur-[110px]" aria-hidden="true" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="lg:hidden"><ScoutlyIdentity compact /></div>
            <a href="/" className="scoutly-auth-back hidden items-center gap-2 text-[11px] font-medium text-[#a9abb3] transition hover:text-white lg:inline-flex">
              <ArrowLeft className="h-3.5 w-3.5" />
              {t.back}
            </a>
            <div className="flex items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.035] p-1" aria-label="Language">
              <button type="button" onClick={() => setLanguage('pt')} aria-pressed={language === 'pt'} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${language === 'pt' ? 'bg-white/[0.12] text-white' : 'text-[#7e838d] hover:text-white'}`}>PT</button>
              <button type="button" onClick={() => setLanguage('en')} aria-pressed={language === 'en'} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition ${language === 'en' ? 'bg-white/[0.12] text-white' : 'text-[#7e838d] hover:text-white'}`}>EN</button>
            </div>
          </div>

          <div className="scoutly-auth-form-content relative z-10 mx-auto flex w-full max-w-[430px] flex-1 flex-col justify-center py-5 lg:py-3">
            <div className="mb-6">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff8145]">
                {isForgotPassword ? t.resetEyebrow : isSignUp ? t.signUpEyebrow : t.signInEyebrow}
              </p>
              <h1 className="text-[clamp(31px,2.7vw,41px)] font-semibold leading-[1.15] tracking-[-0.052em] text-white">
                {isForgotPassword ? t.resetTitle : isSignUp ? t.signUpTitle : t.signInTitle}
              </h1>
              <p className="mt-3 max-w-[370px] text-[13px] leading-[1.8] text-[#a2a5ae]">
                {isForgotPassword ? t.resetDescription : isSignUp ? t.signUpDescription : t.signInDescription}
              </p>
            </div>

            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-400/25 bg-red-500/[0.09] px-3.5 py-3 text-[12px] leading-relaxed text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}
            {successMessage && (
              <div role="status" className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-3.5 py-3 text-[12px] leading-relaxed text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="scoutly-auth-email" className="mb-2 block text-[11px] font-semibold text-[#d9dbe0]">{t.email}</label>
                <div className="scoutly-auth-field relative flex items-center">
                  <Mail className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-[#8b909b]" />
                  <input
                    id="scoutly-auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t.emailPlaceholder}
                    className="h-[51px] w-full rounded-[13px] border border-white/[0.12] bg-[#15181e] pl-[45px] pr-4 text-[13px] text-white outline-none transition placeholder:text-[#777e89] focus:border-[#ff6b2c]/65 focus:bg-[#191b21] focus:ring-[3px] focus:ring-[#ff5a12]/[0.12]"
                  />
                </div>
              </div>

              {!isForgotPassword && (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="scoutly-auth-password" className="block text-[11px] font-semibold text-[#d9dbe0]">{t.password}</label>
                    {!isSignUp && (
                      <button type="button" onClick={() => { setIsForgotPassword(true); setError(null); setSuccessMessage(null); }} className="text-[11px] font-medium text-[#ff925b] transition hover:text-[#ffb18a]">
                        {t.forgot}
                      </button>
                    )}
                  </div>
                  <div className="scoutly-auth-field relative flex items-center">
                    <LockKeyhole className="pointer-events-none absolute left-4 h-[17px] w-[17px] text-[#8b909b]" />
                    <input
                      id="scoutly-auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      minLength={isSignUp ? 6 : undefined}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={isSignUp ? t.newPasswordPlaceholder : t.passwordPlaceholder}
                      className="h-[51px] w-full rounded-[13px] border border-white/[0.12] bg-[#15181e] pl-[45px] pr-12 text-[13px] text-white outline-none transition placeholder:text-[#777e89] focus:border-[#ff6b2c]/65 focus:bg-[#191b21] focus:ring-[3px] focus:ring-[#ff5a12]/[0.12]"
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t.hidePassword : t.showPassword} title={showPassword ? t.hidePassword : t.showPassword} className="absolute right-2.5 flex h-8 w-8 items-center justify-center rounded-lg text-[#989da8] transition hover:bg-white/[0.06] hover:text-white">
                      {showPassword ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={isLoading} className="scoutly-auth-submit group mt-1 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[13px] bg-[#ff5a12] px-4 text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(255,90,18,0.17)] transition hover:bg-[#ff6c2b] hover:shadow-[0_16px_34px_rgba(255,90,18,0.25)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
                {isLoading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/45 border-t-white" aria-label="Loading" />
                ) : (
                  <>
                    {isForgotPassword ? t.reset : isSignUp ? t.signUp : t.signIn}
                    <ArrowRight className="h-[17px] w-[17px] transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {!isForgotPassword && (
              <>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/[0.1]" />
                  <span className="shrink-0 text-[10px] text-[#90949e]">{t.or}</span>
                  <span className="h-px flex-1 bg-white/[0.1]" />
                </div>
                <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-[13px] border border-white/[0.15] bg-white/[0.045] px-4 text-[13px] font-semibold text-[#edf0f4] transition hover:border-white/[0.3] hover:bg-white/[0.085] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60">
                  <GoogleIcon />
                  {t.google}
                </button>
              </>
            )}

            <div className="mt-6 text-center text-[12px] text-[#a2a5ae]">
              {isForgotPassword ? (
                <button type="button" onClick={() => { setIsForgotPassword(false); setError(null); setSuccessMessage(null); }} className="inline-flex items-center gap-1.5 font-semibold text-[#ff985e] transition hover:text-[#ffc09b]">
                  <ArrowLeft className="h-3.5 w-3.5" />{t.backToSignIn}
                </button>
              ) : (
                <>
                  {isSignUp ? t.hasAccount : t.noAccount}{' '}
                  <button type="button" onClick={() => changeMode(!isSignUp)} className="font-semibold text-[#ff985e] transition hover:text-[#ffc09b]">
                    {isSignUp ? t.signIn : t.createAccount}
                  </button>
                </>
              )}
            </div>


          </div>

          <div className="relative z-10 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-3 lg:pt-4">
            <a href="/" className="inline-flex items-center gap-1.5 text-[10px] text-[#9096a0] transition hover:text-white lg:hidden">
              <ArrowLeft className="h-3 w-3" />{t.back}
            </a>
            <p className="ml-auto text-[10px] text-[#747984]">© {new Date().getFullYear()} Scoutly</p>
          </div>
        </section>
      </div>
    </main>
  );
}

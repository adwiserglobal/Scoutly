import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Mail, Lock, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';

export default function LoginView() {
  const { signIn, signInWithGoogle, signUp, resetPassword } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (isForgotPassword) {
        if (!email) {
          throw new Error('Por favor, informe seu email para redefinir a senha.');
        }
        await resetPassword(email);
        setSuccessMessage('Email de recuperação enviado com sucesso! Verifique sua caixa de entrada.');
        setIsForgotPassword(false);
      } else if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      console.error('[Auth Error]:', err);
      let msg = err.message || 'Ocorreu um erro na autenticação.';
      if (msg.includes('user-not-found') || msg.includes('invalid-credential') || msg.includes('wrong-password')) {
        msg = 'Email ou senha incorretos.';
      } else if (msg.includes('email-already-in-use')) {
        msg = 'Este email já está cadastrado.';
      } else if (msg.includes('weak-password')) {
        msg = 'A senha deve ter pelo menos 6 caracteres.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('[Google Auth Error]:', err);
      setError(err.message || 'Erro ao autenticar com o Google.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-[#EDE8E0] overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px]">
        
        {/* Left Side: Graphite Gray background with reference image slightly smaller */}
        <div className="lg:col-span-6 bg-[#1A1A1A] p-8 flex items-center justify-center relative overflow-hidden">
          <img
            src="/login_side_image.png"
            alt="Login Illustration"
            className="w-full max-w-md h-auto object-contain rounded-2xl shadow-2xl"
            onError={(e) => {
              // fallback if image not found
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Right Side: Form Card */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md w-full mx-auto">
            
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-6">
                <img
                  src="/logo.png"
                  alt="Scoutly Logo"
                  className="w-16 h-16 object-contain rounded-2xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2">
                {isForgotPassword
                  ? 'Recuperar Senha'
                  : isSignUp
                  ? 'Criar Conta'
                  : 'Login your account'}
              </h1>
              <p className="text-sm text-stone-500">
                {isForgotPassword
                  ? 'Informe seu email cadastrado para receber o link de redefinição.'
                  : isSignUp
                  ? 'Preencha os dados abaixo para registrar sua conta.'
                  : 'Digite suas credenciais para acessar o painel.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-700 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-800 text-sm">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@empresa.com"
                    className="w-full pl-10 pr-4 py-3 bg-[#FAF7F2] border border-[#EDE8E0] rounded-2xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/30 focus:border-[#FF4D00] transition"
                  />
                </div>
              </div>

              {!isForgotPassword && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-3 bg-[#FAF7F2] border border-[#EDE8E0] rounded-2xl text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#FF4D00]/30 focus:border-[#FF4D00] transition"
                    />
                  </div>
                </div>
              )}

              {!isSignUp && !isForgotPassword && (
                <div className="flex items-center justify-end text-xs">
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-[#FF4D00] hover:underline font-medium cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-[#FF4D00] hover:bg-[#E04300] text-white font-semibold rounded-2xl shadow-lg shadow-[#FF4D00]/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isForgotPassword ? 'Enviar Email de Recuperação' : isSignUp ? 'Criar Conta' : 'Login'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {!isForgotPassword && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-3 text-stone-400 font-medium">Ou continue com</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-white hover:bg-stone-50 text-stone-700 font-semibold border border-stone-300 rounded-2xl shadow-sm transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.95H1.2v3.15C3.18 21.3 7.24 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.25c-.25-.72-.38-1.49-.38-2.25s.13-1.53.38-2.25V6.6H1.2C.44 8.14 0 9.99 0 12s.44 3.86 1.2 5.4l4.08-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.24 0 3.18 2.7 1.2 6.6l4.08 3.15c.95-2.84 3.6-4.95 6.72-4.95z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              </>
            )}

            <div className="mt-8 text-center text-sm text-stone-500">
              {isForgotPassword ? (
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-[#FF4D00] font-semibold hover:underline cursor-pointer"
                >
                  Voltar para o login
                </button>
              ) : isSignUp ? (
                <span>
                  Já tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(false)}
                    className="text-[#FF4D00] font-semibold hover:underline cursor-pointer"
                  >
                    Faça login
                  </button>
                </span>
              ) : (
                <span>
                  Não tem uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsSignUp(true)}
                    className="text-[#FF4D00] font-semibold hover:underline cursor-pointer"
                  >
                    Create Account
                  </button>
                </span>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

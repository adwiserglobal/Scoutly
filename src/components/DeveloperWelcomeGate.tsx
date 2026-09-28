import { useEffect, useState } from 'react';
import { Check, Code2, Infinity as InfinityIcon, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAccessStatus } from '../services/api';

const WELCOME_VERSION = 'v1';

export default function DeveloperWelcomeGate() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }

    let cancelled = false;

    const check = async () => {
      try {
        const access = await fetchAccessStatus();
        if (cancelled || !(access as any)?.isDeveloper) return;

        const key = `scoutly_developer_welcome_${WELCOME_VERSION}:${user.uid}`;
        if (window.localStorage.getItem(key) === 'seen') return;
        setOpen(true);
      } catch (error) {
        console.warn('[Scoutly Developers] Could not resolve developer welcome:', error);
      }
    };

    void check();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  if (!user || !open) return null;

  const close = () => {
    window.localStorage.setItem(
      `scoutly_developer_welcome_${WELCOME_VERSION}:${user.uid}`,
      'seen',
    );
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-[8px]">
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/[0.10] bg-[#0d1013] text-white shadow-[0_36px_120px_rgba(0,0,0,0.62)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#FF5A12]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-[#FF7A2F]/10 blur-3xl" />

        <button
          type="button"
          onClick={close}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-stone-400 transition hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative px-7 pb-7 pt-8 sm:px-9 sm:pb-9 sm:pt-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF5A12]/30 bg-[#FF5A12]/[0.10] text-[#FF6A26] shadow-[0_10px_30px_rgba(255,90,18,0.18)]">
            <Code2 className="h-5 w-5" />
          </div>

          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#FF6A26]">
            Scoutly Developers
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[28px]">
            Sua conta agora tem acesso ilimitado.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-stone-400">
            Você recebeu acesso de desenvolvedor à Scoutly, com créditos ilimitados e todos os recursos da plataforma liberados para testes e desenvolvimento.
          </p>

          <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
              <InfinityIcon className="h-4 w-4 text-[#FF6A26]" />
              <p className="mt-2 text-[11px] font-semibold text-stone-100">Créditos ilimitados</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
              <Sparkles className="h-4 w-4 text-[#FF6A26]" />
              <p className="mt-2 text-[11px] font-semibold text-stone-100">IA e recomendações</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5">
              <Check className="h-4 w-4 text-[#FF6A26]" />
              <p className="mt-2 text-[11px] font-semibold text-stone-100">Todos os recursos</p>
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-7 flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff7a2f] via-[#ff5a12] to-[#ff3d00] text-sm font-semibold text-white shadow-[0_14px_34px_rgba(255,90,18,0.28)] transition hover:brightness-110 active:scale-[0.99]"
          >
            Continuar na Scoutly
          </button>
        </div>
      </div>
    </div>
  );
}

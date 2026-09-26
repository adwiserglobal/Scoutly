import { useState } from 'react';
import { ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';

export default function TrialActivationScreen({
  userName,
  onStart,
}: {
  userName?: string | null;
  onStart: () => Promise<void>;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const firstName = String(userName || '').trim().split(/\s+/)[0] || '';

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError('');
    try {
      await onStart();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar seu período de teste. Tente novamente.');
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[168] flex items-center justify-center bg-[#07090c]/96 px-4 py-6 backdrop-blur-xl">
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[32px] border border-white/[0.09] bg-[#0d1014] shadow-[0_36px_120px_rgba(0,0,0,0.64)]">
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#FF5A12]/10 blur-3xl" />
        <div className="relative px-6 py-7 sm:px-10 sm:py-10">
          <img src="/logo_white.png" alt="Scoutly" className="mb-9 h-9 w-auto object-contain" />

          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF5A12]/10 text-[#FF6A26] ring-1 ring-[#FF5A12]/20">
            <Sparkles className="h-6 w-6" />
          </div>

          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#FF7A3D]">
            Seu acesso está pronto
          </p>
          <h1 className="max-w-2xl text-3xl font-semibold leading-[1.06] tracking-[-0.045em] text-white sm:text-[43px]">
            {firstName ? `${firstName}, você ganhou 7 dias de Scoutly Pro.` : 'Você ganhou 7 dias de Scoutly Pro.'}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-[15px]">
            Explore os recursos Pro sem compromisso durante 7 dias. O período só começa quando você clicar no botão abaixo. Ao final, você poderá escolher o plano mais adequado para continuar usando a Scoutly.
          </p>

          <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
            {[
              'Busca e filtros avançados',
              'Scoutly AI para prospecção',
              'Pipeline e favoritos',
              'Análises e sinais digitais',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3 text-xs text-stone-300">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                  <Check className="h-3 w-3" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-xs leading-relaxed text-rose-300">
              {error}
            </div>
          )}

          <div className="mt-8 border-t border-white/[0.07] pt-6">
            <button
              type="button"
              onClick={() => void start()}
              disabled={starting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF5A12] px-5 text-sm font-semibold text-white transition hover:bg-[#ff6b2b] disabled:cursor-wait disabled:opacity-70"
            >
              {starting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Iniciando período de teste...
                </>
              ) : (
                <>
                  Iniciar período de teste <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-stone-600">
              Nenhuma cobrança é feita ao iniciar o teste. Após 7 dias, será necessário escolher um plano para continuar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

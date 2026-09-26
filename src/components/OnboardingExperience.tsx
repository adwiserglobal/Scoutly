import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Compass,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

export const SCOUTLY_ONBOARDING_VERSION = 1;

export interface OnboardingAnswers {
  role: string;
  teamSize: string;
  goal: string;
  goalOther?: string;
}

interface OnboardingExperienceProps {
  mode: 'wizard' | 'tutorial';
  userName?: string | null;
  onSubmit: (answers: OnboardingAnswers) => Promise<void>;
  onFinishTutorial: () => Promise<void>;
}

const ROLE_OPTIONS = [
  'Startup',
  'Founder/Co-founder',
  'Estudante',
  'Autônomo',
  'Agência/Empresa',
];

const TEAM_OPTIONS = ['Somente eu', '1-5', '5-10', '10-50', '50-100', '+100 pessoas'];

const GOAL_OPTIONS = [
  'Encontrar leads e empresas para o meu negócio',
  'Vender sites/aplicativos para empresas que não possuem',
  'Vender serviços/produtos',
  'Procurar por empresas que estejam contratando',
  'Outro',
];

const TOUR_STEPS = [
  {
    selector: '[data-scoutly-tour="search"]',
    eyebrow: 'Busca inteligente',
    title: 'Comece por qualquer nicho ou região',
    body: 'Busque por tipo de empresa, bairro ou cidade. Você também pode combinar os dois, como “despachantes em São Paulo”.',
  },
  {
    selector: '[data-scoutly-tour="filters"]',
    eyebrow: 'Filtros',
    title: 'Transforme resultados em oportunidades',
    body: 'Refine a lista para encontrar empresas sem site, com contato, WhatsApp ou outros sinais comerciais.',
  },
  {
    selector: '[data-scoutly-tour="businesses"]',
    eyebrow: 'Empresas',
    title: 'Abra a lista completa quando quiser',
    body: 'Veja os resultados em lista, compare empresas e abra os detalhes sem perder o contexto do mapa.',
  },
  {
    selector: '[data-scoutly-tour="ai"]',
    eyebrow: 'Scoutly AI',
    title: 'Peça a busca do seu jeito',
    body: 'Use linguagem natural para pedir quantidade, região e critérios. A IA aplica os filtros sobre empresas reais e mostra os cards abaixo da resposta.',
  },
  {
    selector: '[data-scoutly-tour="pipeline"]',
    eyebrow: 'Pipeline',
    title: 'Leve os melhores leads para o seu fluxo comercial',
    body: 'Adicione oportunidades ao pipeline e acompanhe quem foi contatado, está em negociação, fechou ou foi perdido.',
  },
];

function OptionButton({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${
        selected
          ? 'border-[#FF5A12]/55 bg-[#FF5A12]/10 text-white shadow-[0_0_0_1px_rgba(255,90,18,0.08)]'
          : 'border-white/[0.08] bg-white/[0.025] text-stone-300 hover:border-white/[0.16] hover:bg-white/[0.045]'
      }`}
    >
      <span className="font-medium">{children}</span>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full border transition ${selected ? 'border-[#FF5A12] bg-[#FF5A12] text-white' : 'border-white/10 text-transparent'}`}>
        <Check className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

function Wizard({ userName, onSubmit }: { userName?: string | null; onSubmit: (answers: OnboardingAnswers) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [role, setRole] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [goal, setGoal] = useState('');
  const [goalOther, setGoalOther] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const firstName = String(userName || '').trim().split(/\s+/)[0] || '';
  const progress = ((step + 1) / 4) * 100;
  const canContinue = step === 0 || (step === 1 && role) || (step === 2 && teamSize) || (step === 3 && goal && (goal !== 'Outro' || goalOther.trim()));

  const next = async () => {
    if (!canContinue || submitting) return;
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onSubmit({
        role,
        teamSize,
        goal,
        goalOther: goal === 'Outro' ? goalOther.trim() : '',
      });
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar suas respostas. Tente novamente.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#07090c]/95 px-4 py-6 backdrop-blur-xl">
      <div className="relative w-full max-w-[720px] overflow-hidden rounded-[32px] border border-white/[0.09] bg-[#0d1014] shadow-[0_36px_120px_rgba(0,0,0,0.62)]">
        <div className="h-1 w-full bg-white/[0.06]">
          <div className="h-full bg-[#FF5A12] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="px-6 pb-6 pt-6 sm:px-9 sm:pb-9 sm:pt-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <img src="/logo_white.png" alt="Scoutly" className="h-9 w-auto object-contain" />
            <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500">
              {step + 1} de 4
            </span>
          </div>

          {step === 0 && (
            <div className="py-5 sm:py-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF5A12]/10 text-[#FF6A26] ring-1 ring-[#FF5A12]/20">
                <Sparkles className="h-6 w-6" />
              </div>
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FF7A3D]">Bem-vindo à Scoutly</p>
              <h1 className="max-w-xl text-3xl font-semibold leading-[1.08] tracking-[-0.045em] text-white sm:text-[42px]">
                {firstName ? `${firstName}, vamos configurar sua experiência.` : 'Vamos configurar sua experiência.'}
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-stone-500 sm:text-[15px]">
                São três perguntas rápidas para entendermos como você pretende usar a Scoutly. Depois disso, mostramos os principais recursos em menos de um minuto.
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="mb-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FF7A3D]">Sobre você</p>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Com qual destas opções você mais se identifica?</h2>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {ROLE_OPTIONS.map((option) => <OptionButton key={option} selected={role === option} onClick={() => setRole(option)}>{option}</OptionButton>)}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="mb-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FF7A3D]">Sua operação</p>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">Qual o tamanho da sua equipe?</h2>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {TEAM_OPTIONS.map((option) => <OptionButton key={option} selected={teamSize === option} onClick={() => setTeamSize(option)}>{option}</OptionButton>)}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="mb-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#FF7A3D]">Seu objetivo</p>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-white sm:text-3xl">O que você espera do Scoutly?</h2>
              </div>
              <div className="space-y-2.5">
                {GOAL_OPTIONS.map((option) => <OptionButton key={option} selected={goal === option} onClick={() => setGoal(option)}>{option}</OptionButton>)}
                {goal === 'Outro' && (
                  <textarea
                    value={goalOther}
                    onChange={(event) => setGoalOther(event.target.value)}
                    placeholder="Conte rapidamente o que você pretende fazer com a Scoutly"
                    className="min-h-[92px] w-full resize-none rounded-2xl border border-white/[0.09] bg-[#090c10] px-4 py-3 text-sm text-white outline-none placeholder:text-stone-700 focus:border-[#FF5A12]/45"
                  />
                )}
              </div>
            </div>
          )}

          {error && <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-xs text-rose-300">{error}</div>}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((current) => current - 1)} className="flex h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-stone-500 transition hover:bg-white/[0.04] hover:text-white">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={() => void next()}
              disabled={!canContinue || submitting}
              className="flex h-11 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-[#FF5A12] px-5 text-xs font-semibold text-white transition hover:bg-[#ff6b2b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? 'Salvando...' : step === 3 ? 'Enviar' : 'Próximo'}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductTour({ onFinish }: { onFinish: () => Promise<void> }) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [finishing, setFinishing] = useState(false);
  const step = TOUR_STEPS[index];

  useEffect(() => {
    const update = () => {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(step.selector));
      const target = elements.find((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      });
      if (!target) {
        setRect(null);
        return;
      }
      const box = target.getBoundingClientRect();
      setRect(box);
    };

    const timer = window.setTimeout(update, 80);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.selector]);

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await onFinish();
    } finally {
      setFinishing(false);
    }
  };

  const cardPosition = useMemo(() => {
    if (!rect) return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' } as React.CSSProperties;
    const width = Math.min(390, window.innerWidth - 32);
    const roomBelow = window.innerHeight - rect.bottom;
    const top = roomBelow > 250 ? Math.min(window.innerHeight - 220, rect.bottom + 18) : Math.max(18, rect.top - 210);
    const left = Math.min(window.innerWidth - width - 16, Math.max(16, rect.left + rect.width / 2 - width / 2));
    return { width, top, left } as React.CSSProperties;
  }, [rect]);

  return (
    <div className="fixed inset-0 z-[170] pointer-events-none">
      {rect ? (
        <div
          className="fixed rounded-[20px] border-2 border-[#FF6A26] shadow-[0_0_0_9999px_rgba(2,4,7,0.78),0_0_34px_rgba(255,90,18,0.38)] transition-all duration-300"
          style={{ left: rect.left - 8, top: rect.top - 8, width: rect.width + 16, height: rect.height + 16 }}
        />
      ) : <div className="fixed inset-0 bg-black/75" />}

      <div className="fixed pointer-events-auto rounded-[24px] border border-white/[0.10] bg-[#0e1115] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]" style={cardPosition}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#FF7A3D]">{step.eyebrow}</p>
            <h3 className="text-lg font-semibold tracking-[-0.025em] text-white">{step.title}</h3>
          </div>
          <button type="button" onClick={() => void finish()} className="rounded-lg p-1.5 text-stone-600 transition hover:bg-white/[0.05] hover:text-white" aria-label="Pular tutorial">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs leading-relaxed text-stone-400">{step.body}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-1.5">
            {TOUR_STEPS.map((_, dotIndex) => <span key={dotIndex} className={`h-1.5 rounded-full transition-all ${dotIndex === index ? 'w-5 bg-[#FF5A12]' : 'w-1.5 bg-white/10'}`} />)}
          </div>
          <div className="flex items-center gap-2">
            {index > 0 && <button type="button" onClick={() => setIndex((current) => current - 1)} className="h-9 rounded-xl px-3 text-[10px] font-semibold text-stone-500 hover:bg-white/[0.04] hover:text-white">Voltar</button>}
            {index < TOUR_STEPS.length - 1 ? (
              <button type="button" onClick={() => setIndex((current) => current + 1)} className="flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[10px] font-semibold text-[#090c10]">
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button type="button" onClick={() => void finish()} disabled={finishing} className="flex h-9 items-center gap-1.5 rounded-xl bg-[#FF5A12] px-3.5 text-[10px] font-semibold text-white disabled:opacity-50">
                {finishing ? 'Finalizando...' : 'Começar a usar'} <Compass className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OnboardingExperience({ mode, userName, onSubmit, onFinishTutorial }: OnboardingExperienceProps) {
  if (mode === 'wizard') return <Wizard userName={userName} onSubmit={onSubmit} />;
  return <ProductTour onFinish={onFinishTutorial} />;
}

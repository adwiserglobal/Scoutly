import { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import {
  EMPTY_OUTREACH,
  OUTREACH_LIMITS,
  type OutreachObjective,
  type OutreachProfile,
  type OutreachTone,
} from '../../lib/userProfile';

interface OutreachProfileSectionProps {
  profile: OutreachProfile | null;
  isLoading: boolean;
  loadError: string | null;
  defaultSenderName: string;
  onSave: (profile: OutreachProfile) => Promise<unknown>;
}

const OBJECTIVES: Array<{ id: OutreachObjective; title: string; hint: string }> = [
  { id: 'services', title: 'Vender meus serviços', hint: 'Freelancer, agência ou empresa' },
  { id: 'job', title: 'Conseguir uma oportunidade', hint: 'Vaga, estágio ou projeto' },
  { id: 'partnership', title: 'Propor parceria', hint: 'Indicações e acordos' },
  { id: 'other', title: 'Outro objetivo', hint: 'Você descreve abaixo' },
];

const TONES: Array<{ id: OutreachTone; label: string }> = [
  { id: 'consultivo', label: 'Consultivo' },
  { id: 'direto', label: 'Direto' },
  { id: 'amigavel', label: 'Amigável' },
  { id: 'formal', label: 'Formal' },
];

const OFFER_PLACEHOLDER: Record<OutreachObjective, string> = {
  services:
    'Ex.: Crio sites e landing pages rápidos para pequenos negócios locais, com botão de WhatsApp e foco em aparecer no Google.',
  job: 'Ex.: Sou desenvolvedor front-end com 4 anos de experiência em React e busco uma vaga remota em empresas de tecnologia.',
  partnership: 'Ex.: Sou gestor de tráfego e busco agências de sites para trocar indicações de clientes.',
  other: 'Descreva o que você quer comunicar e o que a pessoa deve entender sobre você.',
};

const CTA_PLACEHOLDER: Record<OutreachObjective, string> = {
  services: 'Ex.: Agendar uma conversa de 15 minutos',
  job: 'Ex.: Enviar meu currículo e marcar uma conversa',
  partnership: 'Ex.: Marcar uma call para alinhar a parceria',
  other: 'Ex.: Responder esta mensagem',
};

const fieldClass =
  'w-full rounded-xl border border-white/[0.08] bg-[#0b0e12] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-stone-700 focus:border-[#FF5A12]/60';
const labelClass = 'mb-1.5 flex items-center justify-between text-[11px] font-medium text-stone-500';

export default function OutreachProfileSection({
  profile,
  isLoading,
  loadError,
  defaultSenderName,
  onSave,
}: OutreachProfileSectionProps) {
  const [form, setForm] = useState<OutreachProfile>(EMPTY_OUTREACH);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(profile || EMPTY_OUTREACH),
    [form, profile]
  );

  const set = <K extends keyof OutreachProfile>(key: K, value: OutreachProfile[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await onSave(form);
      setMessage({ text: 'Abordagem salva. As próximas mensagens já usam estas informações.', ok: true });
    } catch (error: any) {
      setMessage({ text: error?.message || 'Não foi possível salvar.', ok: false });
    } finally {
      setIsSaving(false);
    }
  };

  const disabled = isLoading || Boolean(loadError);

  return (
    <section className="rounded-[22px] border border-white/[0.08] bg-[#111418] p-5 shadow-[0_14px_40px_rgba(0,0,0,0.16)] md:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FF5A12]/[0.12]">
          <Sparkles className="h-4 w-4 text-[#FF6A26]" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">Minha abordagem comercial</h2>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            Conte à IA quem você é e o que oferece. As mensagens de WhatsApp e e-mail passam a falar pelo seu negócio,
            sem textos genéricos.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-3 text-[11px] leading-relaxed text-amber-300">
          {loadError}
        </div>
      )}

      <div className={disabled ? 'pointer-events-none opacity-50' : ''}>
        <span className="mb-2 block text-[11px] font-medium text-stone-500">O que você busca com a abordagem?</span>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {OBJECTIVES.map((option) => {
            const active = form.objective === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => set('objective', option.id)}
                aria-pressed={active}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? 'border-[#FF5A12]/60 bg-[#FF5A12]/[0.1]'
                    : 'border-white/[0.08] bg-[#0b0e12] hover:border-white/[0.18]'
                }`}
              >
                <span className={`block text-[12px] font-semibold ${active ? 'text-white' : 'text-stone-300'}`}>
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[10px] text-stone-500">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Seu nome (assinatura)</label>
            <input
              className={fieldClass}
              value={form.senderName}
              maxLength={OUTREACH_LIMITS.senderName}
              placeholder={defaultSenderName || 'Como você assina as mensagens'}
              onChange={(event) => set('senderName', event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Empresa ou marca (opcional)</label>
            <input
              className={fieldClass}
              value={form.companyName}
              maxLength={OUTREACH_LIMITS.companyName}
              placeholder="Ex.: Studio Pixel"
              onChange={(event) => set('companyName', event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelClass}>
            <span>O que você faz / oferece</span>
            <span className="text-stone-600">
              {form.offer.length}/{OUTREACH_LIMITS.offer}
            </span>
          </label>
          <textarea
            className={`${fieldClass} min-h-[96px] resize-y leading-relaxed`}
            value={form.offer}
            maxLength={OUTREACH_LIMITS.offer}
            placeholder={OFFER_PLACEHOLDER[form.objective]}
            onChange={(event) => set('offer', event.target.value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>
              {form.objective === 'job' ? 'Tipo de empresa que procura' : 'Cliente ideal'} (opcional)
            </label>
            <textarea
              className={`${fieldClass} min-h-[72px] resize-y leading-relaxed`}
              value={form.audience}
              maxLength={OUTREACH_LIMITS.audience}
              placeholder={
                form.objective === 'job'
                  ? 'Ex.: Startups e agências de médio porte'
                  : 'Ex.: Clínicas e restaurantes que ainda não têm site'
              }
              onChange={(event) => set('audience', event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Diferenciais e provas (opcional)</label>
            <textarea
              className={`${fieldClass} min-h-[72px] resize-y leading-relaxed`}
              value={form.differentials}
              maxLength={OUTREACH_LIMITS.differentials}
              placeholder="Ex.: Entrega em 7 dias, +40 sites publicados, atendimento direto pelo WhatsApp"
              onChange={(event) => set('differentials', event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Ação desejada ao final</label>
            <input
              className={fieldClass}
              value={form.cta}
              maxLength={OUTREACH_LIMITS.cta}
              placeholder={CTA_PLACEHOLDER[form.objective]}
              onChange={(event) => set('cta', event.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>O que evitar (opcional)</label>
            <input
              className={fieldClass}
              value={form.avoid}
              maxLength={OUTREACH_LIMITS.avoid}
              placeholder="Ex.: Não citar preços, não usar emojis"
              onChange={(event) => set('avoid', event.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <span className="mb-2 block text-[11px] font-medium text-stone-500">Tom de voz</span>
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => {
              const active = form.tone === tone.id;
              return (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => set('tone', tone.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition ${
                    active
                      ? 'border-[#FF5A12]/60 bg-[#FF5A12]/[0.12] text-[#ffad83]'
                      : 'border-white/[0.08] bg-[#0b0e12] text-stone-400 hover:text-white'
                  }`}
                >
                  {tone.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`flex min-h-[16px] items-center gap-1.5 text-[11px] ${
            message ? (message.ok ? 'text-emerald-400' : 'text-rose-400') : 'text-stone-600'
          }`}
        >
          {message?.ok && <Check className="h-3.5 w-3.5" />}
          {message?.text || 'A IA usa apenas o que você descrever aqui e nunca inventa serviços.'}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isSaving || !isDirty}
          className="rounded-xl bg-[#FF5A12] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ff6a27] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar abordagem'}
        </button>
      </div>
    </section>
  );
}

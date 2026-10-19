import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Palette, Trash2 } from 'lucide-react';
import {
  COLOR_PRESETS,
  DEFAULT_ACCENT,
  DEFAULT_COVER,
  EMPTY_BRAND,
  isAccentReadable,
  isCoverReadable,
  isHexColor,
  prepareLogo,
  type BrandProfile,
  type UserProfile,
} from '../../lib/userProfile';

interface BrandSectionProps {
  profile: UserProfile | null;
  isLoading: boolean;
  loadError: string | null;
  defaultName: string;
  onSave: (input: { brand: BrandProfile; logo?: string | null }) => Promise<unknown>;
}

const fieldClass =
  'w-full rounded-xl border border-white/[0.08] bg-[#0b0e12] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-stone-700 focus:border-[#FF5A12]/60';
const labelClass = 'mb-1.5 block text-[11px] font-medium text-stone-500';

function ColorField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isHexColor(value) ? value : '#000000'}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-white/[0.08] bg-[#0b0e12] p-1"
          aria-label={label}
        />
        <input
          className={`${fieldClass} font-mono uppercase`}
          value={value}
          maxLength={7}
          onChange={(event) => onChange(event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`)}
        />
      </div>
      {error && <p className="mt-1.5 text-[10px] text-rose-400">{error}</p>}
    </div>
  );
}

/** Miniature of the report cover so changes are visible before saving. */
function CoverPreview({ brand, logo, fallbackName }: { brand: BrandProfile; logo: string | null; fallbackName: string }) {
  const cover = isCoverReadable(brand.coverColor) ? brand.coverColor : DEFAULT_COVER;
  const accent = isAccentReadable(brand.accentColor) ? brand.accentColor : DEFAULT_ACCENT;
  const name = brand.name || fallbackName || 'Sua marca';
  const arc = 'M 12 58 A 46 46 0 0 1 104 58';

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.1] shadow-[0_18px_50px_rgba(0,0,0,0.35)]" aria-label="Prévia da capa do relatório">
      <div className="relative px-5 pb-5 pt-4" style={{ background: cover }}>
        <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: accent }} />
        <div className="flex h-9 items-center">
          {logo ? (
            <span className="flex h-9 items-center rounded-lg bg-white px-2.5">
              <img src={logo} alt="Logo" className="max-h-6 max-w-[120px] object-contain" />
            </span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">{name}</span>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <span className="block text-[8px] font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>
              Relatório de presença digital
            </span>
            <span className="mt-1.5 block text-[22px] font-bold leading-[1.1] tracking-[-0.02em] text-white">
              Padaria Pão Quente
            </span>
            <span className="mt-1 block text-[10px] text-white/55">Padaria | São Paulo - SP</span>
            <span className="mt-2.5 block h-[2px] w-8" style={{ background: accent }} />
            {brand.tagline && <span className="mt-2 block text-[10px] italic text-white/70">{brand.tagline}</span>}
          </div>
          <svg viewBox="0 0 116 70" className="h-[74px] w-[120px] shrink-0" aria-hidden="true">
            <path d={arc} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="9" strokeLinecap="round" />
            <path d={arc} fill="none" stroke={accent} strokeWidth="9" strokeLinecap="round" strokeDasharray="144.5" strokeDashoffset="38" />
            <text x="58" y="52" textAnchor="middle" fontSize="26" fontWeight="700" fill="#fff">
              73
            </text>
          </svg>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 bg-white px-5 py-3">
        <div className="min-w-0">
          <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-400">Preparado por</span>
          <span className="block truncate text-[12px] font-bold text-stone-900">{name}</span>
        </div>
        <span className="rounded-full px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white" style={{ background: accent }}>
          Impacto alto
        </span>
      </div>
    </div>
  );
}

export default function BrandSection({ profile, isLoading, loadError, defaultName, onSave }: BrandSectionProps) {
  const [form, setForm] = useState<BrandProfile>(EMPTY_BRAND);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoChanged, setLogoChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm(profile.brand);
    setLogo(profile.logo);
    setLogoChanged(false);
  }, [profile]);

  const set = <K extends keyof BrandProfile>(key: K, value: BrandProfile[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage(null);
  };

  const accentError = !isHexColor(form.accentColor)
    ? 'Use o formato #RRGGBB.'
    : !isAccentReadable(form.accentColor)
    ? 'Cor muito clara: o texto ficaria difícil de ler no papel.'
    : '';
  const coverError = !isHexColor(form.coverColor)
    ? 'Use o formato #RRGGBB.'
    : !isCoverReadable(form.coverColor)
    ? 'A capa leva texto branco: escolha uma cor mais escura.'
    : '';

  const isDirty = useMemo(() => {
    const base = profile?.brand || EMPTY_BRAND;
    return logoChanged || JSON.stringify(form) !== JSON.stringify(base);
  }, [form, profile, logoChanged]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLogoError('');
    try {
      const prepared = await prepareLogo(file);
      setLogo(prepared.dataUrl);
      setLogoChanged(true);
      setForm((current) => ({ ...current, logoWidth: prepared.width, logoHeight: prepared.height }));
      setMessage(null);
    } catch (error: any) {
      setLogoError(error?.message || 'Não foi possível usar esta imagem.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removeLogo = () => {
    setLogo(null);
    setLogoChanged(true);
    setForm((current) => ({ ...current, logoWidth: 0, logoHeight: 0 }));
    setMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      await onSave({ brand: form, ...(logoChanged ? { logo } : {}) });
      setLogoChanged(false);
      setMessage({ text: 'Identidade salva. Os próximos PDFs já saem com ela.', ok: true });
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
          <Palette className="h-4 w-4 text-[#FF6A26]" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">Identidade do relatório em PDF</h2>
          <p className="mt-1 text-xs leading-relaxed text-stone-500">
            Cores, logo e nome que aparecem no relatório enviado ao cliente.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3.5 py-3 text-[11px] leading-relaxed text-amber-300">
          {loadError}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nome exibido no relatório</label>
              <input
                className={fieldClass}
                value={form.name}
                maxLength={60}
                placeholder={defaultName || 'Seu nome ou da sua agência'}
                onChange={(event) => set('name', event.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Frase de apresentação (opcional)</label>
              <input
                className={fieldClass}
                value={form.tagline}
                maxLength={80}
                placeholder="Ex.: Sites que trazem clientes"
                onChange={(event) => set('tagline', event.target.value)}
              />
            </div>
          </div>

          <div>
            <span className={labelClass}>Logo</span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-14 min-w-[112px] items-center justify-center rounded-xl border border-dashed border-white/[0.14] bg-white px-3">
                {logo ? (
                  <img src={logo} alt="Logo atual" className="max-h-10 max-w-[160px] object-contain" />
                ) : (
                  <span className="text-[10px] text-stone-400">Sem logo</span>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-stone-200 transition hover:bg-white/[0.08]"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                {logo ? 'Trocar logo' : 'Enviar logo'}
              </button>
              {logo && (
                <button
                  type="button"
                  onClick={removeLogo}
                  className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-stone-500 transition hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-stone-600">
              PNG, JPG, WebP ou SVG. Fundo transparente funciona melhor. A logo aparece sobre um fundo branco na capa.
            </p>
            {logoError && <p className="mt-1.5 text-[10px] text-rose-400">{logoError}</p>}
          </div>

          <div>
            <span className={labelClass}>Paleta</span>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((preset) => {
                const active =
                  form.accentColor.toUpperCase() === preset.accent && form.coverColor.toUpperCase() === preset.cover;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setForm((current) => ({ ...current, accentColor: preset.accent, coverColor: preset.cover }));
                      setMessage(null);
                    }}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-[11px] font-semibold transition ${
                      active ? 'border-[#FF5A12]/60 text-white' : 'border-white/[0.08] text-stone-400 hover:text-white'
                    }`}
                  >
                    <span className="flex h-5 w-5 overflow-hidden rounded-full border border-white/20">
                      <span className="h-full w-1/2" style={{ background: preset.cover }} />
                      <span className="h-full w-1/2" style={{ background: preset.accent }} />
                    </span>
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField label="Cor de destaque" value={form.accentColor} onChange={(v) => set('accentColor', v)} error={accentError} />
            <ColorField label="Cor da capa (escura)" value={form.coverColor} onChange={(v) => set('coverColor', v)} error={coverError} />
          </div>

          <div>
            <span className={labelClass}>Contato no final do relatório (opcional)</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                className={fieldClass}
                value={form.contactEmail}
                maxLength={80}
                placeholder="E-mail"
                onChange={(event) => set('contactEmail', event.target.value)}
              />
              <input
                className={fieldClass}
                value={form.contactPhone}
                maxLength={40}
                placeholder="WhatsApp"
                onChange={(event) => set('contactPhone', event.target.value)}
              />
              <input
                className={fieldClass}
                value={form.contactWebsite}
                maxLength={80}
                placeholder="Site ou Instagram"
                onChange={(event) => set('contactWebsite', event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <span className={labelClass}>Prévia da capa</span>
          <CoverPreview brand={form} logo={logo} fallbackName={defaultName} />
          <p className="mt-2 text-[10px] leading-relaxed text-stone-600">
            A prévia é ilustrativa; o relatório real traz os dados de cada empresa.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <span
          className={`flex min-h-[16px] items-center gap-1.5 text-[11px] ${
            message ? (message.ok ? 'text-emerald-400' : 'text-rose-400') : 'text-stone-600'
          }`}
        >
          {message?.ok && <Check className="h-3.5 w-3.5" />}
          {message?.text || 'O rodapé continua indicando que os dados foram coletados com a Scoutly.'}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={disabled || isSaving || !isDirty || Boolean(accentError) || Boolean(coverError)}
          className="rounded-xl bg-[#FF5A12] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#ff6a27] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar identidade'}
        </button>
      </div>
    </section>
  );
}

import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { BrandIcon } from './BrandIcon';
import { useCoreDeveloper } from '../hooks/useCoreDeveloper';

/** "+55 (11) 98765-4321", "0 11 98765 4321", "5511987654321" → "5511987654321"; null when it is not a plausible number. */
export function toWhatsAppDigits(input: string): string | null {
  let digits = input.replace(/\D/g, '').replace(/^00/, '');
  if (!digits) return null;
  if (digits.length <= 11) digits = digits.replace(/^0+/, ''); // trunk prefix ("011 9...")
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`; // national number: Brazil
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
}

/** Internal helper for Scoutly core developers: paste any phone number, get a ready wa.me link. */
export default function DevWhatsAppTool({ compact = false }: { compact?: boolean }) {
  const allowed = useCoreDeveloper();
  const [value, setValue] = useState('');
  const [copied, setCopied] = useState(false);
  if (!allowed) return null;

  const digits = toWhatsAppDigits(value);
  const link = digits ? `https://wa.me/${digits}` : null;

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked: the link is still clickable */ }
  };

  return (
    <div className={`rounded-xl border border-dashed border-emerald-400/25 bg-emerald-500/[0.05] p-2.5 ${compact ? '' : 'mt-3'}`}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
        <BrandIcon brand="whatsapp" className="h-3 w-3" alt="" /> Número → WhatsApp (dev)
      </p>
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && link) window.open(link, '_blank', 'noopener,noreferrer'); }}
          inputMode="tel"
          placeholder="Cole o número (qualquer formato)"
          className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 text-[12px] text-white outline-none placeholder:text-stone-500 focus:border-emerald-400/50"
        />
        <a
          href={link || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!link}
          className={`flex h-9 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition ${link ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'pointer-events-none bg-white/[0.06] text-stone-500'}`}
        >
          Abrir <ExternalLink className="h-3 w-3" />
        </a>
        <button
          type="button"
          onClick={copy}
          disabled={!link}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-stone-300 transition hover:bg-white/10 disabled:opacity-40"
          aria-label="Copiar link do WhatsApp"
          title="Copiar link"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      {value && (
        <p className="mt-1.5 break-all text-[10px] text-stone-400">
          {link ? <>wa.me/{digits}</> : 'Número inválido ou incompleto'}
        </p>
      )}
    </div>
  );
}

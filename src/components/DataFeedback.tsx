import { useEffect, useState } from 'react';
import { Check, ThumbsDown, ThumbsUp } from 'lucide-react';
import { submitBusinessFeedback, type FeedbackIssue } from '../services/api';
import type { Business } from '../types';

interface DataFeedbackProps {
  business: Business;
  /** What the card is showing right now; sent along so the team can find the wrong data. */
  displayed: { website?: string | null; phone?: string | null; whatsapp?: string | null; socials?: string[] };
}

const ISSUES: Array<{ id: FeedbackIssue; label: string }> = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'site', label: 'Site' },
  { id: 'redes_sociais', label: 'Redes sociais' },
  { id: 'outros', label: 'Outros' },
];

type Step = 'ask' | 'pick' | 'thanks';

export default function DataFeedback({ business, displayed }: DataFeedbackProps) {
  const [step, setStep] = useState<Step>('ask');
  const [isSending, setIsSending] = useState(false);
  const [failed, setFailed] = useState(false);

  // A new business starts a new question
  useEffect(() => {
    setStep('ask');
    setIsSending(false);
    setFailed(false);
  }, [business.id]);

  const send = async (rating: 'up' | 'down', issues: FeedbackIssue[] = []) => {
    if (isSending) return;
    setIsSending(true);
    setFailed(false);
    const ok = await submitBusinessFeedback({ business, displayed, rating, issues });
    setIsSending(false);
    if (ok) setStep('thanks');
    else setFailed(true);
  };

  if (step === 'thanks') {
    return (
      <p role="status" className="mt-4 flex items-center gap-1.5 text-[11px] text-emerald-400">
        <Check className="h-3.5 w-3.5" /> Agradecemos o seu feedback.
      </p>
    );
  }

  if (step === 'pick') {
    return (
      <div className="mt-4">
        <p className="text-[11px] text-[#a4aab5]">Quais dados podemos melhorar neste card?</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {ISSUES.map((issue) => (
            <button
              key={issue.id}
              type="button"
              disabled={isSending}
              onClick={() => void send('down', [issue.id])}
              className="rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1 text-[10px] font-medium text-[#c4c8d0] transition hover:border-white/[0.24] hover:bg-white/[0.07] hover:text-white disabled:cursor-wait disabled:opacity-50"
            >
              {issue.label}
            </button>
          ))}
        </div>
        {failed && <p className="mt-2 text-[10px] text-rose-300">Não foi possível enviar agora. Tente de novo.</p>}
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-[11px] text-[#a4aab5]">Os dados estão atualizados?</p>
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          disabled={isSending}
          onClick={() => void send('up')}
          aria-label="Sim, os dados estão atualizados"
          title="Sim"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03] text-[#b8bdc7] transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-300 disabled:cursor-wait disabled:opacity-50"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={isSending}
          onClick={() => setStep('pick')}
          aria-label="Não, há dados desatualizados"
          title="Não"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.03] text-[#b8bdc7] transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300 disabled:cursor-wait disabled:opacity-50"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
      {failed && <p className="mt-2 text-[10px] text-rose-300">Não foi possível enviar agora. Tente de novo.</p>}
    </div>
  );
}

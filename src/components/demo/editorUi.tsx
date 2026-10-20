import { useId, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export const inputClass =
  'w-full rounded-lg border border-white/[0.1] bg-[#0b0d11] px-3 py-2 text-[13px] text-white placeholder:text-[#6f7682] outline-none transition focus:border-[#ff7a45]/70 focus:ring-2 focus:ring-[#ff5a12]/20';

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  multiline?: boolean;
  rows?: number;
  max?: number;
  placeholder?: string;
  hint?: string;
  inputMode?: 'text' | 'tel' | 'url';
}

export function Field({ label, value, onChange, onFocus, multiline, rows = 3, max, placeholder, hint, inputMode }: FieldProps) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center justify-between text-[11px] font-semibold text-[#c3c8d0]">
        <span>{label}</span>
        {max ? <span className="font-normal tabular-nums text-[#7b828e]">{value.length}/{max}</span> : null}
      </label>
      {multiline ? (
        <textarea id={id} value={value} rows={rows} maxLength={max} placeholder={placeholder} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} className={`${inputClass} resize-y leading-relaxed`} />
      ) : (
        <input id={id} value={value} maxLength={max} placeholder={placeholder} inputMode={inputMode} onFocus={onFocus} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      )}
      {hint && <p className="text-[10.5px] leading-relaxed text-[#8b929e]">{hint}</p>}
    </div>
  );
}

interface GroupProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  count?: number;
}

export function Group({ title, open, onToggle, children, count }: GroupProps) {
  return (
    <section className="border-b border-white/[0.07]">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-white">
          {title}
          {typeof count === 'number' && <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-[#b9bec7]">{count}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 text-[#9aa1ac] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="space-y-4 px-4 pb-5">{children}</div>}
    </section>
  );
}

export function ItemCard({ children, onRemove, label }: { children: ReactNode; onRemove?: () => void; label: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b929e]">{label}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#ff8b8b] hover:bg-rose-500/10">Remover</button>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function AddButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-white/[0.18] text-[12px] font-semibold text-[#d0d4db] transition hover:border-[#ff7a45]/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
      {children}
    </button>
  );
}

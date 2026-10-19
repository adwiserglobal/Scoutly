import { Lock, Sparkles } from 'lucide-react';

interface RecommendedTriggerProps {
  count: number;
  newCount: number;
  locked: boolean;
  open: boolean;
  onToggle: () => void;
  onUpgrade: () => void;
}

export default function RecommendedTrigger({
  count,
  newCount,
  locked,
  open,
  onToggle,
  onUpgrade,
}: RecommendedTriggerProps) {
  return (
    <div className="relative pointer-events-auto">
      <button
        type="button"
        onClick={locked ? onUpgrade : onToggle}
        aria-pressed={!locked && open}
        className={`flex h-[46px] items-center gap-2 rounded-2xl border px-4 text-xs font-bold tracking-wide shadow-[0_14px_44px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition active:scale-95 ${
          open && !locked
            ? 'border-[#FF5A12]/55 bg-[#171a1f] text-white'
            : 'border-white/10 bg-[#111418]/[0.94] text-stone-200 hover:border-[#FF5A12]/35 hover:bg-[#171a1f] hover:text-white'
        }`}
        title={locked ? 'Disponível nos planos Pro e Agency' : 'Recomendações e empresas novas'}
      >
        <Sparkles className="h-4 w-4 text-[#FF6A26]" />
        <span>Recomendados</span>
        {locked ? (
          <Lock className="h-3.5 w-3.5 text-stone-500" />
        ) : (
          <span className="rounded-full border border-white/[0.08] bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-stone-500">
            {count}
          </span>
        )}
      </button>

      {!locked && newCount > 0 && (
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[8px] font-bold text-white"
          title={`${newCount} ${newCount === 1 ? 'empresa nova' : 'empresas novas'}`}
        >
          {newCount}
        </span>
      )}
    </div>
  );
}

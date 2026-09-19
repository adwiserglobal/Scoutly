import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Lock, Sparkles } from 'lucide-react';
import { Business } from '../types';
import { translateCategory } from '../utils/categoryTranslator';

interface RecommendedDropdownProps {
  businesses: Business[];
  locked: boolean;
  onSelectBusiness: (business: Business) => void;
  onUpgrade: () => void;
}

export default function RecommendedDropdown({
  businesses,
  locked,
  onSelectBusiness,
  onUpgrade,
}: RecommendedDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleToggle = () => {
    if (locked) {
      onUpgrade();
      return;
    }
    setOpen((current) => !current);
  };

  return (
    <div ref={rootRef} className="relative pointer-events-auto">
      <button
        type="button"
        onClick={handleToggle}
        className={`flex h-[52px] items-center gap-2 rounded-full border px-4 text-xs font-bold tracking-wide shadow-sm backdrop-blur-md transition active:scale-95 ${
          open
            ? 'border-[#FF4D00] bg-white text-[#D94400]'
            : 'border-white/40 bg-white/70 text-stone-700 hover:bg-white hover:text-stone-900'
        }`}
        title={locked ? 'Disponível nos planos Pro e Agency' : '12 empresas recomendadas para você hoje'}
      >
        <Sparkles className="h-4 w-4 text-[#FF4D00]" />
        <span>Recomendados</span>
        {locked ? (
          <Lock className="h-3.5 w-3.5 text-stone-400" />
        ) : (
          <>
            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-semibold text-stone-500">
              {businesses.length}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      {open && !locked && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[90] w-[360px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-[#E7E0D8] bg-[#FAF7F2]/98 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-[#E7E0D8] bg-white/80 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[12px] font-semibold text-stone-900">Recomendados para você</h3>
                <p className="mt-0.5 text-[9px] text-stone-400">
                  Atualizados diariamente com base na sua prospecção
                </p>
              </div>
              <span className="text-[9px] font-semibold text-[#D94400]">PRO</span>
            </div>
          </div>

          <div className="max-h-[440px] overflow-y-auto p-2 custom-scrollbar">
            {businesses.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[11px] font-semibold text-stone-700">
                  Ainda não temos recomendações suficientes
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-stone-400">
                  Faça buscas, favorite empresas, use o pipeline ou abra contatos pelo WhatsApp.
                </p>
              </div>
            ) : (
              businesses.map((business, index) => (
                <button
                  key={business.id}
                  type="button"
                  onClick={() => {
                    onSelectBusiness(business);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white"
                >
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF1E8] text-[9px] font-bold text-[#D94400]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-semibold text-stone-900">
                      {business.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-stone-500">
                      {translateCategory(business.category)}
                    </span>
                    <span className="mt-0.5 block truncate text-[9px] text-stone-400">
                      {business.address || 'Endereço não identificado'}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

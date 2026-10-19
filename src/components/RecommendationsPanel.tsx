import { useState } from 'react';
import { Clock, Phone, Sparkles, X } from 'lucide-react';
import { Business } from '../types';
import { translateCategory } from '../utils/categoryTranslator';
import { NEW_COMPANY_MONTHS, formatMonthsOpen, getMonthsOpen } from '../utils/newCompanies';

interface RecommendationsPanelProps {
  open: boolean;
  onClose: () => void;
  recommended: Business[];
  newCompanies: Business[];
  selectedBusinessId?: string | null;
  onSelectBusiness: (business: Business) => void;
}

type Tab = 'RECOMENDADOS' | 'NOVAS';

function hasPhone(business: Business) {
  return Boolean(business.phone || business.phones?.length);
}

function BusinessRow({
  business,
  rank,
  selected,
  showAge,
  onSelect,
}: {
  business: Business;
  rank: number;
  selected: boolean;
  showAge: boolean;
  onSelect: () => void;
}) {
  const months = getMonthsOpen(business);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        selected
          ? 'border-[#FF5A12]/50 bg-[#FF5A12]/[0.08]'
          : 'border-transparent hover:border-white/[0.08] hover:bg-white/[0.05]'
      }`}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FFF1E8] text-[9px] font-bold text-[#FF6A26]">
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-white">{business.name}</span>
        <span className="mt-0.5 block truncate text-[10px] text-stone-500">
          {translateCategory(business.category)}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-stone-500">
          {business.address || 'Endereço não identificado'}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1">
          {showAge && months !== null && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-violet-300">
              <Clock className="h-2.5 w-2.5" /> Aberta há {formatMonthsOpen(months)}
            </span>
          )}
          {!business.website && (
            <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
              Sem site
            </span>
          )}
          {hasPhone(business) && (
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold text-stone-400">
              <Phone className="h-2.5 w-2.5" /> Contato
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

export default function RecommendationsPanel({
  open,
  onClose,
  recommended,
  newCompanies,
  selectedBusinessId,
  onSelectBusiness,
}: RecommendationsPanelProps) {
  const [tab, setTab] = useState<Tab>('RECOMENDADOS');
  const items = tab === 'RECOMENDADOS' ? recommended : newCompanies;

  return (
    <aside
      aria-hidden={!open}
      aria-label="Recomendações"
      className={`fixed inset-x-3 top-[132px] bottom-[132px] z-[45] flex flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0d1014]/[0.98] shadow-[0_24px_70px_rgba(0,0,0,0.52)] backdrop-blur-2xl pointer-events-auto transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] sm:inset-x-auto sm:right-4 sm:top-[88px] sm:w-[380px] ${
        open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-[110%] opacity-0'
      }`}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/[0.08] bg-[#111418] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FF5A12]/15">
            <Sparkles className="h-4 w-4 text-[#FF6A26]" />
          </span>
          <div>
            <h2 className="text-[12px] font-semibold text-white">Recomendados para você</h2>
            <p className="mt-0.5 text-[9px] text-stone-500">Atualizados diariamente com base na sua prospecção</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-stone-500 transition hover:bg-white/[0.06] hover:text-white"
          title="Fechar recomendações"
          aria-label="Fechar recomendações"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="shrink-0 px-3 pt-3">
        <div className="flex rounded-xl bg-white/[0.04] p-1 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setTab('RECOMENDADOS')}
            className={`flex-1 rounded-lg py-1.5 transition ${
              tab === 'RECOMENDADOS' ? 'bg-[#1b1f25] text-white' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            Para você
          </button>
          <button
            type="button"
            onClick={() => setTab('NOVAS')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition ${
              tab === 'NOVAS' ? 'bg-[#1b1f25] text-white' : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            Empresas novas
            {newCompanies.length > 0 && (
              <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[8px] leading-none text-white">
                {newCompanies.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center">
            {tab === 'RECOMENDADOS' ? (
              <>
                <p className="text-[11px] font-semibold text-stone-300">
                  Ainda não temos recomendações suficientes
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
                  Faça buscas, favorite empresas, use o pipeline ou abra contatos pelo WhatsApp.
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-semibold text-stone-300">Nenhuma empresa nova por aqui</p>
                <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
                  Mostramos empresas com CNPJ aberto nos últimos {NEW_COMPANY_MONTHS} meses, quando a
                  data de abertura é conhecida. Elas aparecem conforme você pesquisa regiões e segmentos.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {items.map((business, index) => (
              <BusinessRow
                key={business.id}
                business={business}
                rank={index + 1}
                selected={selectedBusinessId === business.id}
                showAge={tab === 'NOVAS'}
                onSelect={() => onSelectBusiness(business)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

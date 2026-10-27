import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Clock, Globe, Loader2, Lock, MapPin, Phone, Share2, Sparkles, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Business } from '../types';
import { ChestDeck, fetchChestDeck } from '../services/api';
import { buildChestCandidates } from '../utils/chestDeck';
import { translateCategory } from '../utils/categoryTranslator';
import { formatMonthsOpen, getMonthsOpen } from '../utils/newCompanies';
import ChestRays from './ChestRays';
import { BrandIcon, brandFromUrl, type BrandName } from './BrandIcon';

interface ChestModalProps {
  open: boolean;
  onClose: () => void;
  businesses: Business[];
  center?: { lat: number; lng: number } | null;
  onViewBusiness: (business: Business) => void;
  onUpgrade: () => void;
  onDeckChange?: (deck: ChestDeck | null) => void;
}

type ChestCard = ChestDeck['cards'][number];

const PALETTES = [
  ['#FF7A2E', '#C2410C'], ['#F59E0B', '#B45309'], ['#EC4899', '#9D174D'],
  ['#8B5CF6', '#5B21B6'], ['#06B6D4', '#0E7490'], ['#10B981', '#047857'],
];

function paletteFor(text: string) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) | 0;
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

function initials(name: string) {
  const letters = name.split(/\s+/).filter((part) => /[A-Za-zÀ-ú0-9]/.test(part)).slice(0, 2).map((part) => part[0]);
  return (letters.join('') || '?').toUpperCase();
}

function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'blue' | 'violet' }) {
  const tones = {
    neutral: 'bg-white/[0.08] text-stone-200',
    green: 'bg-emerald-500/15 text-emerald-300',
    blue: 'bg-sky-500/15 text-sky-300',
    violet: 'bg-violet-500/15 text-violet-300',
  } as const;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tones[tone]}`}>{children}</span>;
}

function CompanyCard({ card, index, total, onView }: { card: ChestCard; index: number; total: number; onView: () => void }) {
  const [from, to] = paletteFor(card.category || card.name);
  const months = getMonthsOpen(card);
  const hasPhone = Boolean(card.phone || card.phones?.length);
  const socials = card.socials?.length || 0;
  const brands = Array.from(new Set((card.socials || []).map((url) => brandFromUrl(url)).filter((brand): brand is BrandName => Boolean(brand))));
  const reasons = card.reasons?.length ? card.reasons : card.reason ? [card.reason] : [];

  return (
    <article className="flex w-[270px] shrink-0 snap-center flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#14171c] shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:w-[280px]">
      <div className="relative h-[76px] shrink-0" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
        <span className="absolute right-3.5 top-3.5 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
          {index + 1}/{total}
        </span>
        <div className="absolute -bottom-6 left-4 flex h-[52px] w-[52px] items-center justify-center rounded-2xl border-4 border-[#14171c] bg-white text-[16px] font-extrabold shadow-lg" style={{ color: to }}>
          {initials(card.name)}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-9">
        <h3 className="break-words text-[16px] font-extrabold leading-snug text-white">{card.name}</h3>
        <p className="mt-1 text-[12px] font-semibold text-[#FF8A55]">{translateCategory(card.category)}</p>
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-stone-400">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
          <span className="break-words">{card.address || 'Endereço não identificado'}</span>
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {!card.website && <Chip tone="blue"><Globe className="h-3 w-3" />Sem site</Chip>}
          {hasPhone && <Chip tone="green"><Phone className="h-3 w-3" />Telefone</Chip>}
          {socials > 0 && brands.length === 0 && <Chip tone="violet"><Share2 className="h-3 w-3" />{`${socials} ${socials === 1 ? 'rede' : 'redes'}`}</Chip>}
          {months !== null && <Chip><Clock className="h-3 w-3" />{`Aberta há ${formatMonthsOpen(months)}`}</Chip>}
        </div>

        {brands.length > 0 && (
          <div className="mt-3 flex items-center" aria-label="Redes sociais">
            {brands.slice(0, 5).map((brand, position) => (
              <span key={brand} className={`rounded-full ring-2 ring-[#14171c] ${position ? '-ml-2' : ''}`} style={{ zIndex: 10 - position }}>
                <BrandIcon brand={brand} />
              </span>
            ))}
          </div>
        )}

        {reasons.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.07] p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#FF8A55]">
              <Sparkles className="h-3 w-3" /> Por que no seu baú
            </p>
            <ul className="space-y-1">
              {reasons.slice(0, 2).map((reason) => (
                <li key={reason} className="break-words text-[12px] leading-snug text-stone-200">{reason}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onView}
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A2E] to-[#FF4D00] pt-0 text-[13px] font-extrabold text-white shadow-[0_8px_24px_rgba(255,90,18,0.35)] transition active:scale-[0.98]"
        >
          Ver empresa <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function ChestModal({ open, onClose, businesses, center, onViewBusiness, onUpgrade, onDeckChange }: ChestModalProps) {
  const [deck, setDeck] = useState<ChestDeck | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const businessesRef = useRef(businesses);
  businessesRef.current = businesses;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { candidates, query: matchedQuery } = buildChestCandidates(businessesRef.current, center);
    setQuery(matchedQuery);
    fetchChestDeck(candidates)
      .then((next) => {
        if (cancelled) return;
        setDeck(next);
        onDeckChange?.(next);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message || 'Não foi possível abrir o baú agora.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // The deck is requested once per opening; later map changes must not reshuffle it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mouse drag-to-scroll (touch and trackpads scroll natively). Click suppression only applies
  // right after a real drag, so the buttons inside the cards keep working.
  useEffect(() => {
    const node = scroller.current;
    if (!open || !node) return;
    let startX = 0;
    let startLeft = 0;
    let dragging = false;
    let moved = false;
    const down = (event: MouseEvent) => {
      if (event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startLeft = node.scrollLeft;
    };
    const move = (event: MouseEvent) => {
      if (!dragging) return;
      const delta = event.clientX - startX;
      if (!moved && Math.abs(delta) < 6) return;
      moved = true;
      node.style.scrollSnapType = 'none';
      node.scrollLeft = startLeft - delta;
    };
    const up = () => {
      if (!dragging) return;
      dragging = false;
      node.style.scrollSnapType = '';
      if (moved) window.setTimeout(() => { moved = false; }, 0);
    };
    const click = (event: MouseEvent) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    node.addEventListener('mousedown', down);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    node.addEventListener('click', click, true);
    return () => {
      node.removeEventListener('mousedown', down);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      node.removeEventListener('click', click, true);
    };
  }, [open, loading, deck]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') scrollByCard(1);
      else if (event.key === 'ArrowLeft') scrollByCard(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cards = useMemo<ChestCard[]>(() => {
    if (!deck) return [];
    const live = new Map(businesses.map((business) => [business.id, business]));
    return deck.cards.map((card) => ({ ...card, ...(live.get(card.id) || {}) }) as ChestCard);
  }, [deck, businesses]);

  function scrollByCard(direction: -1 | 1) {
    scroller.current?.scrollBy({ left: direction * 316, behavior: 'smooth' });
  }

  if (!open) return null;

  const empty = Boolean(deck) && !cards.length;

  return (
    <div
      className="chest-backdrop-in fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-3 py-3 backdrop-blur-xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Baú de oportunidades"
    >
      <div
        className="relative flex max-h-full w-[min(920px,100%)] flex-col overflow-y-auto rounded-[28px] border border-white/10 bg-[#0d0f13]/95 pb-4 pt-3 shadow-[0_40px_120px_rgba(0,0,0,0.65)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-stone-200 transition hover:bg-white/15"
          aria-label="Fechar baú"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center px-6">
          <div className="relative h-[84px] w-[84px] shrink-0">
            <ChestRays intense />
            <img src="/chest-open.png" alt="" width={70} height={60} draggable={false} className="chest-img absolute inset-0 m-auto h-[60px] w-auto object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]" />
          </div>
          <h2 className="text-center text-[17px] font-extrabold tracking-tight text-white">Baú de oportunidades</h2>
          <p className="mt-1 max-w-[560px] text-center text-[12px] leading-relaxed text-stone-300">
            {deck
              ? `${deck.used} de ${deck.limit} ${deck.limit === 1 ? 'carta liberada' : 'cartas liberadas'} hoje`
              : 'Separando as melhores empresas para você'}
            {query ? <span>{' · baseado em '}<span className="font-semibold text-[#FF8A55]">{query}</span></span> : null}
          </p>
        </div>

        <div className="mt-3">
          {loading && (
            <div className="mx-6 flex h-[300px] items-center justify-center rounded-[26px] border border-white/10 bg-[#14171c]/80">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF6A26]" />
            </div>
          )}

          {!loading && error && (
            <div className="mx-6 flex h-[260px] flex-col items-center justify-center gap-3 rounded-[26px] border border-white/10 bg-[#14171c]/90 p-6 text-center">
              <p className="max-w-[420px] text-[13px] leading-relaxed text-stone-300">{error}</p>
              <button type="button" onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-[12px] font-semibold text-white">Fechar</button>
            </div>
          )}

          {!loading && !error && deck && cards.length > 0 && (
            <div className="relative">
              {cards.length > 1 && (
                <>
                  <button type="button" onClick={() => scrollByCard(-1)} className="absolute left-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 md:flex" aria-label="Carta anterior">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => scrollByCard(1)} className="absolute right-2 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur transition hover:bg-black/80 md:flex" aria-label="Próxima carta">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <div
                ref={scroller}
                className="flex cursor-grab select-none snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onDragStart={(event) => event.preventDefault()}
              >
                {cards.map((card, index) => (
                  <CompanyCard key={card.id} card={card} index={index} total={cards.length} onView={() => onViewBusiness(card as Business)} />
                ))}
              </div>
              {cards.length > 1 && <p className="mt-1 text-center text-[11px] text-stone-500">Arraste para o lado para ver todas</p>}
            </div>
          )}

          {!loading && !error && empty && (
            <div className="mx-6 flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[26px] border border-white/10 bg-[#14171c]/90 p-7 text-center">
              <Sparkles className="h-7 w-7 text-[#FF6A26]" />
              <h3 className="text-[17px] font-extrabold text-white">Nada novo no baú agora</h3>
              <p className="max-w-[420px] text-[12px] leading-relaxed text-stone-400">
                Pesquise um segmento ou aproxime o mapa de uma região com empresas e abra o baú de novo.
              </p>
            </div>
          )}
        </div>

        {deck && deck.plan === 'free' && !loading && (
          <div className="mx-6 mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
            <p className="text-[11px] text-stone-400">No plano Free você ganha 1 carta por dia.</p>
            <button
              type="button"
              onClick={() => { onClose(); onUpgrade(); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF5A12] px-3.5 py-2 text-[11px] font-bold text-white transition hover:bg-[#ff6b2a]"
            >
              <Lock className="h-3 w-3" /> Liberar até 20 cartas por dia
            </button>
          </div>
        )}
        {deck && deck.plan !== 'free' && !loading && deck.remaining <= 0 && cards.length > 0 && (
          <p className="mt-3 px-6 text-center text-[11px] text-stone-500">Novas cartas chegam amanhã, à meia-noite UTC.</p>
        )}
      </div>
    </div>
  );
}

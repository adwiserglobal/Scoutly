import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Globe, Loader2, MapPin, Phone, Share2, Sparkles, X, ArrowRight, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Business } from '../types';
import { ChestDeck, fetchChestDeck } from '../services/api';
import { buildChestCandidates } from '../utils/chestDeck';
import { translateCategory } from '../utils/categoryTranslator';
import { formatMonthsOpen, getMonthsOpen } from '../utils/newCompanies';
import ChestRays from './ChestRays';

interface ChestModalProps {
  open: boolean;
  onClose: () => void;
  businesses: Business[];
  center?: { lat: number; lng: number } | null;
  onSelectBusiness: (business: Business) => void;
  onUpgrade: () => void;
  onDeckChange?: (deck: ChestDeck | null) => void;
}

type ChestCard = ChestDeck['cards'][number];

const SWIPE_THRESHOLD = 110;
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

function CompanyCard({ card, index, total }: { card: ChestCard; index: number; total: number }) {
  const [from, to] = paletteFor(card.category || card.name);
  const months = getMonthsOpen(card);
  const hasPhone = Boolean(card.phone || card.phones?.length);
  const socials = card.socials?.length || 0;
  const reasons = card.reasons?.length ? card.reasons : card.reason ? [card.reason] : [];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#14171c] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
      <div className="relative h-[132px] shrink-0 overflow-hidden" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
        <div className="absolute -bottom-12 -left-8 h-36 w-36 rounded-full bg-black/20 blur-2xl" />
        <span className="absolute right-4 top-4 rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
          {index + 1}/{total}
        </span>
        <div className="absolute -bottom-7 left-5 flex h-[68px] w-[68px] items-center justify-center rounded-2xl border-4 border-[#14171c] bg-white text-[22px] font-extrabold shadow-lg" style={{ color: to }}>
          {initials(card.name)}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-10">
        <h3 className="line-clamp-2 text-[21px] font-extrabold leading-tight text-white">{card.name}</h3>
        <p className="mt-1 text-[12px] font-semibold text-[#FF8A55]">{translateCategory(card.category)}</p>
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-stone-400">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-500" />
          <span className="line-clamp-2">{card.address || 'Endereço não identificado'}</span>
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {!card.website && <Chip tone="blue"><Globe className="h-3 w-3" />Sem site</Chip>}
          {hasPhone && <Chip tone="green"><Phone className="h-3 w-3" />Telefone</Chip>}
          {socials > 0 && <Chip tone="violet"><Share2 className="h-3 w-3" />{`${socials} ${socials === 1 ? 'rede' : 'redes'}`}</Chip>}
          {months !== null && <Chip><Clock className="h-3 w-3" />{`Aberta há ${formatMonthsOpen(months)}`}</Chip>}
        </div>

        {reasons.length > 0 && (
          <div className="mt-auto rounded-2xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.07] p-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#FF8A55]">
              <Sparkles className="h-3 w-3" /> Por que no seu baú
            </p>
            <ul className="space-y-1">
              {reasons.slice(0, 3).map((reason) => (
                <li key={reason} className="text-[12px] leading-snug text-stone-200">{reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChestModal({ open, onClose, businesses, center, onSelectBusiness, onUpgrade, onDeckChange }: ChestModalProps) {
  const [deck, setDeck] = useState<ChestDeck | null>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [drag, setDrag] = useState(0);
  const [leaving, setLeaving] = useState<-1 | 1 | 0>(0);
  const startX = useRef<number | null>(null);
  const businessesRef = useRef(businesses);
  businessesRef.current = businesses;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPosition(0);
    setDrag(0);
    setLeaving(0);
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

  const cards = useMemo<ChestCard[]>(() => {
    if (!deck) return [];
    const live = new Map(businesses.map((business) => [business.id, business]));
    return deck.cards.map((card) => ({ ...card, ...(live.get(card.id) || {}) }) as ChestCard);
  }, [deck, businesses]);

  const current = cards[position];
  const finished = Boolean(deck) && position >= cards.length;

  const advance = useCallback((direction: -1 | 1) => {
    if (!current || leaving) return;
    setLeaving(direction);
    window.setTimeout(() => {
      if (direction === 1) onSelectBusiness(current as Business);
      setPosition((value) => value + 1);
      setDrag(0);
      setLeaving(0);
    }, 220);
  }, [current, leaving, onSelectBusiness]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') advance(1);
      else if (event.key === 'ArrowLeft') advance(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, advance, onClose]);

  if (!open) return null;

  const offset = leaving ? leaving * 520 : drag;
  const rotation = offset / 18;
  const intent = offset > 40 ? 'ver' : offset < -40 ? 'pular' : null;

  return (
    <div
      className="chest-backdrop-in fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-black/55 px-4 backdrop-blur-2xl"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Baú de oportunidades"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-stone-200 transition hover:bg-white/15"
        aria-label="Fechar baú"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="relative mb-3 h-[132px] w-[132px] shrink-0" onClick={(event) => event.stopPropagation()}>
        <ChestRays intense />
        <img src="/chest-open.svg" alt="" width={104} height={104} draggable={false} className="chest-img absolute inset-0 m-auto h-[104px] w-[104px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.6)]" />
      </div>

      <div className="mb-4 text-center" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-[18px] font-extrabold tracking-tight text-white">Baú de oportunidades</h2>
        <p className="mt-0.5 text-[12px] text-stone-300">
          {deck
            ? `${deck.used} de ${deck.limit} ${deck.limit === 1 ? 'carta liberada' : 'cartas liberadas'} hoje`
            : 'Separando as melhores empresas para você'}
          {query ? <span>{' · baseado em '}<span className="font-semibold text-[#FF8A55]">{query}</span></span> : null}
        </p>
      </div>

      <div className="relative h-[430px] w-[min(340px,88vw)] shrink-0" onClick={(event) => event.stopPropagation()}>
        {loading && (
          <div className="flex h-full items-center justify-center rounded-[28px] border border-white/10 bg-[#14171c]/80">
            <Loader2 className="h-6 w-6 animate-spin text-[#FF6A26]" />
          </div>
        )}

        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-[#14171c]/90 p-6 text-center">
            <p className="text-[13px] text-stone-300">{error}</p>
            <button type="button" onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2 text-[12px] font-semibold text-white">Fechar</button>
          </div>
        )}

        {!loading && !error && deck && !finished && current && (
          <>
            {cards[position + 1] && (
              <div className="absolute inset-0 origin-bottom opacity-70" style={{ transform: 'translateY(14px) scale(0.94)' }}>
                <CompanyCard card={cards[position + 1]} index={position + 1} total={cards.length} />
              </div>
            )}
            <div
              key={current.id}
              className="absolute inset-0 touch-none select-none"
              style={{
                transform: `translateX(${offset}px) rotate(${rotation}deg)`,
                transition: startX.current === null ? 'transform 0.22s ease-out' : 'none',
                cursor: 'grab',
              }}
              onPointerDown={(event) => {
                startX.current = event.clientX;
                (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (startX.current !== null) setDrag(event.clientX - startX.current);
              }}
              onPointerUp={() => {
                const distance = drag;
                startX.current = null;
                if (distance > SWIPE_THRESHOLD) advance(1);
                else if (distance < -SWIPE_THRESHOLD) advance(-1);
                else setDrag(0);
              }}
              onPointerCancel={() => {
                startX.current = null;
                setDrag(0);
              }}
            >
              <div className="chest-card-in h-full w-full">
                <CompanyCard card={current} index={position} total={cards.length} />
              </div>
              {intent && (
                <span
                  className={`pointer-events-none absolute top-6 rounded-xl border-2 px-3 py-1 text-[15px] font-extrabold tracking-widest ${
                    intent === 'ver' ? 'left-5 -rotate-12 border-emerald-400 text-emerald-300' : 'right-5 rotate-12 border-stone-300 text-stone-200'
                  }`}
                  style={{ opacity: Math.min(1, Math.abs(offset) / 120) }}
                >
                  {intent === 'ver' ? 'VER' : 'PULAR'}
                </span>
              )}
            </div>
          </>
        )}

        {!loading && !error && deck && (finished || !cards.length) && (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-[28px] border border-white/10 bg-[#14171c]/90 p-7 text-center">
            <Sparkles className="h-7 w-7 text-[#FF6A26]" />
            <h3 className="text-[17px] font-extrabold text-white">
              {cards.length ? 'Você viu todo o baú de hoje' : 'Nada novo no baú agora'}
            </h3>
            <p className="text-[12px] leading-relaxed text-stone-400">
              {cards.length
                ? 'Novas cartas chegam amanhã, à meia-noite UTC. Pesquise outro segmento para o baú trazer empresas relacionadas.'
                : 'Pesquise um segmento ou aproxime o mapa de uma região com empresas e abra o baú de novo.'}
            </p>
            {deck.plan === 'free' && (
              <button
                type="button"
                onClick={() => { onClose(); onUpgrade(); }}
                className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-[#FF5A12] px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#ff6b2a]"
              >
                <Lock className="h-3.5 w-3.5" /> Liberar até 20 cartas por dia
              </button>
            )}
          </div>
        )}
      </div>

      {!loading && !error && deck && !finished && current && (
        <div className="mt-5 flex items-center gap-5" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => advance(-1)}
            className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.08] text-stone-200 transition hover:bg-white/15 active:scale-95"
            aria-label="Pular empresa"
            title="Pular (←)"
          >
            <X className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            className="flex h-16 items-center gap-2 rounded-full bg-gradient-to-r from-[#FF7A2E] to-[#FF4D00] px-6 text-[13px] font-extrabold text-white shadow-[0_10px_30px_rgba(255,90,18,0.45)] transition active:scale-95"
            aria-label="Ver empresa no mapa"
            title="Ver no mapa (→)"
          >
            Ver empresa <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {deck && deck.plan === 'free' && !finished && !loading && (
        <p className="mt-4 text-[11px] text-stone-400" onClick={(event) => event.stopPropagation()}>
          No plano Free você ganha 1 carta por dia.{' '}
          <button type="button" className="font-semibold text-[#FF8A55] underline-offset-2 hover:underline" onClick={() => { onClose(); onUpgrade(); }}>
            Ver planos
          </button>
        </p>
      )}
    </div>
  );
}

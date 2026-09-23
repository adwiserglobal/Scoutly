import { memo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Plus,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { Business, LeadStatus } from '../types';
import {
  fetchContextualSuggestions,
  getWhatsAppLink,
  sendAIChatMessage,
  type AIChatResult,
} from '../services/api';
import {
  getRecommendationPromptContext,
  RECOMMENDATION_SIGNAL_EVENT,
} from '../utils/recommendations';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  matchedBusinessIds?: string[];
  searchSummary?: AIChatResult['searchSummary'];
  suggestedAction?: AIChatResult['suggestedAction'];
  timestamp: string;
}

interface AIAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  businesses: Business[];
  currentRegionName: string;
  onSelectBusiness: (business: Business) => void;
  onUpdateLeadStatus: (businessId: string, status: LeadStatus) => void;
  onApplyNewRegion?: (region: {
    name: string;
    center: { lat: number; lng: number };
    businesses?: Business[];
  }) => void;
}

const AGENT_STEPS = [
  'Interpretando segmento, região e critérios',
  'Validando a localização solicitada',
  'Consultando fontes de negócios',
  'Eliminando resultados fora da região',
  'Aplicando filtros e priorizando oportunidades',
];

function AIAssistantDrawer({
  isOpen,
  onClose,
  businesses,
  currentRegionName,
  onSelectBusiness,
  onUpdateLeadStatus,
  onApplyNewRegion,
}: AIAssistantDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgentStep, setActiveAgentStep] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [bulkSavedMessages, setBulkSavedMessages] = useState<Record<string, boolean>>({});
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Business[]>([]);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading) {
      setActiveAgentStep(0);
      return;
    }

    const timers = AGENT_STEPS.slice(1).map((_, index) =>
      window.setTimeout(() => setActiveAgentStep(index + 1), 850 + index * 1000)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [isLoading]);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, activeAgentStep, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => inputRef.current?.focus(), 120);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const refreshSuggestions = async () => {
      const local = getRecommendationPromptContext(currentRegionName, businesses);
      let suggestions = local.suggestions;

      if (local.recentSearches.length > 0) {
        const remote = await fetchContextualSuggestions(local.recentSearches, currentRegionName);
        suggestions = [...local.suggestions, ...remote];
      }

      const fallback = [
        `Encontre empresas com maior potencial em ${currentRegionName || 'esta região'}`,
        `Mostre negócios com site não identificado em ${currentRegionName || 'esta região'}`,
        `Encontre prospects com telefone ou WhatsApp em ${currentRegionName || 'esta região'}`,
      ];

      const unique = [...new Set([...suggestions, ...fallback])]
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 4);

      if (!cancelled) setQuickSuggestions(unique);
    };

    void refreshSuggestions();
    const onSignalsUpdated = () => void refreshSuggestions();
    window.addEventListener(RECOMMENDATION_SIGNAL_EVENT, onSignalsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener(RECOMMENDATION_SIGNAL_EVENT, onSignalsUpdated);
    };
  }, [isOpen, currentRegionName, businesses]);

  const getBusinessesFromIds = (ids?: string[]) => {
    if (!ids?.length) return [];
    const pool = discoveredBusinesses.length > 0 ? discoveredBusinesses : businesses;
    return ids
      .map((id) => pool.find((business) => business.id === id))
      .filter((business): business is Business => Boolean(business));
  };

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const nextHistory: ChatMessage[] = [
      ...messages,
      {
        id: `usr_${Date.now()}`,
        role: 'user',
        content: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(nextHistory);
    setInputMessage('');
    setIsLoading(true);
    setActiveAgentStep(0);

    try {
      const contextBusinesses = discoveredBusinesses.length > 0 ? discoveredBusinesses : businesses;
      const result = await sendAIChatMessage({
        message: textToSend,
        history: nextHistory.map((message) => ({ role: message.role, content: message.content })),
        businesses: contextBusinesses,
        currentRegionName,
      });

      if (result.newRegion) {
        const newBusinesses = Array.isArray(result.newRegion.businesses)
          ? (result.newRegion.businesses as Business[])
          : [];

        // A new geographic search replaces previous Agentic discoveries instead
        // of accumulating businesses from older cities in the same chat session.
        setDiscoveredBusinesses(newBusinesses);
        onApplyNewRegion?.({ ...result.newRegion, businesses: newBusinesses });
      }

      setMessages((previous) => [
        ...previous,
        {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: result.text,
          matchedBusinessIds: result.matchedBusinessIds || [],
          searchSummary: result.searchSummary,
          suggestedAction: result.suggestedAction,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (error: any) {
      setMessages((previous) => [
        ...previous,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `Não consegui concluir a execução agora. ${error?.message || 'Tente novamente em instantes.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([]);
    setDiscoveredBusinesses([]);
    setBulkSavedMessages({});
    setInputMessage('');
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    window.setTimeout(() => setCopiedIndex(null), 1800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[4px]" onClick={onClose}>
      <section
        className="relative flex h-full w-full max-w-[720px] flex-col overflow-hidden border-l border-white/[0.07] bg-[#07090c] shadow-[0_0_90px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-[74px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5 sm:px-7">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Scoutly" className="h-7 w-7 object-contain" />
            <div>
              <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-white">Scoutly Agentic</h2>
              <p className="mt-0.5 text-[10px] text-stone-600">Agente de prospecção comercial</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button type="button" onClick={handleResetChat} title="Nova conversa" className="rounded-xl p-2.5 text-stone-600 transition hover:bg-white/[0.05] hover:text-stone-200">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} title="Fechar" className="rounded-xl p-2.5 text-stone-600 transition hover:bg-white/[0.05] hover:text-stone-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-7 sm:px-8 sm:py-8 no-scrollbar">
          {messages.length === 0 && !isLoading && (
            <div className="mx-auto flex min-h-full max-w-[620px] flex-col justify-center py-10">
              <div className="mb-8">
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.07] text-[#FF6A26]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="max-w-lg text-[25px] font-semibold leading-[1.12] tracking-[-0.04em] text-white">O que você quer encontrar hoje?</h3>
                <p className="mt-3 max-w-[540px] text-[12px] leading-6 text-stone-500">
                  Informe segmento, região e critérios. O Agentic valida a localização antes de consultar as fontes e não troca silenciosamente a cidade solicitada.
                </p>
              </div>

              {quickSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-700">Recomendado para você</p>
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void handleSendMessage(suggestion)}
                      className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 text-left text-[12px] text-stone-400 transition hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-stone-200"
                    >
                      <span>{suggestion}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-700 transition group-hover:text-[#FF6A26]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mx-auto max-w-[620px] space-y-8">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const matchedBusinesses = isUser ? [] : getBusinessesFromIds(message.matchedBusinessIds);

              if (isUser) {
                return (
                  <div key={message.id} className="rounded-2xl border border-white/[0.09] bg-[#111418] px-5 py-4 text-[15px] font-medium leading-7 text-white">
                    {message.content}
                  </div>
                );
              }

              return (
                <div key={message.id} className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-[#FF6A26]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Scoutly Agentic</span>
                  </div>

                  <div className="prose prose-sm max-w-none prose-invert prose-p:my-2 prose-p:text-[13px] prose-p:leading-7 prose-p:text-stone-300 prose-strong:text-white prose-li:text-stone-300">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>

                  {message.searchSummary && (
                    <div className="flex flex-wrap gap-2 border-y border-white/[0.06] py-3 text-[9px] font-medium text-stone-500">
                      <span>{message.searchSummary.shownCount}/{message.searchSummary.requestedCount} exibidos</span>
                      <span className="text-stone-700">•</span>
                      <span>{message.searchSummary.matchingCount} compatíveis</span>
                      <span className="text-stone-700">•</span>
                      <span>{message.searchSummary.regionName}</span>
                      {message.searchSummary.appliedFilters.slice(0, 2).map((filter) => (
                        <span key={filter} className="rounded-full border border-[#FF5A12]/15 bg-[#FF5A12]/[0.05] px-2 py-0.5 text-[#FF7A3D]">{filter}</span>
                      ))}
                    </div>
                  )}

                  {matchedBusinesses.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">Oportunidades · {matchedBusinesses.length}</p>
                        {message.suggestedAction?.type === 'add_to_pipeline' && (
                          <button
                            type="button"
                            disabled={Boolean(bulkSavedMessages[message.id])}
                            onClick={() => {
                              matchedBusinesses
                                .filter((business) => !business.leadStatus || business.leadStatus === 'NOVO')
                                .forEach((business) => onUpdateLeadStatus(business.id, 'CONTATADO'));
                              setBulkSavedMessages((previous) => ({ ...previous, [message.id]: true }));
                            }}
                            className="text-[9px] font-semibold text-[#FF7A3D] transition hover:text-[#ff9a6d] disabled:text-emerald-500"
                          >
                            {bulkSavedMessages[message.id] ? 'Adicionados ao pipeline' : 'Adicionar todos ao pipeline'}
                          </button>
                        )}
                      </div>

                      {matchedBusinesses.map((business) => {
                        const waLink = getWhatsAppLink(business.phone || business.phones?.[0]);
                        const isSaved = Boolean(business.leadStatus && business.leadStatus !== 'NOVO');
                        return (
                          <article key={business.id} className="rounded-2xl border border-white/[0.08] bg-[#0d1014] p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h4 className="truncate text-[12px] font-semibold text-white">{business.name}</h4>
                                <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-stone-600">{business.category} · {business.address}</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold ${business.website ? 'bg-emerald-500/[0.08] text-emerald-400' : 'border border-[#FF5A12]/15 bg-[#FF5A12]/[0.05] text-[#FF7A3D]'}`}>
                                {business.website ? 'Com site' : 'Site não identificado'}
                              </span>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
                              {waLink && (
                                <a href={waLink} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/[0.08] px-3 py-2 text-[9px] font-medium text-stone-400 transition hover:text-white">WhatsApp</a>
                              )}
                              {business.website && (
                                <a href={business.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-[9px] font-medium text-stone-400 transition hover:text-white">
                                  Site <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => onUpdateLeadStatus(business.id, isSaved ? 'NOVO' : 'CONTATADO')}
                                className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-[9px] font-medium text-stone-400 transition hover:text-white"
                              >
                                {isSaved ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                {isSaved ? 'No pipeline' : 'Pipeline'}
                              </button>
                              <button type="button" onClick={() => onSelectBusiness(business)} className="ml-auto inline-flex items-center gap-1 text-[9px] font-semibold text-[#FF7A3D] transition hover:text-[#ff9a6d]">
                                Ver detalhes <ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[9px] text-stone-700">
                    <span>{message.timestamp}</span>
                    <button type="button" onClick={() => copyToClipboard(message.content, message.id)} className="flex items-center gap-1 transition hover:text-stone-400">
                      {copiedIndex === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedIndex === message.id ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="space-y-3 border-l border-white/[0.08] pl-4">
                {AGENT_STEPS.map((step, index) => {
                  const complete = index < activeAgentStep;
                  const active = index === activeAgentStep;
                  return (
                    <div key={step} className={`flex items-center gap-3 text-[11px] ${active ? 'text-stone-200' : complete ? 'text-stone-500' : 'text-stone-700'}`}>
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${active ? 'border-[#FF5A12] bg-[#FF5A12]/10' : complete ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-white/[0.08]'}`}>
                        {complete ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : active ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF5A12]" /> : null}
                      </span>
                      <span>{step}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="shrink-0 border-t border-white/[0.07] bg-[#090b0e] px-5 py-4 sm:px-7">
          {messages.length > 0 && quickSuggestions.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
              {quickSuggestions.slice(0, 3).map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void handleSendMessage(suggestion)} disabled={isLoading} className="shrink-0 rounded-full border border-white/[0.07] px-3 py-1.5 text-[9px] text-stone-600 transition hover:text-stone-300 disabled:opacity-40">
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSendMessage();
            }}
            className="mx-auto flex max-w-[620px] items-center gap-2 rounded-2xl border border-white/[0.09] bg-[#111418] p-2 pl-4 focus-within:border-[#FF5A12]/30"
          >
            <input
              ref={inputRef}
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              disabled={isLoading}
              placeholder="Peça empresas, regiões, critérios ou oportunidades"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-stone-700 disabled:opacity-50"
            />
            <button type="submit" disabled={isLoading || !inputMessage.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF5A12] text-white transition hover:bg-[#ff6a27] disabled:bg-white/[0.05] disabled:text-stone-700">
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </section>
    </div>
  );
}

export default memo(AIAssistantDrawer);

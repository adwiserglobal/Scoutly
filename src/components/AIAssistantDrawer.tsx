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
import { fetchContextualSuggestions, getWhatsAppLink } from '../services/api';
import {
  sendAgenticChatMessage,
  type AgenticChatResult,
  type AgenticConversationContext,
} from '../services/agenticChatApi';
import {
  getRecommendationPromptContext,
  RECOMMENDATION_SIGNAL_EVENT,
} from '../utils/recommendations';

const SCOUTLY_MARK_SRC = 'data:image/png;base64,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';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  matchedBusinessIds?: string[];
  searchSummary?: AgenticChatResult['searchSummary'];
  suggestedAction?: AgenticChatResult['suggestedAction'];
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkSaved, setBulkSaved] = useState<Record<string, boolean>>({});
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Business[]>([]);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [conversationContext, setConversationContext] = useState<AgenticConversationContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

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
        `Mostre negócios sem site identificado em ${currentRegionName || 'esta região'}`,
        `Encontre prospects com telefone ou WhatsApp em ${currentRegionName || 'esta região'}`,
      ];

      const unique = [...new Set([...suggestions, ...fallback])]
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 4);

      if (!cancelled) setQuickSuggestions(unique);
    };

    void refreshSuggestions();
    const handleSignals = () => void refreshSuggestions();
    window.addEventListener(RECOMMENDATION_SIGNAL_EVENT, handleSignals);

    return () => {
      cancelled = true;
      window.removeEventListener(RECOMMENDATION_SIGNAL_EVENT, handleSignals);
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
    const text = (customText || inputMessage).trim();
    if (!text || isLoading) return;

    const nextHistory: ChatMessage[] = [
      ...messages,
      {
        id: `usr_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(nextHistory);
    setInputMessage('');
    setIsLoading(true);

    try {
      const contextBusinesses = discoveredBusinesses.length > 0 ? discoveredBusinesses : businesses;
      const result = await sendAgenticChatMessage({
        message: text,
        history: nextHistory.map((item) => ({ role: item.role, content: item.content })),
        businesses: contextBusinesses,
        currentRegionName,
        conversationContext,
      });

      if (result.conversationContext) setConversationContext(result.conversationContext);

      if (result.newRegion) {
        const nextBusinesses = Array.isArray(result.newRegion.businesses)
          ? (result.newRegion.businesses as Business[])
          : [];
        setDiscoveredBusinesses(nextBusinesses);
        onApplyNewRegion?.({ ...result.newRegion, businesses: nextBusinesses });
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
          content: `Não consegui concluir a busca agora. ${error?.message || 'Tente novamente em instantes.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setDiscoveredBusinesses([]);
    setConversationContext(null);
    setBulkSaved({});
    setInputMessage('');
    window.setTimeout(() => inputRef.current?.focus(), 50);
  };

  const copyText = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[4px]" onClick={onClose}>
      <section
        className="relative flex h-full w-full max-w-[720px] flex-col overflow-hidden border-l border-white/[0.07] bg-[#06090c] shadow-[0_0_90px_rgba(0,0,0,0.6)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={SCOUTLY_MARK_SRC} alt="Scoutly" className="h-[17px] w-[14px] object-contain" />
            <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-white">Scoutly Agentic</h2>
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={resetChat} title="Nova conversa" className="rounded-lg p-2 text-stone-600 transition hover:bg-white/[0.04] hover:text-stone-300">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} title="Fechar" className="rounded-lg p-2 text-stone-600 transition hover:bg-white/[0.04] hover:text-stone-300">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-7 no-scrollbar sm:px-8 sm:py-8">
          {messages.length === 0 && !isLoading && (
            <div className="mx-auto flex min-h-full max-w-[620px] flex-col justify-center py-10">
              <div className="mb-8">
                <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl border border-[#FF5A12]/20 bg-[#FF5A12]/[0.07] text-[#FF6A26]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="max-w-lg text-[25px] font-semibold leading-[1.12] tracking-[-0.04em] text-white">O que você quer encontrar?</h3>
                <p className="mt-3 max-w-[540px] text-[12px] leading-6 text-stone-500">
                  Escreva naturalmente. O Scoutly mantém o contexto da conversa, executa a busca e aplica os critérios pedidos.
                </p>
              </div>
              {quickSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-700">Sugestões</p>
                  {quickSuggestions.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => void handleSendMessage(suggestion)} className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 text-left text-[12px] text-stone-400 transition hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-stone-200">
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
                return <div key={message.id} className="rounded-2xl border border-white/[0.09] bg-[#111418] px-5 py-4 text-[15px] font-medium leading-7 text-white">{message.content}</div>;
              }

              return (
                <div key={message.id} className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-[#FF641F]">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                    <span>Scoutly Agentic</span>
                  </div>

                  <div className="max-w-none text-[13px] leading-7 !text-[#d8d8d8]">
                    <ReactMarkdown components={{
                      p: ({ children }) => <p className="my-2 !text-[#d8d8d8]">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold !text-white">{children}</strong>,
                      li: ({ children }) => <li className="!text-[#d8d8d8]">{children}</li>,
                      ul: ({ children }) => <ul className="my-2 list-disc pl-5 !text-[#d8d8d8]">{children}</ul>,
                      ol: ({ children }) => <ol className="my-2 list-decimal pl-5 !text-[#d8d8d8]">{children}</ol>,
                    }}>{message.content}</ReactMarkdown>
                  </div>

                  {message.searchSummary && (
                    <div className="flex flex-wrap items-center gap-2 border-y border-white/[0.06] py-3 text-[9px] font-medium text-stone-500">
                      <span>{message.searchSummary.shownCount}/{message.searchSummary.requestedCount} exibidos</span>
                      <span className="text-stone-700">•</span>
                      <span>{message.searchSummary.regionName}</span>
                      {message.searchSummary.appliedFilters.map((filter) => <span key={filter} className="rounded-full border border-[#FF5A12]/15 bg-[#FF5A12]/[0.05] px-2 py-0.5 text-[#FF7A3D]">{filter}</span>)}
                    </div>
                  )}

                  {matchedBusinesses.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-600">Resultados · {matchedBusinesses.length}</p>
                        {message.suggestedAction?.type === 'add_to_pipeline' && (
                          <button type="button" disabled={Boolean(bulkSaved[message.id])} onClick={() => {
                            matchedBusinesses.filter((business) => !business.leadStatus || business.leadStatus === 'NOVO').forEach((business) => onUpdateLeadStatus(business.id, 'CONTATADO'));
                            setBulkSaved((previous) => ({ ...previous, [message.id]: true }));
                          }} className="text-[9px] font-semibold text-[#FF7A3D] transition hover:text-[#ff9a6d] disabled:text-emerald-500">
                            {bulkSaved[message.id] ? 'Adicionados ao pipeline' : 'Adicionar todos ao pipeline'}
                          </button>
                        )}
                      </div>

                      {matchedBusinesses.map((business) => {
                        const whatsappLink = getWhatsAppLink(business.phone || business.phones?.[0]);
                        const saved = Boolean(business.leadStatus && business.leadStatus !== 'NOVO');
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
                              {whatsappLink && <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/[0.08] px-3 py-2 text-[9px] font-medium text-stone-400 transition hover:text-white">WhatsApp</a>}
                              {business.website && <a href={business.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-[9px] font-medium text-stone-400 transition hover:text-white">Site <ExternalLink className="h-3 w-3" /></a>}
                              <button type="button" onClick={() => onUpdateLeadStatus(business.id, saved ? 'NOVO' : 'CONTATADO')} className="inline-flex items-center gap-1 rounded-xl border border-white/[0.08] px-3 py-2 text-[9px] font-medium text-stone-400 transition hover:text-white">
                                {saved ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{saved ? 'No pipeline' : 'Pipeline'}
                              </button>
                              <button type="button" onClick={() => onSelectBusiness(business)} className="ml-auto inline-flex items-center gap-1 text-[9px] font-semibold text-[#FF7A3D] transition hover:text-[#ff9a6d]">Ver detalhes <ChevronRight className="h-3 w-3" /></button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center gap-3 text-[9px] text-stone-700">
                    <span>{message.timestamp}</span>
                    <button type="button" onClick={() => copyText(message.content, message.id)} className="flex items-center gap-1 transition hover:text-stone-400">
                      {copiedId === message.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedId === message.id ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-3 py-2">
                <Sparkles className="h-4 w-4 shrink-0 text-[#FF5A12]" strokeWidth={1.85} />
                <span className="text-[13px] font-medium tracking-[-0.01em] text-[#a3a3a3]">Exploring businesses and their digital presence...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="shrink-0 border-t border-white/[0.07] bg-[#080b0e] px-5 py-4 sm:px-7">
          {messages.length > 0 && quickSuggestions.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
              {quickSuggestions.slice(0, 3).map((suggestion) => <button key={suggestion} type="button" onClick={() => void handleSendMessage(suggestion)} disabled={isLoading} className="shrink-0 rounded-full border border-white/[0.07] px-3 py-1.5 text-[9px] text-stone-600 transition hover:text-stone-300 disabled:opacity-40">{suggestion}</button>)}
            </div>
          )}
          <form onSubmit={(event) => { event.preventDefault(); void handleSendMessage(); }} className="mx-auto flex max-w-[620px] items-center gap-2 rounded-2xl border border-white/[0.09] bg-[#111418] p-2 pl-4 focus-within:border-[#FF5A12]/30">
            <input ref={inputRef} value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} disabled={isLoading} placeholder="Ex.: 6 despachantes em Santo André sem site" className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-stone-700 disabled:opacity-50" />
            <button type="submit" disabled={isLoading || !inputMessage.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF5A12] text-white transition hover:bg-[#ff6a27] disabled:bg-white/[0.05] disabled:text-stone-700"><ArrowUp className="h-4 w-4" /></button>
          </form>
        </footer>
      </section>
    </div>
  );
}

export default memo(AIAssistantDrawer);

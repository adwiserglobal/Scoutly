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
import { useAuth } from '../context/AuthContext';
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  matchedBusinessIds?: string[];
  businessesSnapshot?: Business[];
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

function getGreeting(hour: number) {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getFirstName(displayName?: string | null, email?: string | null) {
  const fromDisplayName = String(displayName || '').trim().split(/\s+/)[0];
  if (fromDisplayName) return fromDisplayName;

  const emailPrefix = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
  const first = emailPrefix.split(/\s+/)[0];
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1);
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
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [bulkSaved, setBulkSaved] = useState<Record<string, boolean>>({});
  const [pipelineSaved, setPipelineSaved] = useState<Record<string, boolean>>({});
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Business[]>([]);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [conversationContext, setConversationContext] = useState<AgenticConversationContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const greeting = getGreeting(new Date().getHours());
  const firstName = getFirstName(user?.displayName, user?.email);

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

  const getBusinessesForMessage = (message: ChatMessage) => {
    if (!message.matchedBusinessIds?.length) return [];

    const snapshots = message.businessesSnapshot || [];
    const activePool = [...discoveredBusinesses, ...businesses];

    return message.matchedBusinessIds
      .map((id) => {
        const snapshot = snapshots.find((business) => business.id === id);
        const active = activePool.find((business) => business.id === id);
        if (!snapshot && !active) return null;
        if (!snapshot) return active || null;
        if (!active) return snapshot;
        return {
          ...snapshot,
          leadStatus: active.leadStatus,
          isFavorite: active.isFavorite,
        } as Business;
      })
      .filter((business): business is Business => Boolean(business));
  };

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    const nextHistory = [...messages, userMessage];

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

      const returnedBusinesses = Array.isArray(result.newRegion?.businesses)
        ? (result.newRegion?.businesses as Business[])
        : [];
      const snapshotPool = returnedBusinesses.length > 0 ? returnedBusinesses : contextBusinesses;
      const matchedIds = result.matchedBusinessIds || [];
      const businessesSnapshot = matchedIds
        .map((id) => snapshotPool.find((business) => business.id === id))
        .filter((business): business is Business => Boolean(business));

      if (result.newRegion) {
        setDiscoveredBusinesses(returnedBusinesses);
        onApplyNewRegion?.({ ...result.newRegion, businesses: returnedBusinesses });
      }

      setMessages((previous) => [
        ...previous,
        {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          content: result.text,
          matchedBusinessIds: matchedIds,
          businessesSnapshot,
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
    setPipelineSaved({});
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
        <style>{`
          @keyframes scoutlyAgenticShimmer {
            0% { background-position: 180% 0; }
            100% { background-position: -180% 0; }
          }
          .scoutly-agentic-shimmer {
            color: transparent;
            background-image: linear-gradient(90deg, #777b80 0%, #777b80 34%, #ffffff 50%, #777b80 66%, #777b80 100%);
            background-size: 230% 100%;
            background-clip: text;
            -webkit-background-clip: text;
            animation: scoutlyAgenticShimmer 1.8s linear infinite;
          }
        `}</style>

        <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-white/[0.07] px-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-[18px] w-[18px] overflow-hidden">
              <img src="/logo.png" alt="Scoutly" className="h-[18px] w-auto max-w-none object-contain object-left" />
            </div>
            <h2 className="text-[13px] font-semibold tracking-[-0.02em] text-white">Scoutly Agentic</h2>
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={resetChat} title="Nova conversa" className="rounded-lg p-2 text-stone-500 transition hover:bg-white/[0.05] hover:text-stone-200">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} title="Fechar" className="rounded-lg p-2 text-stone-500 transition hover:bg-white/[0.05] hover:text-stone-200">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-5 py-7 no-scrollbar sm:px-8 sm:py-8">
          {messages.length === 0 && !isLoading && (
            <div className="mx-auto flex min-h-full max-w-[620px] flex-col justify-center py-10">
              <div className="mb-8">
                <h3 className="max-w-[590px] text-[25px] font-semibold leading-[1.2] tracking-[-0.04em] text-white">
                  {greeting}{firstName ? `, ${firstName}` : ''}!<br />
                  O que vamos prospectar hoje?
                </h3>
                <p className="mt-3 max-w-[540px] text-[12px] leading-6 text-[#8b9097]">
                  Escreva naturalmente. O Scoutly mantém o contexto da conversa, executa a busca e aplica os critérios pedidos.
                </p>
              </div>

              {quickSuggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8a9097]">Sugestões</p>
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => void handleSendMessage(suggestion)}
                      className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-white/[0.12] bg-[#11151a] px-4 py-3.5 text-left text-[12px] text-[#c2c6cb] transition hover:border-white/[0.18] hover:bg-[#151a20] hover:text-white"
                    >
                      <span>{suggestion}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6d737a] transition group-hover:text-[#FF6A26]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mx-auto max-w-[620px] space-y-8">
            {messages.map((message) => {
              const isUser = message.role === 'user';
              const matchedBusinesses = isUser ? [] : getBusinessesForMessage(message);

              if (isUser) {
                return (
                  <div key={message.id} className="rounded-2xl border border-white/[0.11] bg-[#13171c] px-5 py-4 text-[15px] font-medium leading-7 text-white">
                    {message.content}
                  </div>
                );
              }

              return (
                <div key={message.id} className="space-y-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold text-[#FF641F]">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                    <span>Scoutly Agentic</span>
                  </div>

                  <div className="max-w-none text-[13px] leading-7 text-[#dedede]">
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="my-2 text-[#dedede]">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                        li: ({ children }) => <li className="text-[#dedede]">{children}</li>,
                        ul: ({ children }) => <ul className="my-2 list-disc pl-5 text-[#dedede]">{children}</ul>,
                        ol: ({ children }) => <ol className="my-2 list-decimal pl-5 text-[#dedede]">{children}</ol>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>

                  {message.searchSummary && (
                    <div className="flex flex-wrap items-center gap-2 border-y border-white/[0.07] py-3 text-[9px] font-medium text-[#777d84]">
                      <span>{message.searchSummary.shownCount}/{message.searchSummary.requestedCount} exibidos</span>
                      <span className="text-[#4f555c]">•</span>
                      <span>{message.searchSummary.regionName}</span>
                      {message.searchSummary.appliedFilters.map((filter) => (
                        <span key={filter} className="rounded-full border border-[#FF5A12]/20 bg-[#FF5A12]/[0.06] px-2 py-0.5 text-[#FF7A3D]">
                          {filter}
                        </span>
                      ))}
                    </div>
                  )}

                  {matchedBusinesses.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#747a81]">Resultados · {matchedBusinesses.length}</p>
                        {message.suggestedAction?.type === 'add_to_pipeline' && (
                          <button
                            type="button"
                            disabled={Boolean(bulkSaved[message.id])}
                            onClick={() => {
                              const nextSaved: Record<string, boolean> = {};
                              matchedBusinesses
                                .filter((business) => !business.leadStatus || business.leadStatus === 'NOVO')
                                .forEach((business) => {
                                  onUpdateLeadStatus(business.id, 'CONTATADO');
                                  nextSaved[business.id] = true;
                                });
                              setPipelineSaved((previous) => ({ ...previous, ...nextSaved }));
                              setBulkSaved((previous) => ({ ...previous, [message.id]: true }));
                            }}
                            className="text-[9px] font-semibold text-[#FF7A3D] transition hover:text-[#ff9a6d] disabled:text-emerald-500"
                          >
                            {bulkSaved[message.id] ? 'Adicionados ao pipeline' : 'Adicionar todos ao pipeline'}
                          </button>
                        )}
                      </div>

                      {matchedBusinesses.map((business) => {
                        const whatsappLink = getWhatsAppLink(business.phone || business.phones?.[0]);
                        const saved = pipelineSaved[business.id] ?? Boolean(business.leadStatus && business.leadStatus !== 'NOVO');

                        return (
                          <article key={business.id} className="rounded-2xl border border-white/[0.1] bg-[#0e1216] p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <h4 className="truncate text-[12px] font-semibold text-white">{business.name}</h4>
                                <p className="mt-1 line-clamp-2 text-[10px] leading-5 text-[#787e85]">{business.category} · {business.address}</p>
                              </div>
                              <span className={`shrink-0 rounded-full px-2 py-1 text-[8px] font-semibold ${business.website ? 'bg-emerald-500/[0.09] text-emerald-400' : 'border border-[#FF5A12]/20 bg-[#FF5A12]/[0.06] text-[#FF7A3D]'}`}>
                                {business.website ? 'Com site' : 'Site não identificado'}
                              </span>
                            </div>

                            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
                              {whatsappLink && (
                                <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/[0.11] px-3 py-2 text-[9px] font-medium text-[#a2a7ad] transition hover:text-white">WhatsApp</a>
                              )}
                              {business.website && (
                                <a href={business.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-xl border border-white/[0.11] px-3 py-2 text-[9px] font-medium text-[#a2a7ad] transition hover:text-white">
                                  Site <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateLeadStatus(business.id, saved ? 'NOVO' : 'CONTATADO');
                                  setPipelineSaved((previous) => ({ ...previous, [business.id]: !saved }));
                                }}
                                className="inline-flex items-center gap-1 rounded-xl border border-white/[0.11] px-3 py-2 text-[9px] font-medium text-[#a2a7ad] transition hover:text-white"
                              >
                                {saved ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                                {saved ? 'No pipeline' : 'Pipeline'}
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

                  <div className="flex items-center gap-3 text-[9px] text-[#5f656c]">
                    <span>{message.timestamp}</span>
                    <button type="button" onClick={() => copyText(message.content, message.id)} className="flex items-center gap-1 transition hover:text-[#9ca2a8]">
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
                <span className="scoutly-agentic-shimmer text-[13px] font-medium tracking-[-0.01em]">Exploring businesses and their digital presence...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="shrink-0 border-t border-white/[0.09] bg-[#0a0d11] px-5 py-4 sm:px-7">
          {messages.length > 0 && quickSuggestions.length > 0 && (
            <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar">
              {quickSuggestions.slice(0, 3).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void handleSendMessage(suggestion)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full border border-white/[0.12] bg-[#101419] px-3.5 py-2 text-[9px] text-[#aeb3b9] transition hover:border-white/[0.18] hover:bg-[#151a20] hover:text-white disabled:opacity-40"
                >
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
            className="mx-auto flex max-w-[620px] items-center gap-2 rounded-2xl border border-[#30363d] bg-[#15191e] p-2 pl-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)] transition focus-within:border-[#FF5A12]/45 focus-within:bg-[#181d22]"
          >
            <input
              ref={inputRef}
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              disabled={isLoading}
              placeholder="Ex.: 6 despachantes em Santo André sem site"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-[#777e86] disabled:opacity-50"
            />
            <button type="submit" disabled={isLoading || !inputMessage.trim()} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF5A12] text-white transition hover:bg-[#ff6a27] disabled:bg-[#252a30] disabled:text-[#656b72]">
              <ArrowUp className="h-4 w-4" />
            </button>
          </form>
        </footer>
      </section>
    </div>
  );
}

export default memo(AIAssistantDrawer);
